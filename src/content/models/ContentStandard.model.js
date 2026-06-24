import mongoose from 'mongoose';

const contentStandardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  scope: {
    type: String,
    enum: ['copy', 'visual', 'layout', 'brand', 'platform'],
    required: true
  },
  value: { type: String, required: true },
  source: {
    type: String,
    enum: ['telegram', 'admin'],
    default: 'telegram'
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const ContentStandard = mongoose.models.ContentStandard || mongoose.model('ContentStandard', contentStandardSchema);
