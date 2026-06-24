import mongoose from 'mongoose';

const contentCalendarSchema = new mongoose.Schema({
  contentDraftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentDraft', required: true },
  platform: { type: String, enum: ['facebook', 'instagram', 'whatsapp'], required: true },
  format: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'published', 'failed', 'cancelled'],
    default: 'pending'
  },
  publishMode: {
    type: String,
    enum: ['manual', 'automatic'],
    default: 'automatic'
  },
  metaPublishId: { type: String },
  error: { type: String }
}, { timestamps: true });

export const ContentCalendar = mongoose.models.ContentCalendar || mongoose.model('ContentCalendar', contentCalendarSchema);
