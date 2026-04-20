import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String }, // optional for staff
  email: { type: String }, // optional for clients
  address: { type: String }, // for clients
  role: { 
    type: String, 
    enum: ['CLIENT', 'ADMIN', 'REPARTIDOR', 'CHEF'], 
    default: 'CLIENT' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'approved' // clients are approved by default
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
