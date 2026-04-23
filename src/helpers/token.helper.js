
import crypto from 'crypto'

const base64UrlEncode = (input) => Buffer.from(input).toString('base64url')
const base64UrlDecode = (input) => Buffer.from(input, 'base64url').toString('utf-8')

export const signLocalToken = (payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(body))
  const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export const verifyLocalToken = (token, secret) => {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.')
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Token inválido')
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Firma inválida')
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado')
  }

  return payload
}
