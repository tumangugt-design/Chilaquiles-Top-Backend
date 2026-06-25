import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateDesignSpecWithAI } from './content-ai.service.js';
import { renderImageFromSpec } from './render.engine.js';
import { uploadGeneratedImageToGitHub } from './github-storage.service.js';

export const createDraftFromIdea = async (ideaData, userId) => {
  const { topic, format, formats, platforms, objective, promotionData, includePlate, includeTopIA } = ideaData;

  // Determinar formato final
  const finalFormat = format || (formats && formats[0]) || 'post';

  // 1. Generar copy con IA (texto para captions, hashtags, etc.)
  let contentData = null;
  try {
    const generated = await generateContentFromIdea(ideaData);
    contentData = generated.data;
  } catch (e) {
    console.error('[Content Service] generateContentFromIdea failed, using defaults:', e.message);
  }

  // 2. Generar DesignSpec con IA (Director de Arte)
  console.log('[Content Service] Requesting DesignSpec from AI Art Director...');
  const designSpec = await generateDesignSpecWithAI({
    topic,
    format: finalFormat,
    promotionData,
    includePlate: includePlate || !!promotionData, // si es promo, incluir plato por defecto
    includeTopIA: includeTopIA || false
  });

  // 3. Renderizar el HTML con Puppeteer → PNG
  let imageUrl = null;
  let githubPath = null;

  try {
    console.log('[Content Service] Rendering PNG with Puppeteer...');
    const pngBuffer = await renderImageFromSpec(designSpec);

    // 4. Subir a GitHub
    console.log('[Content Service] Uploading PNG to GitHub...');
    const timestamp = Date.now();
    const filename = `${finalFormat}_${timestamp}.png`;
    const uploadResult = await uploadGeneratedImageToGitHub(pngBuffer, filename);

    imageUrl = uploadResult.rawUrl;
    githubPath = uploadResult.githubPath;
    console.log('[Content Service] Image saved:', imageUrl);

  } catch (renderErr) {
    console.error('[Content Service] Render/Upload failed:', renderErr.message);
    // imageUrl queda null — el frontend debe manejar este caso
  }

  // 5. Guardar el borrador en MongoDB
  const draft = new ContentDraft({
    title: contentData?.title || topic || 'Arte Chilaquiles TOP',
    topic: topic || '',
    objective: objective || contentData?.objective || 'sales',
    source: 'admin',
    promotionId: promotionData?.id || null,
    status: 'draft',
    platforms: platforms || contentData?.platforms || ['instagram'],
    formats: [finalFormat],
    copy: contentData?.copy || {},
    visual: {
      designSpec,
      artProvider: 'html_components',
      imageUrl,
      githubPath
    },
    ai: {
      model: process.env.OPEN_ROUTER_MODEL || 'openrouter',
      prompt: topic || '',
      contextUsed: {}
    },
    createdBy: userId
  });

  await draft.save();
  return draft;
};

export const getDrafts = async () => {
  return await ContentDraft.find().sort({ createdAt: -1 });
};

export const getDraftById = async (id) => {
  return await ContentDraft.findById(id);
};

export const updateDraft = async (id, updateData) => {
  return await ContentDraft.findByIdAndUpdate(id, updateData, { new: true });
};

export const approveDraft = async (id, userId) => {
  const draft = await ContentDraft.findById(id);
  if (!draft) throw new Error('Borrador no encontrado');
  draft.status = 'approved';
  draft.approvedBy = userId;
  await draft.save();
  return draft;
};

export const deleteDraft = async (id) => {
  const draft = await ContentDraft.findByIdAndDelete(id);
  if (!draft) throw new Error('Borrador no encontrado');
  return draft;
};
