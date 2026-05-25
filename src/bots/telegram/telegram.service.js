import Order from '../../orders/order.model.js';
import Inventory from '../../inventory/inventory.model.js';
import { isOperatingNow } from '../../settings/settings.service.js';
import { getAdminAICompletion, prepareAdminBotContext } from './telegram.ai.js';

/**
 * Obtiene el estado actual de la base de datos para pasárselo al LLM en cada consulta.
 * Como el LLM (Gemini) tiene ventana de contexto grande y esto es de uso administrativo,
 * es mejor pasarle toda la información relevante activa.
 */
const fetchContextData = async (text) => {
  let dataContext = '';

  try {
    // 1. Obtener TODOS los pedidos pendientes
    const pendingOrders = await Order.find({ status: { $ne: 'ENTREGADO' } })
      .select('orderNumber status total name items createdAt');
    
    dataContext += `[PEDIDOS PENDIENTES (Total: ${pendingOrders.length})]\n`;
    pendingOrders.forEach(o => {
      dataContext += `- Pedido ${o.orderNumber}: Estado=${o.status}, Total=Q${o.total}, Cliente=${o.name}\n`;
    });
    dataContext += '\n';

    // 2. Obtener TODO el inventario activo
    const allItems = await Inventory.find({ isActive: true });
    dataContext += `[INVENTARIO Y STOCK ACTUAL]\n`;
    allItems.forEach(item => {
      dataContext += `- ${item.name}: ${item.stock} ${item.unit} (Mínimo: ${item.minimumStock})\n`;
    });
    dataContext += '\n';

    // 3. Obtener resumen de ventas del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentOrders = await Order.find({ createdAt: { $gte: today }, status: 'ENTREGADO' });
    const totalSales = recentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    dataContext += `[VENTAS Y ENTREGAS DE HOY]\n`;
    dataContext += `- Pedidos completados/entregados hoy: ${recentOrders.length}\n`;
    dataContext += `- Ingresos totales hoy: Q${totalSales}\n`;
    // 4. Obtener horario y estado de apertura actual
    const operatingHours = await isOperatingNow();
    dataContext += `[HORARIO Y ESTADO DEL RESTAURANTE]\n`;
    if (operatingHours.isOpen) {
      dataContext += `- Estado Actual: ${operatingHours.isCurrentlyOpen ? 'ABIERTO' : 'CERRADO'}\n`;
      dataContext += `- Horario de hoy: ${operatingHours.openTime} a ${operatingHours.closeTime}\n`;
    } else {
      dataContext += `- Estado Actual: CERRADO todo el día.\n`;
    }

  } catch (err) {
    console.error('Error fetching context data for Telegram Bot:', err);
    dataContext = 'Hubo un error obteniendo los datos de la base de datos. Pide al admin que revise los logs.';
  }

  return dataContext;
};

/**
 * Procesa un mensaje de texto para el bot administrativo
 */
export const processAdminMessage = async (text) => {
  try {
    // 1. Recopilar datos del backend basados en la pregunta
    const backendData = await fetchContextData(text);

    // 2. Preparar el prompt
    const systemPrompt = prepareAdminBotContext(backendData);

    // 3. Construir mensajes para la IA
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ];

    // 4. Obtener la respuesta de la IA
    const aiResponse = await getAdminAICompletion(messages);
    
    return aiResponse;
  } catch (error) {
    console.error('Error in Admin Bot Service:', error);
    return 'Ocurrió un error al procesar tu solicitud.';
  }
};
