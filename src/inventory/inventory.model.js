import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minimumStock: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, { timestamps: true });

export default mongoose.model('Inventory', inventoryItemSchema);
