import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea } from './content-ai.service.js';
import { renderHtmlToPng } from './content-html-render.service.js';
import { getFirebaseStorage } from '../../../configs/firebase.js';

export const createDraftFromIdea = async (ideaData, userId) => {
  const generated = await generateContentFromIdea(ideaData);
  const data = generated.data;

  // Render Image via HTML
  const artProvider = 'html'; // Forced to HTML as requested
  let imageUrl = null;
  let htmlSnapshot = null;
  
  if (artProvider === 'html' && data.designSpec) {
    try {
      const renderResult = await renderHtmlToPng(data.designSpec, ideaData.promotionData?.imageUrl);
      htmlSnapshot = renderResult.htmlSnapshot;
      
      const storage = getFirebaseStorage();
      if (storage) {
        const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || 'chilaquiles-top.appspot.com');
        const filename = `content/drafts/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const file = bucket.file(filename);
        
        await file.save(renderResult.buffer, {
          metadata: { contentType: 'image/png' },
          public: true
        });
        
        // Obtenemos URL publica (depende de config de bucket, pero esta url es standard)
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      } else {
        // Fallback mock if no storage configured
        imageUrl = 'https://chilaquiles-top.web.app/assets/menu_chilaquiles_top-DmJU2W6e.png';
      }
    } catch (e) {
      console.error('Error rendering HTML to PNG:', e);
    }
  }

  const draft = new ContentDraft({
    title: data.title || ideaData.topic,
    topic: ideaData.topic,
    objective: ideaData.objective || data.objective,
    source: 'admin',
    promotionId: ideaData.promotionData ? ideaData.promotionData.id : null,
    status: 'draft',
    platforms: data.platforms || ideaData.platforms,
    formats: data.formats || ideaData.formats,
    copy: data.copy,
    visual: {
      designSpec: data.designSpec,
      artProvider,
      imageUrl,
      htmlSnapshot
    },
    ai: {
      model: 'openrouter',
      prompt: ideaData.topic,
      contextUsed: generated.rawContext
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
