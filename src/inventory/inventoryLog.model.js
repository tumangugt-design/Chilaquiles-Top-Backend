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
    // MERMA: baja declarada (se cayo, se echo a perder, conteo por debajo).
    // Se separa de OUT a proposito: OUT es producto que se vendio y su costo
    // es COGS; MERMA es producto que se perdio y su costo es perdida. Meterlos
    // en la misma bolsa hace que el margen mienta.
    enum: ['IN', 'OUT', 'ADJUSTMENT', 'MERMA'],
    required: true
  },
  // Por que se movio, cuando el movimiento vino de una rectificacion.
  // CONTEO            conteo fisico o corte de arranque
  // MERMA             se perdio, se cayo, se echo a perder
  // DESCUADRE_RECETA  la receta descuenta distinto de lo que se usa de verdad
  // DEVOLUCION        entro de vuelta
  //
  // No es cosmetico: separa "perdi producto" de "mi receta esta mal medida".
  // El primero es plata que se fue; el segundo es que tu costo teorico por
  // plato no corresponde con el real, y se arregla en el recetario, no
  // rectificando todos los dias.
  rectificationClass: {
    type: String,
    enum: ['CONTEO', 'MERMA', 'DESCUADRE_RECETA', 'DEVOLUCION', null],
    default: null,
    index: true
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
  // --- Fase 3 (Compras/Lotes): costeo FIFO real de la salida ---
  // Para salidas (type: 'OUT') que pudieron rastrearse a lotes concretos via
  // PurchaseAllocation. costPerUnit/totalCost cubren solo la parte de `amount`
  // que sí tenía lote conocido (ver sourceAllocations); si el consumo excede
  // lo disponible en lotes, el resto queda sin costo asociado (null/omitido).
  costPerUnit: {
    type: Number,
    default: null
  },
  totalCost: {
    type: Number,
    default: null
  },
  sourceAllocations: {
    type: [{
      allocation: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseAllocation' },
      quantityConsumed: Number,
      unit: String,
      costPerUnit: Number
    }],
    default: []
  },
  reason: {
    type: String,
    trim: true,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('InventoryLog', inventoryLogSchema);
