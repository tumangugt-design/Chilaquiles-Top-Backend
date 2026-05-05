import { OTP } from './otp.model.js';
import { sendWhatsAppOTP } from '../helpers/whatsapp.helper.js';

export const generateAndSendOTP = async (phone) => {
    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Clear previous OTPs for this phone
    await OTP.deleteMany({ phone });

    // Save new OTP
    const newOtp = new OTP({ phone, code });
    await newOtp.save();

    // Send via WhatsApp
    const sent = await sendWhatsAppOTP(phone, code);
    
    // For development, if sending fails or we want to allow 123456 as backup (optional)
    // but the user wants to remove 123456.
    
    return { success: sent, code: process.env.NODE_ENV === 'development' ? code : null };
};

export const verifyOTP = async (phone, code) => {
    // Check if OTP exists and matches
    const otpRecord = await OTP.findOne({ phone, code });
    
    if (otpRecord) {
        // Delete after verification
        await OTP.deleteOne({ _id: otpRecord._id });
        return true;
    }

    return false;
};
