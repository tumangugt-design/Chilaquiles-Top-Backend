import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateImageWithOpenRouter } from './content-ai.service.js';
import { renderHtmlToPng } from './content-html-render.service.js';
import { getFirebaseStorage } from '../../../configs/firebase.js';

export const createDraftFromIdea = async (ideaData, userId) => {
  const generated = await generateContentFromIdea(ideaData);
  const data = generated.data;

  // Render Image via OpenRouter
  let artProvider = 'openrouter'; 
  let imageUrl = null;
  let htmlSnapshot = null; // No longer using HTML
  
  console.log('Using OpenRouter as primary image generator');
  try {
    const openRouterUrl = await generateImageWithOpenRouter(data.title || ideaData.topic || 'promoción de comida');
    if (openRouterUrl) {
      imageUrl = openRouterUrl;
    } else {
      console.error('OpenRouter returned null image URL. Using fallback mock image.');
      imageUrl = 'https://chilaquiles-top.web.app/assets/menu_chilaquiles_top-DmJU2W6e.png';
    }
  } catch (fallbackError) {
    console.error('OpenRouter generation failed:', fallbackError.message);
    imageUrl = 'https://chilaquiles-top.web.app/assets/menu_chilaquiles_top-DmJU2W6e.png';
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

export const deleteDraft = async (id) => {
  const draft = await ContentDraft.findByIdAndDelete(id);
  if (!draft) throw new Error('Borrador no encontrado');
  return draft;
};
