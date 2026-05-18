import dotenv from 'dotenv';
dotenv.config();

export const sendWhatsAppMessage = async (to, text) => {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
  const token = process.env.WHATSAPP_TOKEN;

  console.log(`[WhatsApp Send] Target URL: ${url}`);
  console.log(`[WhatsApp Send] Recipient Phone: ${to}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp Send] Meta API Error Response:', JSON.stringify(data, null, 2));
      throw new Error(`Meta API returned status ${response.status}: ${data.error?.message || 'Unknown error'}`);
    }

    console.log('[WhatsApp Send] Message sent successfully:', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('[WhatsApp Send] Exception while sending message:', error);
    throw error;
  }
};
