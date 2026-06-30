import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateDesignSpecWithAI, generateCaptionForImage } from './content-ai.service.js';
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
      const bucket = storage;
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

export const createManualDraft = async (imageBase64, promptText, userId, format = 'post') => {
  const bucket = getFirebaseStorage();
  let imageUrl = null;

  try {
    if (bucket) {
      const fileName = `manual_uploads/${Date.now()}_manual.png`;
      const file = bucket.file(fileName);
      
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      await file.save(buffer, {
        metadata: { contentType: 'image/png' },
        public: true,
      });
      
      const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
      imageUrl = url.split('?')[0]; 
      console.log('[Content Service] Imagen manual subida a Firebase:', imageUrl);
    }
  } catch (e) {
    console.error('[Content Service] Error subiendo foto manual a Firebase:', e);
    throw new Error('Fallo al subir la imagen al servidor');
  }

  // Generar copy con Claude Vision solo si no es historia
  let contentData = null;
  if (format === 'historia') {
    contentData = {
      title: 'Historia Manual',
      copy: {
        main: '',
        caption: '',
        hashtags: []
      }
    };
  } else {
    try {
      const aiRes = await generateCaptionForImage(imageBase64, promptText);
      contentData = aiRes.data;
    } catch (e) {
      console.error('[Content Service] Error con Claude Vision:', e);
      contentData = {
        title: 'Publicación Manual',
        copy: {
          main: '',
          caption: promptText || '',
          hashtags: ['#ChilaquilesTop']
        }
      };
    }
  }

  const draft = new ContentDraft({
    title: contentData.title || 'Publicación Manual',
    objective: 'engagement',
    platforms: ['facebook', 'instagram'], // por defecto, el usuario elige al publicar
    formats: [format],
    status: 'draft',
    createdBy: userId,
    visual: {
      templateId: 'manual',
      imageUrl: imageUrl
    },
    copy: contentData.copy,
    approvalContext: {}
  });

  await draft.save();
  return draft;
};

export const updateDraftCopy = async (id, newCopy) => {
  const draft = await ContentDraft.findById(id);
  if (!draft) throw new Error('Borrador no encontrado');
  
  draft.copy = { ...draft.copy, ...newCopy };
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

export const uploadPlateToFirebase = async (imageBase64) => {
  const bucket = getFirebaseStorage();
  if (!bucket) throw new Error('Firebase Storage no configurado');

  const fileName = `platos/${Date.now()}_plato.png`;
  const file = bucket.file(fileName);
  
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  await file.save(buffer, {
    metadata: { contentType: 'image/png' },
    public: true,
  });
  
  const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
  return url.split('?')[0]; 
};