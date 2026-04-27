import { USER_ROLES } from '../helpers/constants.js'
import { signLocalToken } from '../helpers/token.helper.js'
import { authenticateLocalStaffUser, createPendingLocalStaffUser } from '../users/user.service.js'

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
