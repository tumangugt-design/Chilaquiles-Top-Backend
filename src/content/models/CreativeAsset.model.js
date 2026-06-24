import mongoose from 'mongoose';

const creativeAssetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'logo',
      'background',
      'product_photo',
      'template',
      'font',
      'icon',
      'generated_art',
      'video_asset'
    ],
    required: true
  },
  url: { type: String, required: true },
  storageProvider: { type: String, default: 'local' },
  mimeType: { type: String },
  dimensions: {
    width: { type: Number },
    height: { type: Number }
  },
  platformFit: {
    instagram_feed: { type: Boolean, default: false },
    instagram_story: { type: Boolean, default: false },
    facebook_feed: { type: Boolean, default: false },
    whatsapp_image: { type: Boolean, default: false },
    reel_cover: { type: Boolean, default: false }
  },
  tags: [{ type: String }],
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'archived'], default: 'active' }
}, { timestamps: true });

export const CreativeAsset = mongoose.models.CreativeAsset || mongoose.model('CreativeAsset', creativeAssetSchema);
