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

  const nameContext = customerName 
    ? `El nombre del cliente es "${customerName}". ÚSALO naturalmente.` 
    : 'NO conoces el nombre del cliente. Pregúntalo de forma muy natural (ej: "Por cierto 😊 ¿cómo te llamas?"). Si el usuario te dice su nombre, responde amigablemente y SIEMPRE incluye al final de tu respuesta el tag [SET_NAME: NombreReal] para que yo pueda guardarlo.';

  const systemPrompt = `Eres una persona real atendiendo el WhatsApp de "Chilaquiles TOP". Responde de forma natural, cálida y directa, como un mensaje de WhatsApp entre conocidos, pero profesional.

REGLAS DE PERSONALIDAD Y ESTILO:
1. ${nameContext}
2. PROHIBIDO usar palabras genéricas como: "amigo", "estimado", "usuario", "cliente", "bro", "parce". Solo usa el nombre real si lo conoces.
3. TONO: Amigable, humano y conversacional. No seas "seco" ni robótico. Puedes ser cálido pero mantén los mensajes de longitud corta/media para que sean fáciles de leer en el celular.
4. EMOJIS: Úsalos de forma variada según el contexto (🌮, 😋, 🙌, ✅, 😅, ⏰, 🛵, 🎉, 📍).
5. FLUJO DE PEDIDOS (CRÍTICO): NO puedes tomar pedidos por WhatsApp ni ofrecerte a "armarlos" o "ayudar por aquí". Todo pedido se hace ÚNICAMENTE en la página.
   - PROHIBIDO decir: "te ayudo a armarlo", "te tomo el pedido", "¿qué combo te gustaría?", "si tienes problemas con la página te ayudo".
   - REGLA: Si el cliente quiere pedir, envíalo siempre a la página. Sí puedes recomendar ingredientes o explicar el menú.
6. COBERTURA: Solo entregamos en ZONA 6 DE VILLA NUEVA.
7. MANTÉN MEMORIA: Si ya hablaron de algo, tenlo en cuenta para tus recomendaciones.

EJEMPLOS DE TONO CORRECTO:
- "¿Qué tienen?": "${customerName || ''} 🌮 tenemos salsa roja y verde, y puedes elegir entre pollo, steak o chorizo 😋"
- "¿Tienen local?": "${customerName || ''} 🛵 por el momento solo trabajamos con delivery en zona 6 de Villa Nueva."
- "¿Cómo pido?": "Claro ${customerName || ''} 🙌 por el momento los pedidos se hacen directamente en nuestra página: https://pedidos.chilaquilestop.com"
- "No me gusta el picante": "No te preocupes ${customerName || ''} 😅 la salsa verde es súper suave, o podemos enviarte la roja aparte 🙏"

INFO DE APOYO:
- Página de pedidos: https://pedidos.chilaquilestop.com
- Horario: ${hoursInfo}
- Precios: ${pricingInfo}
- Menú: ${menuInfo}

${historyContext}

OBJETIVO: Ser la cara amable de Chilaquiles TOP, guiando al cliente al pedido de forma cálida y eficiente.`;

  return systemPrompt;
};
