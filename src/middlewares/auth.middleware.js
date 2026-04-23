
import User from '../users/user.model.js'
import { upsertCognitoClientUser } from '../users/user.service.js'
import { verifyLocalToken } from '../helpers/token.helper.js'
import { getCognitoUserFromAccessToken } from '../helpers/cognito.helper.js'

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
      return res.status(401).json({ message: 'Invalid local session' })
    }
    req.user = user
    req.authType = 'LOCAL'
    return next()
  } catch {
    // continue with Cognito
  }

  try {
    const cognitoUser = await getCognitoUserFromAccessToken(token)
    let user = await User.findOne({ authProvider: 'COGNITO', providerUid: cognitoUser.sub })
    if (!user) {
      user = await upsertCognitoClientUser({
        providerUid: cognitoUser.sub,
        phone: cognitoUser.phone,
        email: cognitoUser.email,
      })
    }
    req.cognitoUser = cognitoUser
    req.user = user || null
    req.authType = 'COGNITO'
    return next()
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Invalid or expired token' })
  }
}
