import { USER_ROLES, USER_STATUS } from '../helpers/constants.js'
import { signLocalToken } from '../helpers/token.helper.js'
import { authenticateLocalStaffUser, createLocalStaffUser, findCustomerProfileByPhone, findDriverByPhone, setDriverNameIfMissing } from '../users/user.service.js'
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

    const customer = await findCustomerProfileByPhone(phone)

    return res.status(200).json({ message: 'Verificado correctamente', customer })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}



// ---------------------------------------------------------------------------
// ACCESO DEL REPARTIDOR (telefono + codigo de WhatsApp)
//
// El repartidor no tiene usuario ni contrasena. El admin lo preautoriza con su
// telefono desde Gestion > Repartidores; aqui solo se le manda codigo si ese
// telefono YA esta autorizado. Asi el endpoint no sirve para enumerar numeros ni
// para quemar mensajes de WhatsApp con numeros ajenos.
// ---------------------------------------------------------------------------

const DRIVER_NOT_AUTHORIZED = 'Este numero no esta autorizado. Pidele al administrador que te agregue.'

export const sendDriverOTPController = async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ message: 'Telefono requerido' })

    const driver = await findDriverByPhone(phone)
    if (!driver) return res.status(403).json({ message: DRIVER_NOT_AUTHORIZED })
    if (driver.status !== USER_STATUS.APPROVED) {
      return res.status(403).json({ message: 'Tu acceso esta desactivado. Habla con el administrador.' })
    }

    // Se manda al telefono guardado, no al que vino en el body: el emparejamiento
    // es tolerante (acepta con y sin codigo de pais) y no queremos que una variante
    // haga que el codigo salga hacia un numero distinto al autorizado.
    const result = await generateAndSendOTP(driver.phone)
    if (!result.success) {
      console.error(`OTP repartidor error para ${driver.phone}:`, result.error)
      return res.status(500).json({ message: 'No se pudo enviar el codigo por WhatsApp', error: result.error })
    }

    return res.status(200).json({
      message: 'Codigo enviado',
      needsName: !driver.name,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const verifyDriverOTPController = async (req, res) => {
  try {
    const { phone, code, name } = req.body
    if (!phone || !code) return res.status(400).json({ message: 'Telefono y codigo requeridos' })

    const driver = await findDriverByPhone(phone)
    if (!driver) return res.status(403).json({ message: DRIVER_NOT_AUTHORIZED })
    if (driver.status !== USER_STATUS.APPROVED) {
      return res.status(403).json({ message: 'Tu acceso esta desactivado. Habla con el administrador.' })
    }

    const isValid = await verifyOTP(driver.phone, code)
    if (!isValid) return res.status(400).json({ message: 'Codigo invalido o vencido' })

    if (!driver.name) {
      const cleanName = String(name || '').trim()
      if (!cleanName) return res.status(400).json({ message: 'Escribe tu nombre y apellido' })
      await setDriverNameIfMissing(driver, cleanName)
    }

    const token = signLocalToken({ sub: driver._id.toString(), role: driver.role }, JWT_SECRET)

    return res.status(200).json({ message: 'Verificado correctamente', token, user: driver })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}
