import { Router } from 'express'
import { staffLogin, registerStaff, getSession, sendOTPController, verifyOTPController } from './auth.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/staff/login', staffLogin)
router.post('/staff/register', registerStaff)
router.get('/session', verifyAuthToken, getSession)

// Customer OTP
router.post('/send-otp', sendOTPController)
router.post('/verify-otp', verifyOTPController)

export default router

