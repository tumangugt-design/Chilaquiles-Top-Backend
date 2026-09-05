import axios from 'axios';

export const createPaymentLink = async ({ amount, description, orderNumber }) => {
  const baseUrl = process.env.RECURRENTE_BASE_URL || 'https://app.recurrente.com/api';
  const secretKey = process.env.RECURRENTE_SECRET_KEY;
  const frontendUrl = process.env.CUSTOMER_FRONTEND_URL || 'https://pedidos.chilaquilestop.com';

  if (!secretKey) {
    console.error('[Recurrente Service] Missing RECURRENTE_SECRET_KEY in environment variables');
    throw new Error('Servicio de pago no configurado');
  }

  try {
    const response = await axios.post(
      `${baseUrl}/checkouts`,
      {
        items: [
          {
            name: description || `Pago Orden #${orderNumber}`,
            amount_in_cents: Math.round(Number(amount) * 100),
            currency: 'GTQ',
            quantity: 1
          }
        ],
        success_url: `${frontendUrl}/?payment=success&order=${orderNumber}`,
        cancel_url: `${frontendUrl}/?payment=cancelled&order=${orderNumber}`
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-SECRET-KEY': secretKey
        }
      }
    );

    console.log('[Recurrente Service] Checkout created:', response.data);
    return response.data?.checkout_url;
  } catch (error) {
    console.error('[Recurrente Service] Error creating checkout:', error?.response?.data || error.message);
    throw new Error('No se pudo generar el link de pago');
  }
};
