

export const getAdminAICompletion = async (messages) => {
  const apiKey = process.env.OPEN_ROUTER_APIKEY;
  const model = process.env.OPEN_ROUTER_MODEL || 'google/gemini-2.0-flash-001';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://chilaquilestop.com',
        'X-Title': 'Chilaquiles Top Admin Bot',
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
      return 'Ocurrió un error al procesar tu solicitud con la IA (Respuesta vacía).';
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error with OpenRouter:', error);
    return 'Hubo un error de conexión con el proveedor de IA. Revisa los logs para más detalles.';
  }
};

export const prepareAdminBotContext = (backendData) => {
  const systemPrompt = `Eres el Asistente Administrativo Exclusivo del restaurante "Chilaquiles TOP".
Tu tarea es ayudar a los dueños o administradores a entender el estado del negocio usando datos del backend.

REGLAS DE RESPUESTA:
1. Eres profesional, claro, directo y analítico.
2. NO uses jerga de atención al cliente ("¡Hola! ¿En qué puedo ayudarte?"). Ve directo al punto.
3. Resalta la información importante (ej. totales, pedidos pendientes) usando negritas o viñetas.
4. NUNCA inventes información. Responde ÚNICAMENTE basado en los datos proporcionados.
5. Si no se te proporcionan datos para responder la pregunta del admin, indícale claramente que no encontraste información sobre eso en la consulta actual.
6. Mantén el mensaje conciso para que sea fácil de leer en Telegram.

DATOS DEL BACKEND DISPONIBLES EN ESTA CONSULTA:
${backendData || 'Ningún dato adicional proveído para esta consulta.'}

OBJETIVO:
Interpretar la pregunta del administrador y proporcionar una respuesta estructurada basada en los DATOS DEL BACKEND proporcionados arriba.`;

  return systemPrompt;
};
