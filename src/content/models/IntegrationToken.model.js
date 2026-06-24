import mongoose from 'mongoose';

const IntegrationTokenSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    enum: ['canva'],
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export const IntegrationToken = mongoose.model('IntegrationToken', IntegrationTokenSchema);
