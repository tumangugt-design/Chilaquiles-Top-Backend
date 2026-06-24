import mongoose from 'mongoose';

const metaPublishLogSchema = new mongoose.Schema({
  contentDraftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentDraft', required: true },
  platform: { type: String, required: true },
  format: { type: String, required: true },
  requestPayload: { type: mongoose.Schema.Types.Mixed },
  responsePayload: { type: mongoose.Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['success', 'failed', 'simulated'],
    required: true
  },
  errorCode: { type: String },
  errorMessage: { type: String },
  publishedUrl: { type: String },
  metaId: { type: String }
}, { timestamps: true });

export const MetaPublishLog = mongoose.models.MetaPublishLog || mongoose.model('MetaPublishLog', metaPublishLogSchema);
