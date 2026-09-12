import { Router } from 'express'
import { staffLogin, getSession, sendOTPController, verifyOTPController, sendDriverOTPController, verifyDriverOTPController } from './auth.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'
import { rateLimit, porTelefono } from '../middlewares/rateLimit.middleware.js'

// Enviar un OTP cuesta un mensaje de WhatsApp Business en Q, asi que el limite
// va por TELEFONO: un atacante rota IPs, pero apunta al mismo numero.
const limiteEnvio = rateLimit({ ventanaMs: 15 * 60 * 1000, maximo: 5, nombre: 'send-otp', clave: porTelefono })
// Verificar es donde se hace fuerza bruta contra los 6 digitos.
const limiteVerificacion = rateLimit({ ventanaMs: 15 * 60 * 1000, maximo: 10, nombre: 'verify-otp', clave: porTelefono })
// Login de staff: por IP, contra el rociado de contrasenas.
const limiteLogin = rateLimit({ ventanaMs: 15 * 60 * 1000, maximo: 20, nombre: 'staff-login' })

const router = Router()

router.post('/staff/login', limiteLogin, staffLogin)
router.get('/session', verifyAuthToken, getSession)

// Customer OTP
router.post('/send-otp', limiteEnvio, sendOTPController)
router.post('/verify-otp', limiteVerificacion, verifyOTPController)

// Repartidor OTP (sin usuario ni contrasena, solo telefonos preautorizados)
router.post('/repartidor/send-otp', limiteEnvio, sendDriverOTPController)
router.post('/repartidor/verify-otp', limiteVerificacion, verifyDriverOTPController)

export default router
