import cron from 'node-cron';
import Order from '../orders/order.model.js';
import { sendSurveyFlowMessage } from './whatsapp.service.js';

export const initSurveyCron = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60000);
      
      const pendingOrders = await Order.find({
        status: 'entregado',
        surveyStatus: 'PENDING',
        deliveredAt: { $lte: thirtyFiveMinsAgo, $ne: null }
      });

      if (pendingOrders.length > 0) {
        console.log(`[Survey Cron] Found ${pendingOrders.length} orders ready for survey.`);
      }

      for (const order of pendingOrders) {
        if (!order.phone) {
          order.surveyStatus = 'FAILED';
          await order.save();
          continue;
        }

        try {
          await sendSurveyFlowMessage(order.phone, order._id);
          order.surveyStatus = 'SENT';
        } catch (error) {
          console.error(`[Survey Cron] Failed to send survey to order ${order._id}:`, error.message);
          // Podemos marcar como FAILED o dejarlo en PENDING para reintentar (mejor FAILED para evitar spam)
          order.surveyStatus = 'FAILED';
        }
        await order.save();
      }
    } catch (error) {
      console.error('[Survey Cron] Error executing cron task:', error.message);
    }
  });

  console.log('[Survey Cron] Initialized.');
};
