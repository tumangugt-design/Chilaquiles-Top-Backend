
import User from './user.model.js'
import { USER_ROLES, USER_STATUS } from '../helpers/constants.js'
import { normalizePhone } from '../helpers/order.helper.js'
import { hashPassword, verifyPassword } from '../helpers/password.helper.js'

export const findUserByProviderUid = async (providerUid) => User.findOne({ providerUid })
export const findUserByUsername = async (username) => User.findOne({ username: String(username || '').toLowerCase().trim() })

export const upsertCognitoClientUser = async ({ providerUid, phone, email, name, address, location }) => {
  const normalizedPhone = phone ? normalizePhone(phone) : ''
  let user = await findUserByProviderUid(providerUid)

  if (!user) {
    user = await User.create({
      authProvider: 'COGNITO',
      providerUid,
      phone: normalizedPhone,
      email,
      name,
      address,
      location,
      role: USER_ROLES.CLIENT,
      status: USER_STATUS.APPROVED,
    })
    return user
  }

  user.phone = normalizedPhone || user.phone
  user.email = email || user.email
  user.name = name || user.name
  user.address = address || user.address
  user.location = location || user.location
  user.role = USER_ROLES.CLIENT
  user.status = USER_STATUS.APPROVED
  await user.save()
  return user
}

export const createPendingLocalStaffUser = async ({ name, phone, username, password, requestedRole }) => {
  const normalizedUsername = String(username || '').toLowerCase().trim()
  if (!normalizedUsername || !password) {
    throw new Error('Usuario y contraseña son obligatorios')
  }

  if (![USER_ROLES.CHEF, USER_ROLES.REPARTIDOR].includes(requestedRole)) {
    throw new Error('Rol de staff no válido')
  }

  const existingUser = await findUserByUsername(normalizedUsername)
  if (existingUser) {
    throw new Error('Ese usuario ya está registrado')
  }

  return User.create({
    authProvider: 'LOCAL',
    username: normalizedUsername,
    passwordHash: hashPassword(password),
    phone: normalizePhone(phone),
    name,
    role: requestedRole,
    status: USER_STATUS.PENDING,
  })
}

export const authenticateLocalStaffUser = async ({ username, password, requestedRole }) => {
  const user = await findUserByUsername(username)
  if (!user || user.authProvider !== 'LOCAL') {
    throw new Error('Credenciales inválidas')
  }

  if (!verifyPassword(password, user.passwordHash)) {
    throw new Error('Credenciales inválidas')
  }

  if (requestedRole && user.role !== requestedRole) {
    throw new Error('Esta cuenta no tiene acceso a este panel')
  }

  return user
}

export const listPendingStaffUsers = async () => User.find({
  authProvider: 'LOCAL',
  role: { $in: [USER_ROLES.REPARTIDOR, USER_ROLES.CHEF] },
  status: USER_STATUS.PENDING,
}).sort({ createdAt: -1 })

export const listUsersByRole = async (role) => {
  const allowedRoles = [USER_ROLES.CLIENT, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]
  if (!allowedRoles.includes(role)) return []

  const query = { role }
  if (role !== USER_ROLES.CLIENT) query.status = USER_STATUS.APPROVED
  return User.find(query).sort({ createdAt: -1 })
}

export const updateStaffApproval = async ({ userId, status, role }) => {
  const user = await User.findById(userId)
  if (!user) return null
  user.status = status || user.status
  if (role && [USER_ROLES.REPARTIDOR, USER_ROLES.CHEF].includes(role)) {
    user.role = role
  }
  await user.save()
  return user
}

export const seedAdminUser = async () => {
  const adminUsername = process.env.ADMIN_USERNAME
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminUsername || !adminPassword) return

  let existing = await findUserByUsername(adminUsername)

  if (!existing) {
    await User.create({
      authProvider: 'LOCAL',
      username: adminUsername.toLowerCase().trim(),
      passwordHash: hashPassword(adminPassword),
      email: process.env.ADMIN_EMAIL,
      name: process.env.ADMIN_NAME || 'Admin',
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.APPROVED,
    })
    return
  }

  existing.authProvider = 'LOCAL'
  existing.passwordHash = hashPassword(adminPassword)
  existing.email = process.env.ADMIN_EMAIL || existing.email
  existing.name = process.env.ADMIN_NAME || existing.name || 'Admin'
  existing.role = USER_ROLES.ADMIN
  existing.status = USER_STATUS.APPROVED
  await existing.save()
}

export const updateUserProfile = async (userId, { name, phone, photoUrl }) => {
  const user = await User.findById(userId)
  if (!user) return null
  if (name) user.name = name
  if (phone) user.phone = phone
  if (photoUrl) user.photoUrl = photoUrl
  await user.save()
  return user
}
