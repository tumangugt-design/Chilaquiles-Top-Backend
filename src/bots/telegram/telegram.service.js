import Order from '../../orders/order.model.js';
import Inventory from '../../inventory/inventory.model.js';
import InventoryLog from '../../inventory/inventoryLog.model.js';
import Portion from '../../inventory/portion.model.js';
import User from '../../users/user.model.js';
import Setting from '../../settings/settings.model.js';
import { isOperatingNow, getOperatingHoursSetting, updateOperatingHoursSetting } from '../../settings/settings.service.js';
import { getAdminAICompletion, prepareAdminBotContext } from './telegram.ai.js';
import TelegramBotMemory from './bot_memory.model.js';
import { getFinancialSummary } from '../../finances/finances.service.js';
import { createDraftFromIdea } from '../../content/services/content.service.js';

const fetchContextData = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingOrders = await Order.countDocuments({ status: { $ne: 'entregado' } });
    const todayDelivered = await Order.countDocuments({ createdAt: { $gte: today }, status: 'entregado' });
    const operatingHours = await isOperatingNow();
    
    return `Estado: ${operatingHours.isCurrentlyOpen ? 'ABIERTO' : 'CERRADO'} | Pendientes: ${pendingOrders} | Entregados hoy: ${todayDelivered} | Ahora: ${new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}`;
  } catch (err) {
    return 'Error obteniendo contexto.';
  }
};

