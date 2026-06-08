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


const appliedPromoSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  promoPrice: { type: Number },
  requestedCount: { type: Number },
  constraints: {
    sauce: { type: String, default: 'ALL' },
    protein: { type: String, default: 'ALL' },
    complement: { type: String, default: 'ALL' }
  }
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
  sauceTemperature: {
    type: String,
    enum: ['FRIO', 'CALIENTE'],
    required: true,
    default: 'CALIENTE'
  },
  appliedPromo: { type: appliedPromoSchema, default: null },
  couponCode: { type: String, default: null },
  couponDiscount: { type: Number, default: 0 },
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
  hiddenForAdmin: { type: Boolean, default: false },
  deliveredAt: { type: Date, default: null },
  surveyStatus: {
    type: String,
    enum: ['PENDING', 'SENT', 'COMPLETED', 'FAILED'],
    default: null
  },
  surveySendAt: { type: Date, default: null },
  surveyResponses: {
    order_ok: { type: String, enum: ['yes', 'no'], default: null },
    food_rating: { type: String, enum: ['excellent', 'normal', 'bad'], default: null },
    ordering_experience: { type: String, enum: ['easy', 'difficult'], default: null },
    respondedAt: { type: Date, default: null }
  },
  whatsappMessages: {
    orderReceived: { sent: { type: Boolean, default: false }, sentAt: { type: Date }, method: { type: String, enum: ['normal', 'template'] }, error: { type: String }, wamid: { type: String } },
    orderOnTheWay: { sent: { type: Boolean, default: false }, sentAt: { type: Date }, method: { type: String, enum: ['normal', 'template'] }, error: { type: String }, wamid: { type: String } },
    orderDelivered: { sent: { type: Boolean, default: false }, sentAt: { type: Date }, method: { type: String, enum: ['normal', 'template'] }, error: { type: String }, wamid: { type: String } },
    survey: { sent: { type: Boolean, default: false }, sentAt: { type: Date }, method: { type: String, enum: ['normal_flow', 'template_flow'] }, error: { type: String }, wamid: { type: String } }
  }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
