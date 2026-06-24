import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateImageWithOpenRouter } from './content-ai.service.js';
import { getFirebaseStorage } from '../../../configs/firebase.js';
import sharp from 'sharp';
import { BRAND_ASSETS } from '../config/brand.config.js';

// Fetch an image from a URL and return its buffer
const fetchImageBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
};

// Composite logo onto the generated image and upload to Firebase Storage
const compositeLogoAndUpload = async (generatedImageUrl, designSpec) => {
  try {
    const isStory = designSpec?.format === 'instagram_story';
    const canvasSize = isStory ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };

    // Fetch the generated image (could be data URL or https URL)
    let baseBuffer;
    if (generatedImageUrl.startsWith('data:')) {
      const base64 = generatedImageUrl.split(',')[1];
      baseBuffer = Buffer.from(base64, 'base64');
    } else {
      baseBuffer = await fetchImageBuffer(generatedImageUrl);
    }

    // Resize base image to canvas size
    let compositeImage = sharp(baseBuffer).resize(canvasSize.width, canvasSize.height, { fit: 'cover' });

    // Try to composite logo - gracefully skip if logo URL fails
    try {
      const logoUrl = BRAND_ASSETS.logoWhiteOnBlue;
      if (logoUrl && !logoUrl.includes('placeholder')) {
        const logoBuffer = await fetchImageBuffer(logoUrl);
        const logoResized = await sharp(logoBuffer).resize(180, null, { fit: 'inside' }).toBuffer();
        compositeImage = compositeImage.composite([{
          input: logoResized,
          top: 30,
          left: 30,
          blend: 'over'
        }]);
      }
    } catch (logoErr) {
      console.warn('[Brand] Could not composite logo, skipping:', logoErr.message);
    }

    const finalBuffer = await compositeImage.png({ quality: 90 }).toBuffer();

    // Upload to Firebase Storage
    const storage = getFirebaseStorage();
    if (storage) {
      const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || 'chilaquiles-top.appspot.com');
      const filename = `content/drafts/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const file = bucket.file(filename);
      await file.save(finalBuffer, { metadata: { contentType: 'image/png' }, public: true });
      const uploadedUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      console.log('[Brand] Image composited and uploaded to Storage:', uploadedUrl);
      return uploadedUrl;
    }
    // If no storage, return original URL
    return generatedImageUrl;
  } catch (err) {
    console.error('[Brand] compositeLogoAndUpload failed, returning original URL:', err.message);
    return generatedImageUrl;
  }
};


export const createDraftFromIdea = async (ideaData, userId) => {
  const generated = await generateContentFromIdea(ideaData);
  const data = generated.data;

  // Render Image via OpenRouter
  let artProvider = 'openrouter'; 
  let imageUrl = null;
  let htmlSnapshot = null; // No longer using HTML
  
  console.log('Using OpenRouter as primary image generator');
  try {
    const openRouterUrl = await generateImageWithOpenRouter(
      data.title || ideaData.topic || 'promoción de comida',
      data.designSpec || null,
      ideaData.promotionData || null
    );
    if (openRouterUrl) {
      // Post-process: composite logo on top of generated image, then save to Firebase Storage
      imageUrl = await compositeLogoAndUpload(openRouterUrl, data.designSpec);
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
