import mongoose from 'mongoose';

// "Compra" (Fase 1 del sistema de Compras/Lotes).
// Representa el ingreso de un ingrediente EN BRUTO (ej. 20 lbs de cebolla)
// y funciona como un lote FIFO: remainingQuantity se descuenta a medida que
// se crean PurchaseAllocation contra este lote (ver purchase-allocation.model.js).
//
// El costo total pagado (totalCost) es la inversion real y NUNCA se recalcula
// ni se sustituye despues de creado — es historico, igual que Portion.price
// en Entradas (regla de negocio confirmada por Denilson).
const purchaseSchema = new mongoose.Schema({
  ingredientName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  // Arranca igual a `quantity`. Se descuenta con cada PurchaseAllocation que
  // consuma de este lote (Fase 2). Cuando llega a 0, el lote queda agotado
  // y el consumo FIFO (Fase 3) pasa al siguiente lote mas antiguo en cola.
  remainingQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // true cuando remainingQuantity llega a 0 — util para las consultas FIFO
  // de Fase 3 (buscar el lote no agotado mas antiguo).
  isDepleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

purchaseSchema.index({ ingredientName: 1, isDepleted: 1, purchaseDate: 1 });

// Costo por unidad de compra en bruto (ej. Q/lb de cebolla cruda).
// Solo informativo — el costo que realmente se hereda hacia Stock se calcula
// y se congela en PurchaseAllocation.inheritedCost al momento de la asignacion.
purchaseSchema.methods.getUnitCost = function getUnitCost() {
  if (!this.quantity) return 0;
  return this.totalCost / this.quantity;
};

export default mongoose.model('Purchase', purchaseSchema);
