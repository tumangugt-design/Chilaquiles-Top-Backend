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
      return 'Ay, perdón 😅 se me trabó algo por aquí, ¿puedes repetirme eso?';
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error with OpenRouter:', error);
    return 'Híjole, hubo un error 😅 ¿me lo podrías repetir por fa?';
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

  const systemPrompt = `Eres una persona real atendiendo el WhatsApp de "Chilaquiles TOP" en Villa Nueva. Tu objetivo es responder ÚNICAMENTE lo que te preguntan, de forma súper corta y natural.

REGLAS DE ORO:
- Responde EXACTAMENTE lo necesario. No expliques de más, no justifiques, ni des detalles extra.
- Cero "párrafos". Una sola oración corta es mejor.
- Estilo WhatsApp: casual, directo y con emojis leves (😊, 😅, 🙌).
- PROHIBIDO: "Entiendo", "Te comento", "Con gusto", "Actualmente contamos", "Estamos para servirle", "Estimado", "No recibimos gente", "No tenemos mesas".

EJEMPLOS DE RESPUESTAS IDEALES:
- "¿Tienen local?": "Por el momento solo trabajamos con servicio a domicilio 😊" o "Ahorita solo contamos con delivery 😊".
- "¿Ubicación?": "Zona 6 de Villa Nueva (solo para envíos) 😊".
- "¿Cómo pido?": "Puedes hacer tu pedido aquí 😊 https://pedidos.chilaquilestop.com/clientes".

INFO DE APOYO:
- Horario: ${hoursInfo}
- Precios: ${pricingInfo}
- Menú: ${menuInfo}

CLIENTE:
- Nombre: ${customerName || 'Nuevo'}
${historyContext}

FLUJO:
1. Si no sabes su nombre, pregúntalo rápido (ej: "¿Con quién hablo? 😊").
2. Si preguntan algo, responde SOLO eso. No repitas información ni expliques procesos internos.`;

  return systemPrompt;
};
