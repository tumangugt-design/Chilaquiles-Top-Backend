import axios from 'axios';

export const createPaymentLink = async ({ amount, description, orderNumber }) => {
  const baseUrl = process.env.PAGGO_BASE_URL || 'https://api.paggoapp.com/api';
  const apiKey = process.env.PAGGO_API_KEY;

  if (!apiKey) {
    console.error('[Paggo Service] Missing PAGGO_API_KEY in environment variables');
    throw new Error('Servicio de pago no configurado');
  }

  try {
    const response = await axios.post(
      `${baseUrl}/center/transactions/create-link`,
      {
        concept: description || `Pago Orden #${orderNumber}`,
        amount: Number(amount)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        }
      }
    );

    // Assuming response.data.url or response.data.link contains the payment link
    console.log('[Paggo Service] Link generated:', response.data);
    return response.data?.result?.link || response.data?.url || response.data?.link || response.data?.data?.url;
  } catch (error) {
    console.error('[Paggo Service] Error generating link:', error?.response?.data || error.message);
    throw new Error('No se pudo generar el link de pago');
  }
};
