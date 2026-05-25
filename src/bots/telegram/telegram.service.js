import Order from '../../orders/order.model.js';
import Inventory from '../../inventory/inventory.model.js';
import { getAdminAICompletion, prepareAdminBotContext } from './telegram.ai.js';

/**
 * Función sencilla para pre-procesar la consulta y extraer datos del backend relevantes
 */
const fetchContextData = async (text) => {
  const query = text.toLowerCase();
  let dataContext = '';

  try {
    // 1. Pedidos
    if (query.includes('pedido') || query.includes('orden')) {
      // Buscar el número de pedido si lo proveen (ej: 123)
      const orderMatch = query.match(/\d+/);
      if (orderMatch) {
        const orderNumberRegex = new RegExp(orderMatch[0], 'i');
        const orders = await Order.find({ orderNumber: orderNumberRegex }).limit(5);
        if (orders.length > 0) {
          dataContext += `[DATOS DE PEDIDO ESPECÍFICO]\n`;
          orders.forEach(o => {
            dataContext += `- Pedido ${o.orderNumber}: Estado=${o.status}, Total=Q${o.total}, Cliente=${o.name}\n`;
          });
        } else {
          dataContext += `[DATOS DE PEDIDO ESPECÍFICO]: No se encontró el pedido con número similar a ${orderMatch[0]}.\n`;
        }
      } else {
        // Pedidos pendientes
        const pendingOrders = await Order.find({ status: { $ne: 'ENTREGADO' } }).select('orderNumber status total name');
        dataContext += `[PEDIDOS PENDIENTES]\nTotal de pedidos pendientes: ${pendingOrders.length}\n`;
        pendingOrders.forEach(o => {
          dataContext += `- Pedido ${o.orderNumber}: Estado=${o.status}, Total=Q${o.total}, Cliente=${o.name}\n`;
        });
      }
    }

    // 2. Inventario y Stock
    if (query.includes('stock') || query.includes('inventario') || query.includes('producto') || query.includes('hay de')) {
      const allItems = await Inventory.find({ isActive: true });
      dataContext += `[INVENTARIO ACTUAL]\n`;
      
      // Si pregunta por un producto en específico, el LLM buscará en esta lista
      allItems.forEach(item => {
        dataContext += `- ${item.name}: ${item.stock} ${item.unit} (Categoría: ${item.category})\n`;
      });
    }

    // 3. Ventas de la semana/hoy (Básico)
    if (query.includes('venta') || query.includes('ganancia') || query.includes('ingreso')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recentOrders = await Order.find({ createdAt: { $gte: today }, status: 'ENTREGADO' });
      const totalSales = recentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      dataContext += `[VENTAS DE HOY]\nPedidos entregados hoy: ${recentOrders.length}\nTotal de ingresos hoy: Q${totalSales}\n`;
    }

    // Fallback: si no detectamos ninguna palabra clave clara, no enviamos contexto
    if (!dataContext) {
      dataContext = '';
    }

  } catch (err) {
    console.error('Error fetching context data for Telegram Bot:', err);
    dataContext = 'Hubo un error obteniendo los datos de la base de datos.';
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
