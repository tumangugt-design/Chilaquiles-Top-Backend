import mongoose from 'mongoose';

const botMemorySchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.models.BotMemory || mongoose.model('BotMemory', botMemorySchema);
