import mongoose from 'mongoose';

// "Asignacion" / lote de produccion (Fase 1-4 del sistema de Compras/Lotes).
// Registra que uno o mas ingredientes EN BRUTO (cada uno tomado de sus
// propios lotes de Compra, en orden FIFO) se combinaron para producir un
// producto concreto de Stock/Inventario.
//
// Por que rawInputs es un arreglo y no un solo `purchase`: algunos productos
// de Stock (ej. salsa) se hacen mezclando varios ingredientes crudos a la
// vez y el resultado ya no se puede separar por ingrediente (se licua todo
// junto) - lo unico medible es cuanto de cada ingrediente entro y cuanto
// salio en total. Un producto simple (ej. cebolla caramelizada, un solo
// ingrediente) es simplemente un rawInputs de un solo elemento.
//
// El costo (inheritedCost) es la suma de lo que costo cada rawInput (segun
// el/los lote(s) de Compra de los que salio, FIFO) y se calcula UNA VEZ, al
// crear el registro - nunca se recalcula despues (mismo principio que
// Portion.price en Entradas).
const purchaseAllocationSchema = new mongoose.Schema({
  // Uno por cada ingrediente en bruto usado en este lote de produccion. Un
  // mismo ingrediente puede aparecer en mas de una entrada si tuvo que
  // tomarse de mas de un lote de Compra (FIFO).
  rawInputs: {
    type: [{
      // Lote de Compra del que salio (materia prima). Cuando el insumo es un
      // INSUMO_LISTO ya acreditado a Stock, el origen es un lote de Stock
      // (sourceAllocation) y no una Compra cruda, por eso ninguno es obligatorio.
      purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
      sourceAllocation: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseAllocation', default: null },
      ingredientName: { type: String, required: true, trim: true, lowercase: true },
      quantityUsed: { type: Number, required: true, min: 0 },
      unit: { type: String, required: true, trim: true },
      // Costo heredado de ese lote de Compra especifico, proporcional a
      // quantityUsed sobre la cantidad total de esa Compra.
      cost: { type: Number, required: true, min: 0 }
    }],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'rawInputs debe tener al menos un ingrediente.'
    }
  },
  // Nombre del producto de Stock que resulta de la transformacion (debe
  // coincidir con el nombre normalizado usado en Inventory/Portion, ej.
  // "cebolla caramelizada" o "salsa roja").
  stockItemName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  // Rendimiento real: cuanto producto transformado se obtuvo en total.
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
  // Suma de rawInputs[].cost. Se calcula y se guarda al crear el registro;
  // nunca se recalcula despues (mismo principio que el costo por porcion).
  inheritedCost: {
    type: Number,
    required: true,
    min: 0
  },
  // inheritedCost / producedQuantity — el costo por unidad que este lote
  // transformado le hereda a Stock. Es lo que Fase 3 usa como costo de
  // salida cuando el consumo FIFO toma de este lote.
  costPerProducedUnit: {
    type: Number,
    required: true,
    min: 0
  },
  // --- Jerarquia: proceso y/o receta (regla dura) ---
  // Un producto terminado SOLO puede nacer de una transformacion con proceso
  // seleccionado y/o receta. `processNames` guarda que se le hizo (picado,
  // desvenado, licuado...) y `recipe` la configuracion guardada usada, si la hubo.
  processNames: {
    type: [String],
    default: []
  },
  recipe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    default: null
  },
  recipeName: {
    type: String,
    trim: true,
    default: ''
  },
  // --- Merma real del lote ---
  // totalInputQuantity: suma de los insumos convertidos a producedUnit (solo
  // se puede calcular cuando todos son convertibles; si no, queda en null).
  // mermaQuantity = totalInputQuantity - producedQuantity.
  totalInputQuantity: {
    type: Number,
    default: null
  },
  mermaQuantity: {
    type: Number,
    default: null
  },
  mermaPct: {
    type: Number,
    default: null
  },
  // Compra directa de insumo listo: no hubo transformacion real, el lote se
  // crea solo para mantener la trazabilidad de costo FIFO hacia la venta.
  isPassThrough: {
    type: Boolean,
    default: false
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
purchaseAllocationSchema.index({ 'rawInputs.purchase': 1 });

export default mongoose.model('PurchaseAllocation', purchaseAllocationSchema);