const executeTool = async (toolCall) => {
  const name = toolCall.function.name;
  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return "Error: JSON inválido en argumentos.";
  }

  try {
    if (name === 'getFinancialSummary') {
      const summary = await getFinancialSummary();
      return JSON.stringify({
        note: "DATOS EXACTOS del panel administrativo. Usa estos números directamente.",
        ...summary
      });
    }

    else if (name === 'getOrders') {
      const filter = {};
      if (args.startDate || args.endDate) {
        filter.createdAt = {};
        if (args.startDate) filter.createdAt.$gte = new Date(args.startDate);
        if (args.endDate) filter.createdAt.$lt = new Date(args.endDate);
      }
      if (args.status) {
        filter.status = args.status;
      } else {
        filter.status = { $ne: 'cancelado' };
      }
      if (args.customerName) filter.name = { $regex: args.customerName, $options: 'i' };
      
      const limit = args.limit ? Math.min(args.limit, 500) : 100;
      const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const orderCount = orders.length;
      const averageTicket = orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0;

      const byStatus = {};
      for (const o of orders) {
        const st = o.status || 'desconocido';
        if (!byStatus[st]) byStatus[st] = { count: 0, revenue: 0 };
        byStatus[st].count += 1;
        byStatus[st].revenue += (o.total || 0);
      }

      const compactOrders = orders.map(o => ({
        orderNumber: o.orderNumber,
        name: o.name,
        phone: o.phone,
        items: (o.items || []).map(i => `${i.sauce} + ${i.protein} + ${i.complement}`),
        itemCount: (o.items || []).length,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt
      }));

      return JSON.stringify({
        _summary: {
          totalOrders: orderCount,
          totalRevenue,
          averageTicket,
          byStatus,
          note: "Totales pre-calculados. Usa estos directamente, NO re-sumes."
        },
        orders: compactOrders
      });
    }

    else if (name === 'getInventory') {
      const filter = args.itemName ? { name: { $regex: args.itemName, $options: 'i' } } : {};
      const items = await Inventory.find(filter).lean();
      const portions = await Portion.find(args.itemName ? { name: { $regex: args.itemName, $options: 'i' } } : {}).lean();

      // Merge inventory with portion data for complete cost info
      const portionMap = Object.fromEntries(portions.map(p => [p.name, p]));
      const enriched = items.map(item => {
        const portion = portionMap[item.name];
        return {
          name: item.name,
          stock: item.stock,
          unit: item.unit,
          category: item.category,
          isActive: item.isActive,
          minimumStock: item.minimumStock,
          lastPrice: item.lastPrice,
          lastPurchaseQty: item.lastPurchaseQty,
          lastPurchaseUnit: item.lastPurchaseUnit,
          lastPurchaseTotalPrice: item.lastPurchaseTotalPrice,
          portion: portion ? {
            usedPerPlate: portion.usedPerPlate,
            unit: portion.unit,
            pricePerPortion: portion.price
          } : null
        };
      });

      return JSON.stringify(enriched);
    }

    else if (name === 'getSettings') {
      const operatingHours = await isOperatingNow();
      const fullSettings = await getOperatingHoursSetting();
      return JSON.stringify({ currentStatus: operatingHours, fullSchedule: fullSettings });
    }

    else if (name === 'updateOperatingHours') {
      // Merge the incoming partial update with current settings
      const current = await getOperatingHoursSetting();
      const payload = { ...current };

      if (args.weekly) {
        payload.weekly = { ...current.weekly, ...args.weekly };
      }
      if (args.specialDates) {
        payload.specialDates = { ...(current.specialDates || {}), ...args.specialDates };
      }
      if (args.dateRanges) {
        payload.dateRanges = args.dateRanges;
      }

      const updated = await updateOperatingHoursSetting(payload);
      const newStatus = await isOperatingNow();
      return JSON.stringify({ message: "Horario actualizado correctamente.", updatedSchedule: updated, currentStatus: newStatus });
    }

    else if (name === 'getUsers') {
      if (args.phone) {
        const user = await User.findOne({ phone: { $regex: args.phone, $options: 'i' } }).lean();
        return JSON.stringify(user || { error: "No se encontró usuario con ese teléfono." });
      }
      if (args.role) {
        const users = await User.find({ role: args.role.toUpperCase() }).lean();
        return JSON.stringify({ count: users.length, users: users.map(u => ({ name: u.name, phone: u.phone, role: u.role, status: u.status })) });
      }
      // All users summary
      const counts = {};
      const roles = ['CLIENT', 'ADMIN', 'CHEF', 'REPARTIDOR'];
      for (const role of roles) {
        counts[role] = await User.countDocuments({ role });
      }
      counts.total = await User.countDocuments({});
      return JSON.stringify(counts);
    }

    else if (name === 'getPromotions') {
      const doc = await Setting.findOne({ key: 'promotions' });
      return JSON.stringify(doc ? doc.value : []);
    }

    else if (name === 'getCoupons') {
      const doc = await Setting.findOne({ key: 'coupons' });
      return JSON.stringify(doc ? doc.value : []);
    }

    else if (name === 'getCalculatorCosts') {
      const doc = await Setting.findOne({ key: 'calculator_costs' });
      return JSON.stringify(doc ? doc.value : {});
    }

    else if (name === 'getInventoryLogs') {
      const filter = {};
      if (args.ingredientName) filter.ingredientName = { $regex: args.ingredientName, $options: 'i' };
      if (args.type) filter.type = args.type;
      const limit = args.limit ? Math.min(args.limit, 100) : 20;

      const logs = await InventoryLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      const compact = logs.map(l => ({
        ingredient: l.ingredientName,
        type: l.type,
        amount: l.amount,
        unit: l.storedUnit || l.inputUnit,
        totalPrice: l.totalPrice || l.price,
        portionPrice: l.portionPrice,
        previousStock: l.previousStock,
        newStock: l.newStock,
        reason: l.reason,
        date: l.createdAt
      }));
      return JSON.stringify(compact);
    }

    else if (name === 'generateContentDraft') {
      const draft = await createDraftFromIdea({
        topic: args.topic,
        objective: args.objective || 'sales',
        platforms: args.platforms || ['instagram', 'facebook'],
        formats: args.formats || ['feed']
      }, null);
      
      return JSON.stringify({
        message: "¡Borrador generado con éxito! El arte visual y los textos están listos en el panel de Estudio de Contenido.",
        draftId: draft._id,
        title: draft.title,
        copy: draft.copy.main || draft.copy.caption,
        imageUrl: draft.visual?.imageUrl || 'No se generó imagen'
      });
    }

    else {
      return `Error: Herramienta ${name} no encontrada.`;
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

    let memory = await TelegramBotMemory.findOne({ chatId: chatId.toString() });
    if (!memory) {
      memory = new TelegramBotMemory({ chatId: chatId.toString(), messages: [] });
    }
    
    let history = (memory.messages || []).map(m => ({ role: m.role, content: m.content }));
    if (history.length > 10) history = history.slice(-10);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: text }
    ];

    let finalResponse = "No pude completar la consulta.";
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[Agent] Iteration ${iterations}...`);
      
      const aiMessage = await getAdminAICompletion(messages);
      
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        messages.push(aiMessage);

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
        finalResponse = aiMessage.content;
        break;
      }
    }

    if (!memory.messages) memory.messages = [];
    memory.messages.push({ role: 'user', content: text });
    if (finalResponse) {
      memory.messages.push({ role: 'assistant', content: finalResponse });
    }
    
    if (memory.messages.length > 12) {
      memory.messages = memory.messages.slice(-12);
    }
    await memory.save();

    return finalResponse || "Consulta completada.";
  } catch (error) {
    console.error('Error in Admin Agent Loop:', error);
    return 'Error procesando la solicitud.';
  }
};
