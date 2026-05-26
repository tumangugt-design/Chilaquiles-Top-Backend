import net from 'node:net'
import tls from 'node:tls'

const DEFAULT_ADMIN_ORDER_EMAIL = [
  'drodriguez@chilaquilestop.com',
  'dulgv256@gmail.com',
]

const waitForConnect = (socket) => new Promise((resolve, reject) => {
  const onError = (error) => {
    cleanup()
    reject(error)
  }
  const onConnect = () => {
    cleanup()
    resolve()
  }
  const cleanup = () => {
    socket.off('error', onError)
    socket.off('connect', onConnect)
    socket.off('secureConnect', onConnect)
  }
  socket.once('error', onError)
  socket.once(socket.encrypted ? 'secureConnect' : 'connect', onConnect)
})

const createResponseReader = (socket) => {
  let buffer = ''

  return () => new Promise((resolve, reject) => {
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const last = lines[lines.length - 1]

      if (/^\d{3}\s/.test(last || '')) {
        socket.off('data', onData)
        socket.off('error', onError)
        const response = buffer
        buffer = ''
        const code = Number(last.slice(0, 3))
        resolve({ code, response })
      }
    }

    const onError = (error) => {
      socket.off('data', onData)
      reject(error)
    }

    socket.on('data', onData)
    socket.once('error', onError)
  })
}

const writeLine = (socket, line) => new Promise((resolve, reject) => {
  socket.write(`${line}\r\n`, (error) => (error ? reject(error) : resolve()))
})

const expectCode = async (readResponse, expected, action) => {
  const result = await readResponse()
  const allowed = Array.isArray(expected) ? expected : [expected]
  if (!allowed.includes(result.code)) {
    throw new Error(`SMTP error en ${action}: ${result.response}`)
  }
  return result
}

const escapeSmtpData = (text) => String(text || '').replace(/\r?\n\./g, '\r\n..')

const buildMessage = ({ from, to, subject, text }) => {
  const safeSubject = String(subject || 'Nuevo pedido Chilaquiles TOP').replace(/[\r\n]+/g, ' ')
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    escapeSmtpData(text),
  ].join('\r\n')
}

export const sendPlainEmail = async ({ to, subject, text }) => {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  const from = process.env.SMTP_FROM || user

  if (!host || !from || !to) {
    console.warn('[email] SMTP no configurado. Define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM para enviar correos.')
    return { skipped: true }
  }

  let socket = secure
    ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
    : net.connect({ host, port })

  await waitForConnect(socket)
  let readResponse = createResponseReader(socket)
  await expectCode(readResponse, 220, 'conexión')

  await writeLine(socket, 'EHLO chilaquilestop.com')
  const ehlo = await expectCode(readResponse, 250, 'EHLO')

  if (!secure && /STARTTLS/i.test(ehlo.response)) {
    await writeLine(socket, 'STARTTLS')
    await expectCode(readResponse, 220, 'STARTTLS')
    socket = tls.connect({ socket, servername: host, rejectUnauthorized: false })
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve)
      socket.once('error', reject)
    })
    readResponse = createResponseReader(socket)
    await writeLine(socket, 'EHLO chilaquilestop.com')
    await expectCode(readResponse, 250, 'EHLO TLS')
  }

  if (user && pass) {
    await writeLine(socket, 'AUTH LOGIN')
    await expectCode(readResponse, 334, 'AUTH LOGIN')
    await writeLine(socket, Buffer.from(user).toString('base64'))
    await expectCode(readResponse, 334, 'AUTH USER')
    await writeLine(socket, Buffer.from(pass).toString('base64'))
    await expectCode(readResponse, 235, 'AUTH PASS')
  }

  await writeLine(socket, `MAIL FROM:<${from.replace(/^.*<|>.*$/g, '')}>`)
  await expectCode(readResponse, 250, 'MAIL FROM')
  await writeLine(socket, `RCPT TO:<${to}>`)
  await expectCode(readResponse, [250, 251], 'RCPT TO')
  await writeLine(socket, 'DATA')
  await expectCode(readResponse, 354, 'DATA')
  await writeLine(socket, `${buildMessage({ from, to, subject, text })}\r\n.`)
  await expectCode(readResponse, 250, 'envío')
  await writeLine(socket, 'QUIT')
  socket.end()
  return { sent: true }
}

const formatOrderItem = (item, index) => {
  const base = []
  if (item.baseRecipe?.cream) base.push('Crema')
  if (item.baseRecipe?.onion) base.push('Cebolla')
  if (item.baseRecipe?.cilantro) base.push('Cilantro')

  return [
    `Plato ${index + 1}:`,
    `- Salsa: ${item.sauce}`,
    `- Proteína: ${item.protein}`,
    `- Complemento: ${item.complement}`,
    `- Base: ${base.length ? base.join(', ') : 'Sin base adicional'}`,
  ].join('\n')
}

export const notifyAdminNewOrder = async (order) => {
  const toList = process.env.ADMIN_ORDER_EMAIL
    ? process.env.ADMIN_ORDER_EMAIL.split(',').map(email => email.trim())
    : DEFAULT_ADMIN_ORDER_EMAIL

  const maps = order.navigationLinks?.googleMaps || ''
  const waze = order.navigationLinks?.waze || ''
  const items = Array.isArray(order.items) ? order.items : []

  const text = [
    'Nuevo pedido recibido en Chilaquiles TOP.',
    '',
    `Orden: ${order.orderNumber}`,
    `Cliente: ${order.name}`,
    `Teléfono: ${order.phone}`,
    `Dirección: ${order.address}`,
    order.accessCode ? `Código de acceso: ${order.accessCode}` : null,
    `Total: Q${Number(order.total || 0).toFixed(2)}`,
    maps ? `Google Maps: ${maps}` : null,
    waze ? `Waze: ${waze}` : null,
    '',
    'Detalle:',
    ...items.map(formatOrderItem),
  ].filter(Boolean).join('\n')

  return Promise.all(
    toList.map((to) =>
      sendPlainEmail({
        to,
        subject: `Nuevo pedido Chilaquiles TOP #${order.orderNumber}`,
        text,
      })
    )
  )
}
