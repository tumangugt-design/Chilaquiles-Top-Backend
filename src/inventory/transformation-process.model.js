import mongoose from 'mongoose';

// Proceso de transformacion: lo que le hacemos a la materia prima (o a un
// insumo listo) para convertirla en producto terminado — picar, pelar,
// desvenar, cocer, licuar, caramelizar...
//
// Es OBLIGATORIO en todo lote de produccion: aunque un producto terminado no
// tenga receta (ej. cilantro, que no se mezcla con nada), si tiene proceso, y
// el proceso es donde se registra la merma (lo que se descarta al picar,
// pelar o desvenar).
const transformationProcessSchema = new mongoose.Schema({
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
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Merma esperada (%) de referencia para este proceso. Sirve para comparar
  // contra la merma real de cada lote y detectar desperdicio fuera de rango.
  expectedLossPct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model('TransformationProcess', transformationProcessSchema);
