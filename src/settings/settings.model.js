import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true })

export default mongoose.model('Setting', settingsSchema)
