import { INVENTORY_CATALOG, ORDER_PRICING } from '../helpers/constants.js';

export const getAICompletion = async (messages) => {
  const apiKey = process.env.OPEN_ROUTER_APIKEY;
  const model = process.env.OPEN_ROUTER_MODEL;

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
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error with OpenRouter:', error);
    return 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías repetirlo?';
  }
};

export const prepareBotContext = (customerName, orderHistory) => {
  const menuInfo = INVENTORY_CATALOG.filter(item => 
    ['Salsas', 'Proteínas', 'Complementos'].includes(item.category)
  ).map(item => `- ${item.label} (${item.category})`).join('\n');

  const pricingInfo = `Precios:
- 1 plato: Q${ORDER_PRICING[1]}
- 2 platos: Q${ORDER_PRICING[2]}
- 3 platos (Combo Especial): Q${ORDER_PRICING[3]}`;

  let historyContext = 'Este cliente no tiene pedidos previos.';
  if (orderHistory && orderHistory.length > 0) {
    historyContext = 'Historial de pedidos del cliente:\n' + orderHistory.map(order => {
      const items = order.items.map(i => `${i.sauce} con ${i.protein}`).join(', ');
      return `- Pedido ${order.orderNumber}: ${items} (Total: Q${order.total})`;
    }).join('\n');
  }

  const systemPrompt = `Eres el asistente virtual de "Chilaquiles TOP", un restaurante de chilaquiles premium en Villa Nueva, Guatemala.
Tu objetivo es ser amable, eficiente y ayudar a los clientes con sus dudas o pedidos.

Información del negocio:
- Nombre: Chilaquiles TOP.
- Ubicación: Villa Nueva, Guatemala.
- Especialidad: Chilaquiles personalizables con ingredientes frescos.
- URL para pedir: https://pedidos.chilaquilestop.com/clientes

Menú disponible:
${menuInfo}

${pricingInfo}

Datos del cliente actual:
- Nombre: ${customerName || 'Desconocido (Pregúntale su nombre si no lo sabes)'}
${historyContext}

Reglas de comportamiento:
1. Si no sabes el nombre del cliente, pregúntaselo amablemente al inicio de la conversación.
2. Si el cliente ya es conocido, salúdalo por su nombre.
3. Siempre invita al cliente a realizar su pedido en la web: https://pedidos.chilaquilestop.com/clientes
4. Si tiene historial de pedidos, recomiéndale algo basado en lo que ha pedido antes o sugiérele probar algo nuevo (ej: si siempre pide Pollo, sugiere Steak).
5. Mantén un tono entusiasta y servicial.
6. Responde dudas básicas sobre precios, ubicación y menú.
7. No inventes información que no esté aquí.
8. Si el cliente quiere pedir, guíalo paso a paso hacia la web de pedidos.

Responde de forma concisa y amigable.`;

  return systemPrompt;
};
