import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  // Campos legados (proveedor con un solo contacto). Se conservan para no
  // romper datos existentes, pero el flujo nuevo usa `contacts` (abajo) -
  // un proveedor como Cenma/PriceSmart puede tener varios contactos segun
  // que te vendan, y cada Compra puede referenciar cual se uso.
  contactName: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  contacts: {
    type: [{
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' }
    }],
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
  }
}, { timestamps: true });

export default mongoose.model('Supplier', supplierSchema);
