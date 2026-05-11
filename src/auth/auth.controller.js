import { USER_ROLES } from '../helpers/constants.js'
import { signLocalToken } from '../helpers/token.helper.js'
import { authenticateLocalStaffUser, createLocalStaffUser } from '../users/user.service.js'
import { generateAndSendOTP, verifyOTP } from './otp.service.js'

const JWT_SECRET = process.env.APP_JWT_SECRET || 'change-me-please'

export const staffLogin = async (req, res) => {
  try {
    const requestedRole = [USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR].includes(req.body.role)
      ? req.body.role
      : null

    const user = await authenticateLocalStaffUser({
      username: req.body.username,
      password: req.body.password,
      requestedRole,
    })

    const token = signLocalToken({ sub: user._id.toString(), role: user.role }, JWT_SECRET)

    return res.status(200).json({
      message: 'Ingreso correcto',
      token,
      user,
    })
  } catch (error) {
    return res.status(401).json({ message: error.message || 'No se pudo ingresar' })
  }
}


export const getSession = async (req, res) => {
  return res.status(200).json({
    authenticated: Boolean(req.user),
    user: req.user || null,
  })
}

export const sendOTPController = async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ message: 'Teléfono requerido' })

    const result = await generateAndSendOTP(phone)
    if (!result.success) {
      console.error(`OTP Error for ${phone}:`, result.error)
      return res.status(500).json({ 
        message: 'No se pudo enviar el código por WhatsApp',
        error: result.error 
      })
    }

    return res.status(200).json({ message: 'Código enviado' })
  } catch (error) {
    console.error('sendOTPController error:', error)
    return res.status(500).json({ message: error.message })
  }
}

export const verifyOTPController = async (req, res) => {
  try {
    const { phone, code } = req.body
    if (!phone || !code) return res.status(400).json({ message: 'Teléfono y código requeridos' })

    const isValid = await verifyOTP(phone, code)
    if (!isValid) {
      return res.status(400).json({ message: 'Código inválido o expirado' })
    }

    return res.status(200).json({ message: 'Verificado correctamente' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

