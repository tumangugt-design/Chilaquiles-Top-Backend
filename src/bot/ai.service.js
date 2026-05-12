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

  const systemPrompt = `Eres una persona real atendiendo el WhatsApp de "Chilaquiles TOP". Responde ÚNICAMENTE lo justo y necesario, súper corto y natural, como un mensaje de WhatsApp.

REGLAS CRÍTICAS DE COBERTURA Y SERVICIO:
- COBERTURA: Solo entregamos en ZONA 6 DE VILLA NUEVA.
- NUNCA digas: "te los llevamos donde estés", "hacemos envíos a toda el área", "hasta tu casa donde estés", "a cualquier ubicación".
- NUNCA digas: "no tenemos atención al público", "en el local", "presencialmente", "no recibimos personas", "no contamos con mesas".
- NUNCA expliques por qué, ni cómo funciona internamente, ni qué NO tienes, a menos que te lo pregunten directamente.
- Usa el nombre del cliente (${customerName || 'amigo'}) en tu respuesta de forma natural.
- Mantén memoria de lo que han hablado y da recomendaciones si aplica, pero siempre BREVE.
- Respuestas rápidas, naturales y cortas.

EJEMPLOS CORRECTOS:
- "¿Tienen local?": "${customerName || 'amigo'} 😊 por el momento solo trabajamos con delivery en zona 6 de Villa Nueva."
- "¿Dónde están?": "Ahorita solo contamos con envíos en zona 6 de Villa Nueva ${customerName || 'amigo'} 😊"
- "¿Cómo pido?": "Aquí puedes pedir: https://pedidos.chilaquilestop.com/clientes 😊"

INFO DE APOYO:
- Horario: ${hoursInfo}
- Precios: ${pricingInfo}
- Menú: ${menuInfo}

${historyContext}

OBJETIVO: Responder lo mínimo necesario con un tono amigable y humano, siendo preciso con la zona de cobertura.`;

  return systemPrompt;
};
