import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateDesignSpecWithAI, generateCaptionForImage } from './content-ai.service.js';
import { renderImageFromSpec } from './render.engine.js';
import { getFirebaseStorage } from '../../../configs/firebase.js';
import User from '../../users/user.model.js';
import { sendPromotionBlastMessage } from '../../bot/whatsapp.service.js';

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
const ALLOWED_WHATSAPP_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const isValidPublicImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD', redirect: 'follow' });
    const contentType = response.headers.get('content-type') || '';
    return response.ok && ALLOWED_WHATSAPP_IMAGE_MIME_TYPES.some((type) => contentType.toLowerCase().includes(type));
  } catch (error) {
    console.error('[Content Service] Imagen de WhatsApp inválida:', error.message);
    return false;
  }
};

// Envía una pieza (promoción o comunicado) por WhatsApp a toda la base de clientes.
// Unifica lo que antes era la Campaign/pestaña "Campañas": el envío queda registrado
// directamente en la pieza (draft.whatsapp), como un canal más junto a Instagram/Facebook.
export const sendDraftWhatsApp = async (id, payload) => {
  const draft = await ContentDraft.findById(id);
  if (!draft) throw new Error('Pieza no encontrada');

  const { promoName, description, price, validUntil, marketingMessage, imageUrl } = payload || {};
  if (!marketingMessage || !imageUrl) {
    throw new Error('Falta el mensaje de marketing o la imagen para enviar por WhatsApp');
  }

  const isValidImage = await isValidPublicImage(imageUrl);
  if (!isValidImage) {
    throw new Error('La URL de imagen no es válida. Debe ser pública y devolver image/jpeg, image/png o image/webp.');
  }

  const clients = await User.find({ role: 'CLIENT', phone: { $exists: true, $ne: '' } });
  if (!clients || clients.length === 0) {
    throw new Error('No hay clientes registrados con teléfono.');
  }

  draft.whatsapp = {
    status: 'processing',
    message: marketingMessage,
    totalTarget: clients.length,
    sentCount: 0,
    failedCount: 0,
    sentAt: null,
    error: null
  };
  if (!draft.platforms?.includes('whatsapp')) {
    draft.platforms = [...(draft.platforms || []), 'whatsapp'];
  }
  await draft.save();

  setImmediate(async () => {
    let sentCount = 0;
    let failedCount = 0;

    for (const client of clients) {
      try {
        const result = await sendPromotionBlastMessage(client.phone, {
          promoName: promoName || draft.title,
          description: description || '',
          price: price || '',
          validUntil: validUntil || '',
          marketingMessage,
          imageUrl
        });
        if (result.sent) sentCount++; else failedCount++;
      } catch (err) {
        failedCount++;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    try {
      const fresh = await ContentDraft.findById(id);
      if (fresh) {
        fresh.whatsapp.sentCount = sentCount;
        fresh.whatsapp.failedCount = failedCount;
        fresh.whatsapp.status = 'sent';
        fresh.whatsapp.sentAt = new Date();
        await fresh.save();
      }
      console.log(`[Content Service] Envío WhatsApp de pieza ${id} finalizado. Enviados: ${sentCount}, Fallidos: ${failedCount}`);
    } catch (err) {
      console.error('[Content Service] Error guardando resultado de envío WhatsApp:', err.message);
    }
  });

  return draft;
};
