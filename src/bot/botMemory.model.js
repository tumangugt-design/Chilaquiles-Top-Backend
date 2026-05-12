import mongoose from 'mongoose';

const botMemorySchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  lastMessages: [
    {
      role: { type: String, enum: ['user', 'assistant'] },
      content: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  context: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Limit messages to keep history manageable
botMemorySchema.pre('save', function (next) {
  if (this.lastMessages.length > 10) {
    this.lastMessages = this.lastMessages.slice(-10);
  }
  next();
});

export default mongoose.model('BotMemory', botMemorySchema);
