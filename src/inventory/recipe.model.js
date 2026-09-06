import mongoose from 'mongoose';

// Receta = configuracion de transformacion GUARDADA.
//
// No es un concepto nuevo aparte del lote de produccion: es exactamente la
// misma configuracion (que entra, en que cantidad, con que proceso, cuanto
// deberia salir) guardada con nombre para poder repetirla. Por eso una receta
// siempre corresponde a UN producto terminado.
//
// No todo producto terminado tiene receta (el cilantro no se mezcla con nada),
// pero todo producto terminado tiene proceso. Cuando si hay receta, el lote de
// produccion la usa como plantilla y compara el rendimiento real contra
// `expectedYield` para calcular la merma.
const recipeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  displayLabel: {
    type: String,
    trim: true,
    default: ''
  },
  // Producto terminado que resulta de esta receta (llave interna de Inventory).
  outputItemName: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  outputUnit: {
    type: String,
    required: true,
    trim: true
  },
  // Rendimiento esperado de la receta tal como esta escrita (en outputUnit).
  expectedYield: {
    type: Number,
    required: true,
    min: 0
  },
  // Insumos: materia prima y/o insumo listo. Nunca producto terminado.
  inputs: {
    type: [{
      itemName: { type: String, required: true, lowercase: true, trim: true },
      itemType: { type: String, required: true },
      quantity: { type: Number, required: true, min: 0 },
      unit: { type: String, required: true, trim: true }
    }],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'La receta debe tener al menos un insumo.'
    }
  },
  // Proceso(s) de transformacion aplicados, en orden.
  processNames: {
    type: [String],
    default: []
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdByName: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

// Merma esperada segun la receta: lo que entra menos lo que deberia salir.
// Solo es calculable cuando todos los insumos son convertibles a outputUnit
// (se resuelve en el servicio, no aqui, porque necesita las conversiones).
recipeSchema.index({ outputItemName: 1, isActive: 1 });

export default mongoose.model('Recipe', recipeSchema);
