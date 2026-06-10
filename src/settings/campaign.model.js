import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  promotionId: { type: String, required: true },
  imageUrl: { type: String, required: true },
  description: { type: String, required: true },
  totalTarget: { type: Number, required: true },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'FAILED'], default: 'PROCESSING' }
}, {
  timestamps: true
});

export const Campaign = mongoose.model('Campaign', campaignSchema);
