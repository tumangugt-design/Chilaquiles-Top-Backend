import mongoose from 'mongoose';

const portionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  usedPerPlate: {
    type: Number,
    required: true,
    default: 1
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model('Portion', portionSchema);
