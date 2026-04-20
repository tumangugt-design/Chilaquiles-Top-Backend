import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUS } from '../helpers/constants.js';

const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number
}, { _id: false });

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  phone: String,
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  location: locationSchema,
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.CLIENT
  },
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.PENDING
  },
  photoUrl: String
}, { timestamps: true });

export default mongoose.model('User', userSchema);
