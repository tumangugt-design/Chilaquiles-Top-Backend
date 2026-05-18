import dotenv from 'dotenv';
dotenv.config();

export const sendInstagramMessage = async (recipientId, text) => {
  const token = process.env.IG_ACCESS_TOKEN;

  if (!token) {
    throw new Error('IG_ACCESS_TOKEN is not configured');
  }

  const url = 'https://graph.instagram.com/v25.0/me/messages';

  console.log('[Instagram Send] Target URL:', url);
  console.log('[Instagram Send] Recipient ID:', recipientId);
  console.log('[Instagram Send] Token configured:', Boolean(token));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: {
          id: recipientId,
        },
        message: {
          text,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Instagram Send] Meta API Error Response:', JSON.stringify(data, null, 2));
      throw new Error(`Meta API returned status ${response.status}: ${data?.error?.message || 'Unknown error'}`);
    }

    console.log('[Instagram Send] Message sent successfully:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('[Instagram Send] Exception while sending message:', error);
    throw error;
  }
};
