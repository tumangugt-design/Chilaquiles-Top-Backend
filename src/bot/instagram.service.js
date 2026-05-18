import dotenv from 'dotenv';
dotenv.config();

export const sendInstagramMessage = async (to, text) => {
  const igAccountId = process.env.IG_ACCOUNT_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  
  // Use 'me' if igAccountId is not set, which is the standard Meta endpoint
  const targetId = igAccountId || 'me';
  const url = `https://graph.facebook.com/v17.0/${targetId}/messages`;

  console.log(`[Instagram Send] Target URL: ${url}`);
  console.log(`[Instagram Send] Recipient ID: ${to}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: { text: text }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Instagram Send] Meta API Error Response:', JSON.stringify(data, null, 2));
      throw new Error(`Meta API returned status ${response.status}: ${data.error?.message || 'Unknown error'}`);
    }

    console.log('[Instagram Send] Message sent successfully:', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('[Instagram Send] Exception while sending message:', error);
    throw error;
  }
};
