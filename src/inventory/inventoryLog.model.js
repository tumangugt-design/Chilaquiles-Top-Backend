import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  ingredientName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['IN', 'OUT', 'ADJUSTMENT'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: String,
  // Para entradas de inventario, `price` se mantiene como costo total de la compra
  // por compatibilidad con registros anteriores. Los campos específicos evitan confundir
  // costo total de compra con costo de porción por plato.
  price: {
    type: Number,
    default: 0
  },
  inputAmount: {
    type: Number,
    default: null
  },
  inputUnit: {
    type: String,
    default: null
  },
  storedAmount: {
    type: Number,
    default: null
  },
  storedUnit: {
    type: String,
    default: null
  },
  totalPrice: {
    type: Number,
    default: null
  },
  portionPrice: {
    type: Number,
    default: null
  },
  unitPrice: {
    type: Number,
    default: null
  },
  reason: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('InventoryLog', inventoryLogSchema);
