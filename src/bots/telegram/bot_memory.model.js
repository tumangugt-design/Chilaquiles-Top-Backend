import mongoose from 'mongoose';

const telegramBotMemorySchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
    content: { type: String },
    tool_call_id: { type: String },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true, collection: 'telegram_bot_memories' });

export default mongoose.models.TelegramBotMemory || mongoose.model('TelegramBotMemory', telegramBotMemorySchema);
