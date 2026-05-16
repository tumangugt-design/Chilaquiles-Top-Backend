import User from './user.model.js'
import Order from '../orders/order.model.js'
import { USER_ROLES, USER_STATUS } from '../helpers/constants.js'
import { normalizePhone } from '../helpers/order.helper.js'
import { hashPassword, verifyPassword } from '../helpers/password.helper.js'

export const findUserByUsername = async (username) => User.findOne({ username: String(username || '').toLowerCase().trim() })

const buildPhoneMatchQuery = (phone) => {
  const normalizedPhone = normalizePhone(phone)
  const digits = String(phone || '').replace(/\D/g, '')
  const localDigits = digits.startsWith('502') ? digits.slice(3) : digits
  const escapedLocalDigits = localDigits.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const possiblePhones = new Set([
    normalizedPhone,
    digits,
    localDigits,
    digits ? `+${digits}` : '',
    localDigits ? `+502${localDigits}` : '',
    localDigits ? `502${localDigits}` : '',
  ].filter(Boolean))

  const phoneConditions = Array.from(possiblePhones).map((value) => ({ phone: value }))
  if (localDigits) {
    phoneConditions.push({ phone: new RegExp(`${escapedLocalDigits}$`) })
  }

  return { normalizedPhone, phoneConditions }
}

const consolidateClientUsersByPhone = async ({ users, normalizedPhone, name, address, location }) => {
  const sortedUsers = [...users].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  const primaryUser = sortedUsers[0]
  const duplicateUsers = sortedUsers.slice(1)

  primaryUser.authProvider = 'GUEST'
  primaryUser.phone = normalizedPhone || primaryUser.phone
  primaryUser.name = name || primaryUser.name
  primaryUser.address = address || primaryUser.address
  primaryUser.location = location || primaryUser.location
  primaryUser.role = USER_ROLES.CLIENT
  primaryUser.status = USER_STATUS.APPROVED
  await primaryUser.save()

  if (duplicateUsers.length > 0) {
    const duplicateIds = duplicateUsers.map((duplicate) => duplicate._id)
    await Order.updateMany(
      { userId: { $in: duplicateIds } },
      { $set: { userId: primaryUser._id } }
    )
    await User.deleteMany({ _id: { $in: duplicateIds }, role: USER_ROLES.CLIENT })
  }

  return primaryUser
}

export const upsertGuestClientUser = async ({ phone, name, address, location }) => {
  const { normalizedPhone, phoneConditions } = buildPhoneMatchQuery(phone)

  if (!normalizedPhone) {
    return User.create({
      authProvider: 'GUEST',
      phone: '',
      name,
      address,
      location,
      role: USER_ROLES.CLIENT,
      status: USER_STATUS.APPROVED,
    })
  }

  const existingUsers = await User.find({
    role: USER_ROLES.CLIENT,
    $or: phoneConditions,
  }).sort({ createdAt: 1 })

  if (existingUsers.length > 0) {
    return consolidateClientUsersByPhone({
      users: existingUsers,
      normalizedPhone,
      name,
      address,
      location,
    })
  }

  try {
    return await User.create({
      authProvider: 'GUEST',
      phone: normalizedPhone,
      name,
      address,
      location,
      role: USER_ROLES.CLIENT,
      status: USER_STATUS.APPROVED,
    })
  } catch (error) {
    // Si dos pedidos del mismo teléfono entran casi al mismo tiempo, reintentamos
    // buscando el cliente ya creado para evitar duplicados visibles.
    const concurrentUsers = await User.find({
      role: USER_ROLES.CLIENT,
      $or: phoneConditions,
    }).sort({ createdAt: 1 })

    if (concurrentUsers.length > 0) {
      return consolidateClientUsersByPhone({
        users: concurrentUsers,
        normalizedPhone,
        name,
        address,
        location,
      })
    }

    throw error
  }
}

export const createLocalStaffUser = async ({ name, phone, username, password, requestedRole }) => {
  const normalizedUsername = String(username || '').toLowerCase().trim()
  if (!normalizedUsername || !password) {
    throw new Error('Usuario y contraseña son obligatorios')
  }

  if (![USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR].includes(requestedRole)) {
    throw new Error('Rol no válido')
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
    status: USER_STATUS.APPROVED,
  })
}

export const authenticateLocalStaffUser = async ({ username, password, requestedRole }) => {
  const normalizedIdentifier = String(username || '').toLowerCase().trim()
  
  let query = { username: normalizedIdentifier }
  if (requestedRole === USER_ROLES.ADMIN) {
    const escapedIdentifier = normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regexIdentifier = new RegExp(`^${escapedIdentifier}$`, 'i')
    query = {
      $or: [
        { username: regexIdentifier },
        { email: regexIdentifier }
      ]
    }
  }

  const user = await User.findOne(query)

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

export const listUsersByRole = async (role) => {
  const allowedRoles = [USER_ROLES.CLIENT, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]
  if (!allowedRoles.includes(role)) return []

  const query = { role }
  if (role !== USER_ROLES.CLIENT) query.status = USER_STATUS.APPROVED
  return User.find(query).sort({ createdAt: -1 })
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

export const deleteUser = async (userId) => {
  return User.findByIdAndDelete(userId)
}

export const updateStaffUser = async (userId, { name, phone, role, password }) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('Usuario no encontrado')

  if (name) user.name = name
  if (phone) user.phone = normalizePhone(phone)
  if (role) user.role = role
  if (password) user.passwordHash = hashPassword(password)

  await user.save()
  return user
}

