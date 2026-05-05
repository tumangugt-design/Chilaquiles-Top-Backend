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
    const result = await sendWhatsAppOTP(phone, code);
    
    return { 
        success: result.success, 
        error: result.error,
        code: process.env.NODE_ENV === 'development' ? code : null 
    };
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
