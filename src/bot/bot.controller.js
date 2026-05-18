import { processIncomingMessage } from './bot.service.js';

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
        const text = message.text ? message.text.body : '';

        if (text) {
          console.log(`[WhatsApp Webhook Recv] Processing message from ${from}: "${text}"`);
          await processIncomingMessage(from, text, 'whatsapp');
        } else {
          console.log('[WhatsApp Webhook Recv] Message body is empty or non-text type event');
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
    console.error('[WhatsApp Webhook Recv] Error handling WhatsApp webhook:', error);
    res.status(500).send('Internal Server Error');
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
          await processIncomingMessage(from, text, 'instagram');
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
    console.error('[Instagram Webhook Recv] Error handling Instagram webhook:', error);
    res.status(500).send('Internal Server Error');
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
        const text = message.text ? message.text.body : '';

        if (text) {
          await processIncomingMessage(from, text, 'whatsapp');
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
          await processIncomingMessage(from, text, 'instagram');
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[Legacy Webhook Recv] Error handling webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};
