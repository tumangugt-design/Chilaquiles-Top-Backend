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
  category: {
    type: String,
    trim: true,
    default: 'Otros'
  },
  lastPrice: {
    type: Number,
    default: 0
  },
  lastPurchaseQty: {
    type: Number,
    default: null
  },
  lastPurchaseUnit: {
    type: String,
    default: null
  },
  lastPurchaseTotalPrice: {
    type: Number,
    default: null
  },
  notes: String
}, { timestamps: true });

export default mongoose.model('Inventory', inventoryItemSchema);
