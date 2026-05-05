import { Schema, model } from 'mongoose';

const otpSchema = new Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // 5 minutes
    }
});

export const OTP = model('OTP', otpSchema);
