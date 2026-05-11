import mongoose from 'mongoose';
import { ORDER_STATUS } from '../helpers/constants.js';

const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number
}, { _id: false });

const baseRecipeSchema = new mongoose.Schema({
  onion: { type: Boolean, default: true },
  cilantro: { type: Boolean, default: true },
  cream: { type: Boolean, default: true }
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  sauce: { type: String, required: true },
  protein: { type: String, required: true },
  complement: { type: String, required: true },
  baseRecipe: { type: baseRecipeSchema, default: () => ({}) }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  accessCode: { type: String },
  location: locationSchema,
  navigationLinks: {
    googleMaps: String,
    waze: String
  },
  items: {
    type: [orderItemSchema],
    validate: {
      validator: (value) => Array.isArray(value) && value.length > 0,
      message: 'Order must include at least one item'
    }
  },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.RECIBIDO
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  repartidorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hiddenForAdmin: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
