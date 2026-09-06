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
  // Jerarquia de inventario. Ver ITEM_TYPES en helpers/constants.js:
  // MATERIA_PRIMA solo se compra y debe transformarse; INSUMO_LISTO se compra
  // y ya sirve para plato/promocion; PRODUCTO_TERMINADO no se puede comprar,
  // solo nace de un lote de produccion con proceso y/o receta.
  itemType: {
    type: String,
    enum: ['MATERIA_PRIMA', 'INSUMO_LISTO', 'PRODUCTO_TERMINADO'],
    default: 'INSUMO_LISTO',
    index: true
  },
  // Proceso de transformacion asignado (obligatorio de facto para todo
  // PRODUCTO_TERMINADO: es donde se registra la merma aunque no haya receta).
  processName: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  // Receta por defecto del producto terminado, cuando existe.
  defaultRecipe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    default: null
  },
  category: {
    type: String,
    trim: true,
    default: 'Otros'
  },
  sourceType: {
    type: String,
    enum: ['comprado', 'preparado_interno'],
    default: 'comprado'
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  displayLabel: {
    type: String,
    trim: true,
    default: ''
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
