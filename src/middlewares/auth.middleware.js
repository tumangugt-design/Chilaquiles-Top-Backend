import User from '../users/user.model.js'
import { verifyLocalToken } from '../helpers/token.helper.js'

const JWT_SECRET = process.env.APP_JWT_SECRET || 'change-me-please'

export const verifyAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const localPayload = verifyLocalToken(token, JWT_SECRET)
    const user = await User.findById(localPayload.sub)
    if (!user) {
      return res.status(401).json({ message: 'Invalid session' })
    }
    req.user = user
    req.authType = 'LOCAL'
    return next()
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Invalid or expired token' })
  }
}

export const optionalAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.split(' ')[1]

  try {
    const localPayload = verifyLocalToken(token, JWT_SECRET)
    const user = await User.findById(localPayload.sub)
    if (user) {
      req.user = user
      req.authType = 'LOCAL'
    }
  } catch (error) {
    // If token is invalid, just proceed as guest
  }
  return next()
}
