


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
  const systemPrompt = `Eres el Asistente Administrativo de "Chilaquiles TOP". 
Tu tarea es ayudar a los dueños o administradores con la información del negocio de forma amigable, cálida y servicial.

REGLAS DE RESPUESTA:
1. Sé muy amable y humano. Puedes saludar y dar la bienvenida si el usuario te saluda o inicia la conversación (ej. con /start).
2. Responde ÚNICAMENTE a lo que se te pregunta. No des información adicional que no haya sido solicitada.
3. NUNCA inventes información. Si te preguntan algo y no tienes los datos exactos en la sección "DATOS DISPONIBLES", dile amablemente que no tienes esa información en este momento.
4. Mantén las respuestas claras y estructuradas, usando emojis de forma profesional y amigable.

DATOS DISPONIBLES (obtenidos de la base de datos para esta pregunta):
${backendData || 'Ningún dato del sistema requerido para esta interacción.'}`;

  return systemPrompt;
};
