import dotenv from 'dotenv';
dotenv.config();

export const sendWhatsAppMessage = async (to, text) => {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
  const token = process.env.WHATSAPP_TOKEN;

  console.log(`[WhatsApp Send] Target URL: ${url}`);
  console.log(`[WhatsApp Send] Recipient Phone: ${to}`);

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
    const errorDetails = data.error?.error_data?.details || '';
    const code = data.error?.code;
    console.error('[WhatsApp Send] Meta API Error Response:', JSON.stringify(data, null, 2));
    
    const err = new Error(`Meta API returned status ${response.status}: ${data.error?.message || 'Unknown error'}`);
    err.code = code;
    throw err;
  }

  console.log('[WhatsApp Send] Message sent successfully:', JSON.stringify(data));
  return data;
};

export const sendWhatsAppTemplate = async (to, templateName, components = [], language = 'es_MX') => {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
  const token = process.env.WHATSAPP_TOKEN;

  console.log(`[WhatsApp Template] Sending ${templateName} to ${to}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[WhatsApp Template] API Error:', JSON.stringify(data, null, 2));
    const err = new Error(`Template API error: ${data.error?.message}`);
    err.code = data.error?.code;
    throw err;
  }

  console.log(`[WhatsApp Template] Sent successfully:`, JSON.stringify(data));
  return data;
};

export const sendOrderReceivedMessage = async (to, data, forceTemplate = false) => {
  const { customerName, orderNumber, orderSummary, orderTotal } = data;
  
  const text = `¡Pedido recibido! ✅\n\nHola ${customerName},\n\nTu pedido #${orderNumber} fue recibido correctamente.\n\nPedido:\n${orderSummary}\n\nTotal: ${orderTotal}\n\nTe avisaremos por este medio cuando tu pedido vaya en camino.\n\n¡Gracias por elegir Chilaquiles Top! 🌶️`;

  try {
    if (forceTemplate) {
      const err = new Error('Forced template');
      err.code = 131047;
      throw err;
    }
    await sendWhatsAppMessage(to, text);
    return { sent: true, method: 'normal', error: null };
  } catch (error) {
    if (error.code === 131047) {
      console.log('[Fallback] 24h window closed, trying template pedido_recibido');
      try {
        await sendWhatsAppTemplate(to, 'pedido_recibido', [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(customerName) },
              { type: "text", text: String(orderNumber) },
              { type: "text", text: String(orderSummary) },
              { type: "text", text: String(orderTotal) }
            ]
          }
        ]);
        return { sent: true, method: 'template', error: null };
      } catch (templateError) {
        return { sent: false, method: 'template', error: templateError.message };
      }
    }
    return { sent: false, method: 'normal', error: error.message };
  }
};

export const sendOrderEnRouteMessage = async (to, data, forceTemplate = false) => {
  const { orderNumber } = data;
  
  const text = `Tu pedido #${orderNumber} ya va en camino 🛵\n\nPronto estaremos llegando.`;

  try {
    if (forceTemplate) {
      const err = new Error('Forced template');
      err.code = 131047;
      throw err;
    }
    await sendWhatsAppMessage(to, text);
    return { sent: true, method: 'normal', error: null };
  } catch (error) {
    if (error.code === 131047) {
      console.log('[Fallback] 24h window closed, trying template pedido_en_camino');
      try {
        await sendWhatsAppTemplate(to, 'pedido_en_camino', [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(orderNumber) }
            ]
          }
        ]);
        return { sent: true, method: 'template', error: null };
      } catch (templateError) {
        return { sent: false, method: 'template', error: templateError.message };
      }
    }
    return { sent: false, method: 'normal', error: error.message };
  }
};

export const sendOrderDeliveredMessage = async (to, data, forceTemplate = false) => {
  const { orderNumber } = data;

  const text = `¡Pedido entregado! 📦🥡\nOrden #${orderNumber}\n\nPara que disfrutes de la mejor experiencia, te compartimos las instrucciones para calentar:\n\n• Toma los recipientes de salsa y proteína de un solo plato y colócalos en el microondas con la tapa puesta.\n• Calienta durante 2 minutos a potencia máxima.\n• Cuando quede aproximadamente 1 minuto, retira la proteína.\n• Continúa calentando únicamente la salsa hasta completar el tiempo.\n• Retira la salsa y agrégala sobre los chilaquiles antes de servir.\n• Repite este mismo proceso para cada plato en tu orden.\n\nCon esto garantizamos que la salsa esté lo suficientemente caliente para derretir el queso a la perfección y que tu proteína quede en su punto exacto 😮💨🤩\n\n¡Buen provecho! 👨🏼‍🍳`;

  try {
    if (forceTemplate) {
      const err = new Error('Forced template');
      err.code = 131047;
      throw err;
    }
    await sendWhatsAppMessage(to, text);
    return { sent: true, method: 'normal', error: null };
  } catch (error) {
    if (error.code === 131047) {
      console.log('[Fallback] 24h window closed, trying template pedido_entregado');
      try {
        await sendWhatsAppTemplate(to, 'pedido_entregado', [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(orderNumber) }
            ]
          }
        ], 'en');
        return { sent: true, method: 'template', error: null };
      } catch (templateError) {
        return { sent: false, method: 'template', error: templateError.message };
      }
    }
    return { sent: false, method: 'normal', error: error.message };
  }
};

export const sendSurveyFlowMessage = async (to, data) => {
  const { orderId, orderNumber } = data;
  const flowId = process.env.WHATSAPP_FLOW_ID;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  // Si enviamos dentro de la ventana de 24h, usamos mensaje interactivo estándar
  const sendNormalFlow = async () => {
    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
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
          header: { type: 'text', text: `Tus chilaquiles 🌶️` },
          body: { text: `Esperamos que hayas disfrutado tu pedido #${orderNumber} 🌶️\n\nNos ayudaría mucho conocer tu opinión.\n\nPresiona el botón para responder una encuesta rápida.` },
          footer: { text: 'Toma menos de 1 minuto.' },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: String(orderId),
              flow_id: flowId,
              flow_cta: 'Responder Encuesta',
              flow_action: 'navigate',
              flow_action_payload: {
                screen: 'QUESTION_ONE',
                data: {
                  order_id: String(orderId)
                }
              }
            }
          }
        }
      })
    });

    const respData = await response.json();
    if (!response.ok) {
      const err = new Error(`Flow API returned status ${response.status}: ${respData.error?.message}`);
      err.code = respData.error?.code;
      throw err;
    }
    return respData;
  };

  try {
    if (!flowId) throw new Error("No WHATSAPP_FLOW_ID defined");
    await sendNormalFlow();
    return { sent: true, method: 'normal_flow', error: null };
  } catch (error) {
    if (error.code === 131047) {
      console.log('[Fallback] 24h window closed, trying template encuesta_chilaquiles');
      try {
        await sendWhatsAppTemplate(to, 'encuesta_chilaquiles', [
          {
            type: "button",
            sub_type: "flow",
            index: "0",
            parameters: [
              {
                type: "action",
                action: {
                  flow_token: String(orderId)
                }
              }
            ]
          }
        ]);
        return { sent: true, method: 'template_flow', error: null };
      } catch (templateError) {
        console.error('[Survey Fallback] Failed to send fallback template:', templateError.message);
        return { sent: false, method: 'template_flow', error: templateError.message };
      }
    }
    console.error('[Survey Flow] Failed to send normal flow:', error.message);
    return { sent: false, method: 'normal_flow', error: error.message };
  }
};
