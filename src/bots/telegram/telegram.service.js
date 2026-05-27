import Order from '../../orders/order.model.js';
import Inventory from '../../inventory/inventory.model.js';
import { isOperatingNow, getOperatingHoursSetting } from '../../settings/settings.service.js';
import { getAdminAICompletion, prepareAdminBotContext } from './telegram.ai.js';
import BotMemory from './bot_memory.model.js';

const fetchContextData = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingOrders = await Order.countDocuments({ status: { $ne: 'entregado' } });
    const todayDelivered = await Order.countDocuments({ createdAt: { $gte: today }, status: 'entregado' });
    const operatingHours = await isOperatingNow();
    
    return `Estado Actual: ${operatingHours.isCurrentlyOpen ? 'ABIERTO' : 'CERRADO'}. Pedidos Pendientes: ${pendingOrders}. Entregados hoy: ${todayDelivered}. Fecha/Hora actual servidor: ${new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}`;
  } catch (err) {
    return 'Error obteniendo contexto básico.';
  }
};

const executeTool = async (toolCall) => {
  const name = toolCall.function.name;
  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return "Error: Invalid JSON arguments.";
  }

  try {
    if (name === 'getOrders') {
      const filter = {};
      if (args.startDate || args.endDate) {
        filter.createdAt = {};
        if (args.startDate) filter.createdAt.$gte = new Date(args.startDate);
        if (args.endDate) filter.createdAt.$lte = new Date(args.endDate);
      }
      if (args.status) filter.status = args.status;
      if (args.customerName) filter.name = { $regex: args.customerName, $options: 'i' };
      
      const limit = args.limit ? Math.min(args.limit, 500) : 100;
      const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      return JSON.stringify(orders);
    }
    else if (name === 'getInventory') {
      const filter = args.itemName ? { name: { $regex: args.itemName, $options: 'i' } } : {};
      const items = await Inventory.find(filter).lean();
      return JSON.stringify(items);
    }
    else if (name === 'getSettings') {
      const operatingHours = await isOperatingNow();
      const fullSettings = await getOperatingHoursSetting();
      return JSON.stringify({ operatingHours, fullSettings });
    }
    else {
      return `Error: Tool ${name} not found.`;
    }
  } catch (err) {
    console.error('Error executing tool:', err);
    return `Error ejecutando ${name}: ${err.message}`;
  }
};

export const processAdminMessage = async (text, chatId) => {
  try {
    const backendData = await fetchContextData();
    const systemPrompt = prepareAdminBotContext(backendData);

    let memory = await BotMemory.findOne({ chatId: chatId.toString() });
    if (!memory) {
      memory = new BotMemory({ chatId: chatId.toString(), messages: [] });
    }
    
    // Preparar historial
    let history = (memory.messages || []).map(m => ({ role: m.role, content: m.content }));
    if (history.length > 10) history = history.slice(-10);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: text }
    ];

    let finalResponse = "Lo siento, no pude completar el análisis.";
    let iterations = 0;
    const maxIterations = 4; // Límite para evitar bucles infinitos

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[Agent] Iteration ${iterations}...`);
      
      const aiMessage = await getAdminAICompletion(messages);
      
      // Si hay tool calls, ejecutamos
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        messages.push(aiMessage); // Agregamos la llamada al historial temporal

        for (const toolCall of aiMessage.tool_calls) {
          console.log(`[Agent] Executing tool: ${toolCall.function.name}`);
          const result = await executeTool(toolCall);
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result
          });
        }
      } else {
        // Respuesta final de texto
        finalResponse = aiMessage.content;
        break;
      }
    }

    // Guardar SOLO el texto inicial del usuario y la respuesta final en la BD para evitar romper el schema
    if (!memory.messages) memory.messages = [];
    memory.messages.push({ role: 'user', content: text });
    if (finalResponse) {
      memory.messages.push({ role: 'assistant', content: finalResponse });
    }
    
    if (memory.messages.length > 12) {
      memory.messages = memory.messages.slice(-12);
    }
    await memory.save();

    return finalResponse || "Análisis completado sin comentarios adicionales.";
  } catch (error) {
    console.error('Error in Admin Agent Loop:', error);
    return 'Ocurrió un error al procesar tu solicitud como agente inteligente.';
  }
};
