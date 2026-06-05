export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "getFinancialSummary",
      description: "Resumen financiero OFICIAL: ventas, costos, utilidades desglosado por día, semana, mes y global. Usar SIEMPRE para preguntas de dinero/ingresos/ganancias.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getOrders",
      description: "Busca pedidos individuales. Para totales de dinero usa getFinancialSummary. Esta es SOLO para detalles de pedidos, buscar por cliente, filtrar por estado, o analizar ingredientes consumidos.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Fecha inicio ISO (ej: 2026-05-15T00:00:00.000Z)" },
          endDate: { type: "string", description: "Fecha fin ISO, EXCLUSIVO ($lt)" },
          status: { type: "string", description: "Estado exacto: 'recibido', 'en_proceso', 'listo_para_despacho', 'recolectado', 'en_camino', 'entregado', 'cancelado'. Sin filtro = excluye cancelados." },
          customerName: { type: "string", description: "Nombre del cliente a buscar" },
          limit: { type: "number", description: "Límite de resultados (máx 500)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getInventory",
      description: "Inventario actual: stock, precios por porción, costos internos, estado activo/inactivo. Incluye datos de porciones (cuánto se usa por plato y costo por porción).",
      parameters: {
        type: "object",
        properties: {
          itemName: { type: "string", description: "Nombre del ingrediente (ej: pollo, steak, salsa roja). Vacío = todo el inventario." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getSettings",
      description: "Configuración completa del sistema: horarios semanales, fechas especiales, rangos de cierre, estado actual (abierto/cerrado).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "updateOperatingHours",
      description: "Modifica los horarios del restaurante. Puede cambiar horario semanal, agregar fechas especiales (cerrar/abrir un día específico), o rangos de fechas. Envía SOLO los campos que se quieren cambiar.",
      parameters: {
        type: "object",
        properties: {
          weekly: {
            type: "object",
            description: "Horario semanal. Llaves: sunday, monday, tuesday, wednesday, thursday, friday, saturday. Cada día: { isOpen: boolean, openTime: 'HH:MM', closeTime: 'HH:MM', note: 'opcional' }. Envía SOLO los días que se quieren modificar."
          },
          specialDates: {
            type: "object",
            description: "Excepciones por fecha específica. Llave = fecha 'YYYY-MM-DD', valor = { isOpen: boolean, openTime: 'HH:MM', closeTime: 'HH:MM', note: 'razón' }. Ej: { '2026-06-10': { isOpen: false, note: 'Cerrado por fumigación' } }"
          },
          dateRanges: {
            type: "array",
            description: "Rangos de fechas con horario especial. Array de { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', isOpen: boolean, openTime, closeTime, note }."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getUsers",
      description: "Lista usuarios del sistema. Puede filtrar por rol (CLIENT, ADMIN, CHEF, REPARTIDOR) o buscar un cliente por teléfono.",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", description: "Filtrar por rol: CLIENT, ADMIN, CHEF, REPARTIDOR" },
          phone: { type: "string", description: "Buscar cliente por número de teléfono" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getPromotions",
      description: "Lista las promociones/banners activos configurados en el sistema.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getCoupons",
      description: "Lista todos los cupones de descuento: código, porcentaje, usos máximos, usos actuales, si está activo.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getCalculatorCosts",
      description: "Costos internos configurados: costos de ingredientes, márgenes, gastos operativos para la calculadora de precios.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getInventoryLogs",
      description: "Historial de movimientos del inventario: entradas (compras), salidas (ventas), ajustes. Incluye precios de compra, cantidades y fechas.",
      parameters: {
        type: "object",
        properties: {
          ingredientName: { type: "string", description: "Filtrar por nombre de ingrediente" },
          type: { type: "string", description: "Filtrar por tipo: 'IN' (entrada/compra), 'OUT' (salida/venta), 'ADJUSTMENT'" },
          limit: { type: "number", description: "Límite de resultados (máx 100)" }
        }
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
      return { role: 'assistant', content: 'Error al procesar la solicitud (respuesta vacía).' };
    }

    return data.choices[0].message;
  } catch (error) {
    console.error('Error with OpenRouter:', error);
    return { role: 'assistant', content: 'Error de conexión con el proveedor de IA.' };
  }
};

export const prepareAdminBotContext = (backendData) => {
  return `Eres el asistente administrativo de "Chilaquiles TOP". Hablas con un administrador con acceso total al sistema.

REGLAS:
1. Responde BREVE y DIRECTO. Solo lo que se preguntó. Sin explicaciones extras, sin recomendaciones no solicitadas, sin párrafos largos.
2. Usa herramientas para obtener datos reales. NUNCA inventes datos.
3. Para dinero/ventas/ingresos → usa getFinancialSummary SIEMPRE.
4. Para costos internos de platos → usa getInventory (incluye precio por porción) y getCalculatorCosts.
5. Para pedidos individuales/buscar cliente → usa getOrders.
6. Para horarios → usa getSettings para consultar, updateOperatingHours para modificar.
7. Formato moneda: Q seguido del monto (ej: Q18.75).
8. Cuando getOrders retorne _summary, usa esos totales directamente. NUNCA sumes manualmente.
9. Mantén contexto de la conversación.

${backendData}`;
};
