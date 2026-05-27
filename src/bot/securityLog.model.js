import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'instagram'],
    required: true
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  patterns: {
    type: [String],
    default: []
  },
  riskScore: {
    type: Number,
    required: true
  },
  originalMessage: {
    type: String
  },
  action: {
    type: String,
    enum: ['ALLOW', 'SANITIZE', 'BLOCK', 'RESET'],
    required: true
  }
}, { timestamps: true, collection: 'security_logs' });

export default mongoose.model('SecurityLog', securityLogSchema);
