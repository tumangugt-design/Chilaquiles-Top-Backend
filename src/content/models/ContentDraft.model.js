import mongoose from 'mongoose';

const contentDraftSchema = new mongoose.Schema({
  title: { type: String, required: true },
  topic: { type: String },
  objective: {
    type: String,
    enum: ['sales', 'awareness', 'announcement', 'education', 'promotion', 'engagement']
  },
  source: {
    type: String,
    enum: ['admin', 'telegram', 'automatic_scheduler'],
    default: 'admin'
  },
  promotionId: { type: String, default: null }, // Reference to Setting where key = 'promotions' and id matches
  status: {
    type: String,
    enum: ['draft', 'needs_review', 'approved', 'scheduled', 'published', 'failed', 'archived'],
    default: 'draft'
  },
  platforms: [{ type: String, enum: ['instagram', 'facebook', 'whatsapp', 'tiktok'] }],
  formats: [{ type: String, enum: ['feed', 'story', 'reel', 'whatsapp_message', 'whatsapp_export', 'instagram_feed', 'instagram_story', 'whatsapp_image', 'facebook_cover', 'tiktok_video_cover'] }],
  copy: {
    main: { type: String },
    short: { type: String },
    caption: { type: String },
    hashtags: [{ type: String }],
    cta: { type: String },
    whatsappText: { type: String }
  },
  visual: {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreativeAsset' },
    imageUrl: { type: String },
    videoUrl: { type: String },
    templateId: { type: String },
    renderConfig: { type: mongoose.Schema.Types.Mixed },
    designSpec: { type: mongoose.Schema.Types.Mixed },
    artProvider: { type: String },
    htmlSnapshot: { type: String }
  },
  ai: {
    model: { type: String },
    prompt: { type: String },
    contextUsed: { type: mongoose.Schema.Types.Mixed },
    revisionHistory: [{ type: mongoose.Schema.Types.Mixed }]
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scheduledAt: { type: Date },
  publishedAt: { type: Date }
}, { timestamps: true });

export const ContentDraft = mongoose.models.ContentDraft || mongoose.model('ContentDraft', contentDraftSchema);
