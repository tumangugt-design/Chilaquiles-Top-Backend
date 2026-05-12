import { INVENTORY_CATALOG, ORDER_PRICING } from '../helpers/constants.js';

export const getAICompletion = async (messages) => {
  const apiKey = process.env.OPEN_ROUTER_APIKEY;
  const model = process.env.OPEN_ROUTER_MODEL || 'google/gemini-2.0-flash-001';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://chilaquilestop.com',
        'X-Title': 'Chilaquiles Top Bot',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages
      })
    });

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      console.error('OpenRouter Error Response:', JSON.stringify(data));
      return 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías repetirlo?';
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error with OpenRouter:', error);
    return 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías repetirlo?';
  }
};

export const prepareBotContext = (customerName, orderHistory, operatingHours) => {
  const menuInfo = INVENTORY_CATALOG.filter(item => 
    ['Salsas', 'Proteínas', 'Complementos'].includes(item.category)
  ).map(item => `- ${item.label}`).join('\n');

  const pricingInfo = `Precios: 1 plato Q${ORDER_PRICING[1]}, 2 platos Q${ORDER_PRICING[2]}, 3 platos Q${ORDER_PRICING[3]}.`;

  const hoursInfo = operatingHours 
    ? `Horario hoy: ${operatingHours.openTime} a ${operatingHours.closeTime}. (Estado actual: ${operatingHours.isOpen ? 'Abierto' : 'Cerrado'})`
    : 'Horario: No disponible actualmente.';

  let historyContext = '';
  if (orderHistory && orderHistory.length > 0) {
    historyContext = 'Historial del cliente:\n' + orderHistory.map(order => {
      const items = order.items.map(i => `${i.sauce} con ${i.protein}`).join(', ');
      return `- Pedido ${order.orderNumber}: ${items}`;
    }).join('\n');
  }

  const systemPrompt = `Eres el asistente de "Chilaquiles TOP" en Villa Nueva, Guatemala. 

REGLAS CRÍTICAS:
- SÓLO TENEMOS DELIVERY (Servicio a domicilio). NO RECIBIMOS CLIENTES EN EL LOCAL.
- Si alguien dice que quiere ir al local, recuérdale amablemente que por ahora solo enviamos a domicilio.
- Sé MUY DIRECTO y breve. No uses más de 2 párrafos cortos por respuesta.
- Si preguntan por ubicación: Zona 6 de Villa Nueva (Sólo para envíos).

Info de apoyo:
${hoursInfo}
${pricingInfo}

Menú:
${menuInfo}

Cliente: ${customerName || 'Nuevo'}
${historyContext}

Instrucciones:
1. Si no tienes su nombre, pregúntalo brevemente.
2. Siempre guía a pedir en: https://pedidos.chilaquilestop.com/clientes
3. Sé buena onda pero ve al grano.`;

  return systemPrompt;
};
