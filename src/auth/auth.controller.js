
import { USER_ROLES } from '../helpers/constants.js'
import { signLocalToken } from '../helpers/token.helper.js'
import { authenticateLocalStaffUser, createPendingLocalStaffUser, upsertCognitoClientUser } from '../users/user.service.js'

const JWT_SECRET = process.env.APP_JWT_SECRET || 'change-me-please'

export const clientSync = async (req, res) => {
  try {
    if (!req.cognitoUser) {
      return res.status(401).json({ message: 'Se requiere un token válido de Cognito.' })
    }

    const user = await upsertCognitoClientUser({
      providerUid: req.cognitoUser.sub,
      phone: req.cognitoUser.phone || req.body.phone,
      email: req.cognitoUser.email || req.body.email,
      name: req.body.name,
      address: req.body.address,
      location: req.body.location,
    })

    return res.status(200).json({ message: 'Cliente sincronizado correctamente', user })
  } catch (error) {
    return res.status(500).json({ message: 'Error authenticating client', error: error.message })
  }
}

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
      message: 'Staff authenticated successfully',
      token,
      user,
    })
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Error authenticating staff' })
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
      message: 'Solicitud de staff creada correctamente',
      user,
    })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error creating staff request' })
  }
}

export const getSession = async (req, res) => {
  try {
    let user = req.user || null
    if (!user && req.cognitoUser) {
      user = await upsertCognitoClientUser({
        providerUid: req.cognitoUser.sub,
        phone: req.cognitoUser.phone,
        email: req.cognitoUser.email,
      })
    }

    return res.status(200).json({
      authenticated: Boolean(user),
      user: user || null,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading session', error: error.message })
  }
}
