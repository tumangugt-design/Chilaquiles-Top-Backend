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

export const sendOrderReceivedMessage = async (to) => {
  const text = "¡Pedido recibido! ✅\n\nGracias por ordenar en Chilaquiles Top. Te avisaremos por este medio cuando tu pedido vaya en camino.";
  return sendWhatsAppMessage(to, text).catch(err => console.error('Error enviando msj #1', err.message));
};

export const sendOrderEnRouteMessage = async (to) => {
  const text = "Tu pedido ya va en camino 🛵\n\nPronto estaremos llegando con tus chilaquiles.";
  return sendWhatsAppMessage(to, text).catch(err => console.error('Error enviando msj #2', err.message));
};

export const sendOrderDeliveredMessage = async (to, isCold = false) => {
  let text = "¡Pedido entregado! 🌶️\n\nPara disfrutar mejor tus chilaquiles:\n\n";
  text += "Instrucciones para calentar tu salsa de la mejor manera:\n";
  text += "1️⃣ Mete los 3 botes de salsa y carne al microondas con la tapadera.\n";
  text += "2️⃣ Coloca 2 minutos con la potencia al máximo.\n";
  text += "3️⃣ Cuando quede 1 minuto, retira tu proteína.\n";
  text += "4️⃣ Cierra de nuevo el microondas y dejas que termine la salsa.\n";
  text += "5️⃣ Retira la salsa y aplica completamente sobre tus chilaquiles.";
  
  if (isCold) {
    text += "\n\n(Tu pedido incluyó salsa fría. Por favor, asegúrate de calentarla muy bien siguiendo las instrucciones o en una ollita antes de servirla).";
  }

  return sendWhatsAppMessage(to, text).catch(err => console.error('Error enviando msj #3', err.message));
};

export const sendSurveyFlowMessage = async (to, orderId) => {
  const flowId = process.env.WHATSAPP_FLOW_ID;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!flowId) {
    // Alternativa temporal si no hay flow
    const text = "Esperamos que hayas disfrutado tus chilaquiles 🌶️\n\nQueremos hacerte 3 preguntas rápidas para ayudarnos a mejorar. Por favor, responde a este mensaje con 3 palabras, por ejemplo: 'Sí, Buenísima, Fácil'.\n\n1. ¿Todo estuvo bien con tu pedido? (Sí/No)\n2. ¿Cómo calificarías la comida? (Buenísima/Normal/Mala)\n3. ¿Cómo calificarías la forma en que realizaste tu pedido? (Fácil/Difícil)";
    return sendWhatsAppMessage(to, text).catch(err => console.error('Error enviando msj #4 fallback', err.message));
  }

  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'flow',
          header: {
            type: 'text',
            text: 'Tus chilaquiles 🌶️'
          },
          body: {
            text: 'Esperamos que hayas disfrutado tus chilaquiles. Queremos hacerte 3 rápidas preguntas para ayudarnos a mejorar.'
          },
          footer: {
            text: 'Toma menos de 1 minuto.'
          },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: String(orderId),
              flow_id: flowId,
              flow_cta: 'Responder Encuesta',
              flow_action: 'navigate',
              flow_action_payload: {
                screen: 'SURVEY'
              }
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[WhatsApp Send Flow] Meta API Error Response:', JSON.stringify(data, null, 2));
      throw new Error(`Meta API returned status ${response.status}: ${data.error?.message}`);
    }
    console.log('[WhatsApp Send Flow] Flow Message sent successfully:', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('[WhatsApp Send Flow] Exception while sending flow:', error);
    throw error;
  }
};
