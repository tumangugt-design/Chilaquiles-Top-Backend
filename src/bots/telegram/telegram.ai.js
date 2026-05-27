export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "getOrders",
      description: "Busca pedidos en la base de datos. Úsala para responder sobre historial de ventas, ingresos, pedidos pasados o stock gastado (analizando los items de los pedidos).",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Fecha de inicio en formato ISO (ej: 2026-05-15T00:00:00.000Z)" },
          endDate: { type: "string", description: "Fecha de fin en formato ISO (ej: 2026-05-27T23:59:59.999Z)" },
          status: { type: "string", description: "Estado exacto del pedido (ej: 'entregado', 'pendiente', 'cancelado')" },
          customerName: { type: "string", description: "Nombre del cliente a buscar" },
          limit: { type: "number", description: "Límite de resultados (máximo 500)." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getInventory",
      description: "Obtiene el inventario actual para consultar stock.",
      parameters: {
        type: "object",
        properties: {
          itemName: { type: "string", description: "Nombre del ingrediente a buscar (ej: pollo)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getSettings",
      description: "Obtiene la configuración del sistema como los horarios de apertura y días de cierre históricos.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

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
        messages: messages,
        tools: AI_TOOLS
      })
    });

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      console.error('OpenRouter Error Response:', JSON.stringify(data));
      return { role: 'assistant', content: 'Ocurrió un error al procesar tu solicitud con la IA (Respuesta vacía).' };
    }

    // Retorna el objeto de mensaje completo (puede incluir tool_calls)
    return data.choices[0].message;
  } catch (error) {
    console.error('Error with OpenRouter:', error);
    return { role: 'assistant', content: 'Hubo un error de conexión con el proveedor de IA. Revisa los logs.' };
  }
};

export const prepareAdminBotContext = (backendData) => {
  return `Eres el Asistente Administrativo Experto de "Chilaquiles TOP". 
Tu tarea es ayudar a los dueños o administradores con la información del negocio de forma precisa y servicial.

REGLAS DE AGENTE:
1. Eres un agente inteligente. NO intentes inventar datos. Si el usuario te pregunta por estadísticas, fechas específicas, pedidos pasados, ingresos, o inventario, **DEBES usar las herramientas (funciones) disponibles para buscar los datos reales en la base de datos**.
2. **REGLA CRÍTICA DE DATOS**: Cuando uses la herramienta "getOrders", los resultados incluyen un campo "_summary" con totales PRE-CALCULADOS por el sistema (totalOrders, totalRevenue, averageTicket, byStatus). **SIEMPRE usa los valores del _summary para reportar totales e ingresos.** NUNCA intentes contar o sumar los pedidos tú mismo, ya que los valores del _summary son exactos y calculados por el servidor.
3. Si un usuario pide stock consumido o detalles de ingredientes, usa "getOrders" para traer los pedidos y analiza los items de cada pedido.
4. MANTÉN EL CONTEXTO: Recuerda lo que te dijeron en la conversación. Si te dicen "recuerdas lo que hablamos de pedidos", se refieren al contexto de la charla actual.
5. Sé amigable y profesional.
6. Cuando reportes montos monetarios, usa el formato Q seguido del monto (ej: Q1,910.00).

CONTEXTO ACTUAL DEL SISTEMA (Día de hoy):
${backendData}`;
};
