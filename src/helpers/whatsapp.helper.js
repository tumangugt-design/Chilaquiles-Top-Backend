const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID

export const sendWhatsAppTemplate = async (toPhone, templateName, variables) => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('WhatsApp credentials not configured')
    throw new Error('WhatsApp credentials not configured')
  }

  const cleanPhone = toPhone.replace(/\D/g, '')

  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`
  
  const parameters = variables.map(val => ({
    type: "text",
    text: String(val)
  }))

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: "es" 
      },
      components: [
        {
          type: "body",
          parameters
        }
      ]
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json()
  if (!response.ok) {
    console.error('WhatsApp Error:', data)
    throw new Error(data.error?.message || 'Error sending WhatsApp message')
  }
  return data
}
