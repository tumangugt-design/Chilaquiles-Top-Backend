import { processIncomingMessage } from './bot.service.js';
import Order from '../orders/order.model.js';
import { generateOrderSummary } from '../orders/order.service.js';
import { sendOrderReceivedMessage, sendOrderEnRouteMessage, sendOrderDeliveredMessage } from './whatsapp.service.js';

// ==========================================
// WHATSAPP WEBHOOK CONTROLLERS (DEDICATED)
// ==========================================

export const verifyWhatsAppWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[WhatsApp Webhook Verify] Mode:', mode, 'Token:', token);

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook Verify] Success!');
      return res.status(200).send(challenge);
    } else {
      console.error('[WhatsApp Webhook Verify] Invalid verify token');
    }
  }
  res.sendStatus(403);
};

export const handleWhatsAppWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log('[WhatsApp Webhook Recv] Body:', JSON.stringify(body));

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // Phone number

        if (message.type === 'interactive' && message.interactive?.type === 'nfm_reply') {
          try {
            const responseJson = message.interactive.nfm_reply.response_json;
            console.log(`[WhatsApp Webhook Recv] Flow reply from ${from}: ${responseJson}`);
            const data = JSON.parse(responseJson);

            let order = null;
            if (data.order_id) {
              order = await Order.findById(data.order_id);
            }
            if (!order) {
              order = await Order.findOne({ phone: from, status: 'ENTREGADO', surveyStatus: { $ne: 'COMPLETED' } }).sort({ deliveredAt: -1 });
            }
            
            if (order) {
              order.surveyResponses = {
                order_ok: data.order_ok || null,
                food_rating: data.food_rating || null,
                ordering_experience: data.ordering_experience || null,
                respondedAt: new Date()
              };
              order.surveyStatus = 'COMPLETED';
              await order.save();
              console.log(`[WhatsApp Webhook Recv] Survey saved for order ${order._id}`);
              // No enviamos mensaje de agradecimiento para no exceder los 4 mensajes automatizados
            } else {
              console.log(`[WhatsApp Webhook Recv] No pending survey found for ${from}`);
            }
          } catch (err) {
            console.error('[WhatsApp Webhook Recv] Error processing flow reply:', err);
          }
        } else {
          const text = message.text ? message.text.body : '';

          if (text) {
          console.log(`[WhatsApp Webhook Recv] Processing message from ${from}: "${text}"`);
          try {
            await processIncomingMessage(from, text, 'whatsapp');
          } catch (err) {
            console.error('[WhatsApp Webhook Recv] Error during processing, but returning 200 to prevent Meta retries:', err);
          }
          } else {
            console.log('[WhatsApp Webhook Recv] Message body is empty or non-text type event');
          }
        }
      } else if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.statuses &&
        body.entry[0].changes[0].value.statuses[0]
      ) {
        const statusObj = body.entry[0].changes[0].value.statuses[0];
        if (statusObj.status === 'failed' && statusObj.errors?.[0]?.code === 131047) {
          const phone = statusObj.recipient_id;
          console.log(`[WhatsApp Webhook Recv] Intercepted async 131047 error for ${phone}. Triggering fallback...`);
          try {
            const order = await Order.findOne({ phone: `+${phone}` }).sort({ updatedAt: -1 });
            if (order) {
              const summary = generateOrderSummary(order.items);
              const data = {
                customerName: order.name,
                orderNumber: order.orderNumber,
                orderSummary: summary,
                orderTotal: `Q${order.total.toFixed(2)}`
              };
              
              if (order.status === 'RECIBIDO') {
                const result = await sendOrderReceivedMessage(`+${phone}`, data, true);
                order.set('whatsappMessages.orderReceived', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error });
              } else if (order.status === 'EN_CAMINO') {
                const result = await sendOrderEnRouteMessage(`+${phone}`, data, true);
                order.set('whatsappMessages.orderOnTheWay', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error });
              } else if (order.status === 'ENTREGADO') {
                const result = await sendOrderDeliveredMessage(`+${phone}`, data, true);
                order.set('whatsappMessages.orderDelivered', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error });
              }
              await order.save();
            }
          } catch (err) {
            console.error('[WhatsApp Webhook Recv] Error during async fallback:', err);
          }
        }
      } else {
        console.log('[WhatsApp Webhook Recv] Webhook event received but has no messages array');
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      console.warn('[WhatsApp Webhook Recv] Received non-whatsapp object type:', body.object);
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[WhatsApp Webhook Recv] Error handling WhatsApp webhook wrapper:', error);
    res.status(200).send('EVENT_RECEIVED'); // Return 200 even on general error to stop Meta retries
  }
};

