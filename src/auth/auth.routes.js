import { Router } from 'express'
import { staffLogin, getSession, sendOTPController, verifyOTPController, sendDriverOTPController, verifyDriverOTPController } from './auth.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/staff/login', staffLogin)
router.get('/session', verifyAuthToken, getSession)

// Customer OTP
router.post('/send-otp', sendOTPController)
router.post('/verify-otp', verifyOTPController)

// Repartidor OTP (sin usuario ni contrasena, solo telefonos preautorizados)
router.post('/repartidor/send-otp', sendDriverOTPController)
router.post('/repartidor/verify-otp', verifyDriverOTPController)

export default router
