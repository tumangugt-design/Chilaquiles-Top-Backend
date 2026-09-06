import mongoose from 'mongoose';

// "Asignacion" (Fase 1 del sistema de Compras/Lotes).
// Registra que una parte de una Compra en bruto (Purchase) se transformo en
// un producto concreto de Stock/Inventario (ej. 5 lbs de cebolla cruda -> 3
// lbs de cebolla caramelizada).
//
// El costo (inheritedCost) se calcula UNA VEZ, de forma proporcional al costo
// total en bruto de la Purchase, y se congela aqui — nunca se recalcula
// despues, sin importar el rendimiento/merma real de la transformacion. Esa
// es la inversion real: "no importa en cuanto se transforme, el costo
// inicial es el mismo" (Denilson).
//
// Fase 1 solo define el modelo. Fase 2 construye la pantalla "Compras" para
// crear estos registros (y descontar remainingQuantity de la Purchase). Fase
// 3 conecta el consumo FIFO real de los lotes al descuento de pedidos.
const purchaseAllocationSchema = new mongoose.Schema({
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  // Cuanto material EN BRUTO se tomo de esa Purchase para esta transformacion.
  rawQuantityUsed: {
    type: Number,
    required: true,
    min: 0
  },
  rawUnit: {
    type: String,
    required: true,
    trim: true
  },
  // Nombre del producto de Stock que resulta de la transformacion (debe
  // coincidir con el nombre normalizado usado en Inventory/Portion, ej.
  // "cebolla caramelizada").
  stockItemName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  // Rendimiento real: cuanto producto transformado se obtuvo.
  producedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  producedUnit: {
    type: String,
    required: true,
    trim: true
  },
  // Cuanto de este producto transformado sigue disponible para consumo FIFO
  // en ventas (Fase 3). Arranca igual a producedQuantity y se descuenta a
  // medida que las ordenes consumen de este lote especifico.
  remainingQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  isDepleted: {
    type: Boolean,
    default: false
  },
  // Costo heredado de la Purchase en bruto, proporcional a rawQuantityUsed
  // sobre purchase.quantity. Se calcula y se guarda al crear el registro;
  // nunca se recalcula despues (mismo principio que el costo por porcion).
  inheritedCost: {
    type: Number,
    required: true,
    min: 0
  },
  // inheritedCost / producedQuantity — el costo por unidad que este lote
  // transformado le hereda a Stock. Es lo que Fase 3 usara como costo de
  // salida cuando el consumo FIFO tome de este lote.
  costPerProducedUnit: {
    type: Number,
    required: true,
    min: 0
  },
  allocationDate: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userName: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

purchaseAllocationSchema.index({ stockItemName: 1, allocationDate: 1 });
purchaseAllocationSchema.index({ stockItemName: 1, remainingQuantity: 1, allocationDate: 1 });
purchaseAllocationSchema.index({ purchase: 1 });

export default mongoose.model('PurchaseAllocation', purchaseAllocationSchema);
