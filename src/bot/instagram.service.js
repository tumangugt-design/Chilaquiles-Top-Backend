import dotenv from 'dotenv';
dotenv.config();

export const sendInstagramMessage = async (to, text) => {
  const igAccountId = process.env.IG_ACCOUNT_ID;
  const url = `https://graph.facebook.com/v17.0/${igAccountId}/messages`;
  const token = process.env.IG_ACCESS_TOKEN;

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
    return data;
  } catch (error) {
    console.error('Error sending Instagram message:', error);
    throw error;
  }
};
