import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateDesignSpecWithAI } from './content-ai.service.js';
import { getFirebaseStorage } from '../../../configs/firebase.js';
import sharp from 'sharp';
import { BRAND_ASSETS } from '../config/brand.config.js';

// Fetch an image buffer from a URL (supports https:// and data: URLs)
const fetchImageBuffer = async (url) => {
  if (!url) throw new Error('fetchImageBuffer: URL is undefined');
  
  // Handle base64 data URLs (e.g. data:image/png;base64,...)
  if (url.startsWith('data:')) {
    const commaIdx = url.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URL format');
    return Buffer.from(url.slice(commaIdx + 1), 'base64');
  }
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching: ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

import { renderImageFromSpec } from './render.engine.js';
import { uploadGeneratedImageToGitHub } from './github-storage.service.js';

export const createDraftFromIdea = async (ideaData, userId) => {
  const generated = await generateContentFromIdea(ideaData);
  const data = generated.data;

  let artProvider = 'html_components'; 
  let imageUrl = null;
  let githubPath = null;
  let finalDesignSpec = null;
  
  console.log('[Content Service] Generating DesignSpec via AI Art Director');
  try {
    const compositeSpec = {
      ...(data.designSpec || {}),
      format: (ideaData.formats || [])[0] || 'instagram_feed',
      includePlate: ideaData.includePlate || false,
      selectedPlate: ideaData.selectedPlate || null,
      includeTopIA: ideaData.includeTopIA || false,
    };

    finalDesignSpec = await generateDesignSpecWithAI(
      data.title || ideaData.topic || 'promoción de comida',
      compositeSpec,
      ideaData.promotionData || null
    );

    if (finalDesignSpec) {
      console.log('[Content Service] Rendering PNG via Puppeteer');
      const pngBuffer = await renderImageFromSpec(finalDesignSpec);

      console.log('[Content Service] Uploading to GitHub');
      const filename = `post_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const uploadResult = await uploadGeneratedImageToGitHub(pngBuffer, filename);
      
      imageUrl = uploadResult.rawUrl;
      githubPath = uploadResult.githubPath;
    } else {
      console.error('[Content Service] Failed to generate DesignSpec');
    }
  } catch (err) {
    console.error('[Content Service] Pipeline failed:', err.message);
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
      designSpec: finalDesignSpec || data.designSpec,
      artProvider,
      imageUrl,
      githubPath
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
