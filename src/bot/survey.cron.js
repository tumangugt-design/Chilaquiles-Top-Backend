import cron from 'node-cron';
import Order from '../orders/order.model.js';
import { sendSurveyFlowMessage } from './whatsapp.service.js';

export const runSurveyCheck = async () => {
  try {
    const now = new Date();
    
    const pendingOrders = await Order.find({
      status: 'entregado',
      surveyStatus: 'PENDING',
      surveySendAt: { $lte: now, $ne: null }
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
        const result = await sendSurveyFlowMessage(order.phone, {
          orderId: order._id,
          orderNumber: order.orderNumber
        });
        
        order.set('whatsappMessages.survey', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error, wamid: result.wamid });
        order.surveyStatus = 'SENT';
      } catch (error) {
        console.error(`[Survey Cron] Failed to send survey to order ${order._id}:`, error.message);
        order.set('whatsappMessages.survey', { sent: false, sentAt: new Date(), method: 'unknown', error: error.message });
        order.surveyStatus = 'FAILED';
      }
      await order.save();
    }
  } catch (error) {
    console.error('[Survey Cron] Error executing cron task:', error.message);
  }
};

export const initSurveyCron = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await runSurveyCheck();
  });

  console.log('[Survey Cron] Initialized.');
};
