import { ContentDraft } from '../models/ContentDraft.model.js';
import { generateContentFromIdea, generateImageWithOpenRouter } from './content-ai.service.js';
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

// Composite logo (and optionally plate photo + TopIA) on the generated image, then upload to Firebase Storage
const compositeLogoAndUpload = async (generatedImageUrl, designSpec) => {
  try {
    if (!generatedImageUrl) throw new Error('generatedImageUrl is undefined');

    const isStory = designSpec?.format === 'instagram_story';
    const canvasSize = isStory ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };

    // Load base image
    const baseBuffer = await fetchImageBuffer(generatedImageUrl);
    let compositeImage = sharp(baseBuffer).resize(canvasSize.width, canvasSize.height, { fit: 'cover' });

    const composites = [];

    // 1. Plate photo (bottom-left, if requested)
    const plateUrl = designSpec?.selectedPlate || (designSpec?.includePlate ? BRAND_ASSETS.plates[Math.floor(Math.random() * BRAND_ASSETS.plates.length)] : null);
    if (plateUrl) {
      try {
        const plateBuffer = await fetchImageBuffer(plateUrl);
        const plateSize = Math.floor(canvasSize.width * 0.45);
        const plateResized = await sharp(plateBuffer).resize(plateSize, plateSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
        composites.push({ input: plateResized, gravity: 'southwest', blend: 'over' });
        console.log('[Brand] Plate composited from:', plateUrl);
      } catch (err) {
        console.warn('[Brand] Plate composite failed:', err.message);
      }
    }

    // 2. TopIA character (bottom-right, if requested)
    if (designSpec?.includeTopIA) {
      try {
        const topiaBuffer = await fetchImageBuffer(BRAND_ASSETS.topIA);
        const topiaSize = Math.floor(canvasSize.height * 0.38);
        const topiaResized = await sharp(topiaBuffer).resize(null, topiaSize, { fit: 'inside' }).toBuffer();
        composites.push({ input: topiaResized, gravity: 'southeast', blend: 'over' });
        console.log('[Brand] TopIA composited');
      } catch (err) {
        console.warn('[Brand] TopIA composite failed:', err.message);
      }
    }

    // 3. Logo (top-left, always)
    try {
      const logoBuffer = await fetchImageBuffer(BRAND_ASSETS.logoWhiteOnBlue);
      const logoWidth = Math.floor(canvasSize.width * 0.22);
      const logoResized = await sharp(logoBuffer).resize(logoWidth, null, { fit: 'inside' }).toBuffer();
      composites.push({ input: logoResized, top: 36, left: 36, blend: 'over' });
      console.log('[Brand] Logo composited');
    } catch (err) {
      console.warn('[Brand] Logo composite failed:', err.message);
    }

    if (composites.length > 0) {
      compositeImage = compositeImage.composite(composites);
    }

    const finalBuffer = await compositeImage.png({ quality: 92 }).toBuffer();

    // Try to upload to Firebase Storage, fall back to base64 data URL
    try {
      const storage = getFirebaseStorage();
      if (storage) {
        const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || 'chilaquiles-top.appspot.com');
        const filename = `content/drafts/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const file = bucket.file(filename);
        await file.save(finalBuffer, { metadata: { contentType: 'image/png' }, public: true });
        const uploadedUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
        console.log('[Brand] Image uploaded to Storage:', uploadedUrl);
        return uploadedUrl;
      }
    } catch (storageErr) {
      console.warn('[Brand] Firebase Storage upload failed, using data URL:', storageErr.message);
    }

    // Fallback: return as base64 data URL (works, just large)
    return `data:image/png;base64,${finalBuffer.toString('base64')}`;

  } catch (err) {
    console.error('[Brand] compositeLogoAndUpload failed:', err.message);
    return generatedImageUrl; // return original if all else fails
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
    // Merge user's visual options into designSpec
    const compositeSpec = {
      ...(data.designSpec || {}),
      format: (ideaData.formats || [])[0] || 'instagram_feed',
      includePlate: ideaData.includePlate || false,
      selectedPlate: ideaData.selectedPlate || null,
      includeTopIA: ideaData.includeTopIA || false,
    };

    const openRouterUrl = await generateImageWithOpenRouter(
      data.title || ideaData.topic || 'promoción de comida',
      compositeSpec,
      ideaData.promotionData || null
    );
    if (openRouterUrl) {
      imageUrl = await compositeLogoAndUpload(openRouterUrl, compositeSpec);
    } else {
      console.error('OpenRouter returned null image URL. Using fallback mock image.');
      imageUrl = 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%202.png';
    }
  } catch (fallbackError) {
    console.error('OpenRouter generation failed:', fallbackError.message);
    imageUrl = 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%202.png';
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
