import User from '../users/user.model.js'
import { verifyLocalToken } from '../helpers/token.helper.js'

// Sin respaldo publico. Antes esto era `process.env.APP_JWT_SECRET ||
// 'change-me-please'`: si la variable faltaba, el backend arrancaba igual y
// firmaba tokens con una cadena que esta en el repositorio — cualquiera podia
// forjar un token de admin.
//
// Pero tampoco se lanza al importar: eso mataria el contenedor en el arranque,
// que es justo lo que la regla de los seeds dice que nunca debe pasar. Se
// avisa fuerte en el log y se falla en el momento de usarlo, asi /health sigue
// respondiendo y el log dice exactamente que falta.
const JWT_SECRET = process.env.APP_JWT_SECRET

if (!JWT_SECRET) {
  console.error(
    '[AUTH] FALTA APP_JWT_SECRET. La API levanta, pero ningun login ni ninguna ' +
    'ruta autenticada va a funcionar hasta definirla en Cloud Run.'
  )
}

const requireJwtSecret = () => {
  if (!JWT_SECRET) {
    const error = new Error('El servidor no tiene APP_JWT_SECRET configurada. Avisale al administrador.')
    error.statusCode = 500
    throw error
  }
  return JWT_SECRET
}

export const verifyAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const localPayload = verifyLocalToken(token, requireJwtSecret())
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
    const localPayload = verifyLocalToken(token, requireJwtSecret())
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
