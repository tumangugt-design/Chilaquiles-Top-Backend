import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateDesignSpecWithAI } from './content-ai.service.js';
import { renderImageFromSpec } from './render.engine.js';
import { getFirebaseStorage } from '../../../configs/firebase.js';

export const createDraftFromIdea = async (ideaData, userId) => {
  const { topic, format, formats, platforms, objective, promotionData, includePlate, includeTopIA, selectedPlate } = ideaData;

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

  // 2. Generar DesignSpec con IA (ahora devuelve HTML crudo)
  console.log('[Content Service] Requesting HTML from AI Art Director...');
  const designHtml = await generateDesignSpecWithAI({
    topic,
    format: finalFormat,
    promotionData,
    includePlate: !!includePlate,
    includeTopIA: includeTopIA || false,
    selectedPlate
  });

  // 3. Renderizar PNG con Browserless
  let imageUrl = null;
  const isHistoria = finalFormat === 'historia';

  try {
    console.log('[Content Service] Rendering PNG with Browserless...');
    const pngBuffer = await renderImageFromSpec({
      html: designHtml,
      width: 1080,
      height: isHistoria ? 1920 : 1080
    });
    const storage = getFirebaseStorage();
    if (storage) {
      console.log('[Content Service] Uploading PNG to Firebase Storage...');
      const bucket = storage.bucket();
      const filename = `content_arts/art_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
      const file = bucket.file(filename);
      
      await file.save(pngBuffer, {
        metadata: { contentType: 'image/png' }
      });
      
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2100' // Far future to act as a public URL
      });
      
      imageUrl = url;
      console.log('[Content Service] Image uploaded successfully:', imageUrl);
    } else {
      console.log('[Content Service] Firebase not configured, falling back to base64');
      imageUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    }
  } catch (renderErr) {
    console.error('[Content Service] Render failed:', renderErr.message);
  }

  // 4. Guardar el borrador en MongoDB
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
      designSpec: designHtml, // Guardamos el HTML crudo
      artProvider: 'browserless',
      imageUrl,
      githubPath: null
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