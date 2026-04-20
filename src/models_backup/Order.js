import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  items: [{
    sauce: String,
    protein: String,
    complement: String,
    baseRecipe: Object
  }],
  total: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['recibido', 'en_proceso', 'listo_para_despacho', 'en_camino', 'entregado'],
    default: 'recibido'
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Order', OrderSchema);
