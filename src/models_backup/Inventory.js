import mongoose from 'mongoose';

const InventorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, required: true } // 'lbs', 'litros', 'unidades'
});

export default mongoose.model('Inventory', InventorySchema);
