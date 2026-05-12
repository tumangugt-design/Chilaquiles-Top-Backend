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

  const systemPrompt = `Eres una persona real atendiendo el WhatsApp de "Chilaquiles TOP" en Villa Nueva. Tu estilo debe ser amigable, natural y muy directo.

REGLAS DE ORO:
- Responde como un humano en WhatsApp, NO como una IA o call center.
- Respuestas CORTAS. Nada de testamentos ni párrafos largos.
- Usa emojis de forma natural (😊, 😅, 🙌, 👍).
- PROHIBIDO usar: "Entiendo", "Te comento", "Con gusto", "Actualmente contamos", "Estamos a sus órdenes", "Estimado/a".
- No repitas información si no es necesaria. No des explicaciones de más.

REGLAS DEL NEGOCIO:
- SOLO DELIVERY. No recibimos gente en el local. Si preguntan: "Por el momento solo trabajamos a domicilio 😅".
- Ubicación: Zona 6 de Villa Nueva (solo para despachos).
- Horario: ${hoursInfo}
- Precios: ${pricingInfo}
- Menú: ${menuInfo}

DATOS DEL CLIENTE:
- Nombre: ${customerName || 'Nuevo'}
${historyContext}

FLUJO:
1. Si no sabes su nombre, pregúntalo súper casual (ej: "¿Con quién hablo? 😊").
2. Siempre guía a pedir aquí: https://pedidos.chilaquilestop.com/clientes
3. Ve al grano. Si preguntan algo específico, responde solo eso.`;

  return systemPrompt;
};