// ==========================================
// INSTAGRAM WEBHOOK CONTROLLERS (DEDICATED)
// ==========================================

export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Instagram Webhook Verify] Mode:', mode, 'Token:', token);

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) {
      console.log('[Instagram Webhook Verify] Success!');
      return res.status(200).send(challenge);
    } else {
      console.error('[Instagram Webhook Verify] Invalid verify token');
    }
  }
  res.sendStatus(403);
};

export const handleInstagramWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log('[Instagram Webhook Recv] Body:', JSON.stringify(body));

    if (body.object === 'instagram') {
      if (
        body.entry &&
        body.entry[0].messaging &&
        body.entry[0].messaging[0] &&
        body.entry[0].messaging[0].message
      ) {
        const message = body.entry[0].messaging[0].message;
        const from = body.entry[0].messaging[0].sender.id;
        const text = message.text || '';

        if (text) {
          console.log(`[Instagram Webhook Recv] Processing message from ${from}: "${text}"`);
          try {
            await processIncomingMessage(from, text, 'instagram');
          } catch (err) {
            console.error('[Instagram Webhook Recv] Error during processing, but returning 200 to prevent Meta retries:', err);
          }
        } else {
          console.log('[Instagram Webhook Recv] Message body is empty or non-text type event');
        }
      } else {
        console.log('[Instagram Webhook Recv] Webhook event received but has no messaging array');
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      console.warn('[Instagram Webhook Recv] Received non-instagram object type:', body.object);
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[Instagram Webhook Recv] Error handling Instagram webhook wrapper:', error);
    res.status(200).send('EVENT_RECEIVED'); // Return 200 even on general error to stop Meta retries
  }
};

// ==========================================
// LEGACY WEBHOOK CONTROLLERS (BACKWARDS COMPATIBILITY)
// ==========================================

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Legacy Webhook Verify] Mode:', mode, 'Token:', token);

  if (mode && token) {
    if (mode === 'subscribe' && (token === process.env.WHATSAPP_VERIFY_TOKEN || token === process.env.IG_VERIFY_TOKEN)) {
      console.log('[Legacy Webhook Verify] Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};

export const handleIncomingMessage = async (req, res) => {
  try {
    const body = req.body;
    console.log('[Legacy Webhook Recv] Body:', JSON.stringify(body));

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; 

        if (message.type === 'interactive' && message.interactive?.type === 'nfm_reply') {
          try {
            const responseJson = message.interactive.nfm_reply.response_json;
            const data = JSON.parse(responseJson);
            
            let order = null;
            if (data.order_id) {
              order = await Order.findById(data.order_id);
            }
            if (!order) {
              order = await Order.findOne({ phone: from, status: 'ENTREGADO', surveyStatus: { $ne: 'COMPLETED' } }).sort({ deliveredAt: -1 });
            }

            if (order) {
              order.surveyResponses = {
                order_ok: data.order_ok || null,
                food_rating: data.food_rating || null,
                ordering_experience: data.ordering_experience || null,
                respondedAt: new Date()
              };
              order.surveyStatus = 'COMPLETED';
              await order.save();
            }
          } catch (err) {
            console.error('[Legacy Webhook Recv] Error processing flow reply:', err);
          }
        } else {
          const text = message.text ? message.text.body : '';
          if (text) {
            try {
              await processIncomingMessage(from, text, 'whatsapp');
            } catch (err) {
              console.error('[Legacy Webhook Recv] WhatsApp processing error:', err);
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else if (body.object === 'instagram') {
      if (
        body.entry &&
        body.entry[0].messaging &&
        body.entry[0].messaging[0] &&
        body.entry[0].messaging[0].message
      ) {
        const message = body.entry[0].messaging[0].message;
        const from = body.entry[0].messaging[0].sender.id;
        const text = message.text || '';

        if (text) {
          try {
            await processIncomingMessage(from, text, 'instagram');
          } catch (err) {
            console.error('[Legacy Webhook Recv] Instagram processing error:', err);
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[Legacy Webhook Recv] Error handling webhook wrapper:', error);
    res.status(200).send('EVENT_RECEIVED'); // Return 200 even on general error to stop Meta retries
  }
};
