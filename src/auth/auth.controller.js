import { USER_ROLES } from '../helpers/constants.js'
import { signLocalToken } from '../helpers/token.helper.js'
import { authenticateLocalStaffUser, createPendingLocalStaffUser, upsertGuestClientUser } from '../users/user.service.js'
import { sendWhatsAppTemplate } from '../helpers/whatsapp.helper.js'
import Otp from './otp.model.js'

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

export const registerStaff = async (req, res) => {
  try {
    const requestedRole = [USER_ROLES.CHEF, USER_ROLES.REPARTIDOR].includes(req.body.role)
      ? req.body.role
      : USER_ROLES.REPARTIDOR

    const user = await createPendingLocalStaffUser({
      name: req.body.name,
      phone: req.body.phone,
      username: req.body.username,
      password: req.body.password,
      requestedRole,
    })

    return res.status(201).json({
      message: 'Solicitud enviada',
      user,
    })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'No se pudo crear la solicitud' })
  }
}

export const getSession = async (req, res) => {
  return res.status(200).json({
    authenticated: Boolean(req.user),
    user: req.user || null,
  })
}

export const requestClientAuth = async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ message: 'El número de teléfono es requerido' })

    const code = Math.floor(1000 + Math.random() * 9000).toString()

    await Otp.findOneAndUpdate(
      { phone },
      { code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true }
    )

    try {
      await sendWhatsAppTemplate(phone, 'auth_code_chilaquiles', [code])
    } catch (e) {
      console.error('Error enviando WhatsApp:', e)
      return res.status(500).json({ message: 'Error enviando código de WhatsApp: ' + e.message })
    }

    return res.status(200).json({ message: 'Código de verificación enviado por WhatsApp' })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error interno del servidor' })
  }
}

export const verifyClientAuth = async (req, res) => {
  try {
    const { phone, code, name, location, address } = req.body
    if (!phone || !code) return res.status(400).json({ message: 'El teléfono y el código son requeridos' })

    const otpRecord = await Otp.findOne({ phone })
    if (!otpRecord) return res.status(400).json({ message: 'El código expiró o no existe' })
    if (otpRecord.code !== code) return res.status(400).json({ message: 'Código de verificación inválido' })

    await Otp.deleteOne({ _id: otpRecord._id })

    const user = await upsertGuestClientUser({ phone, name, location, address })
    const token = signLocalToken({ sub: user._id.toString(), role: user.role }, JWT_SECRET)

    return res.status(200).json({
      message: 'Ingreso correcto',
      token,
      user
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error interno del servidor' })
  }
}
