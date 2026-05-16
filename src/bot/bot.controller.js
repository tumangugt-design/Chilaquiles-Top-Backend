import { processIncomingMessage } from './bot.service.js';

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && (token === process.env.WHATSAPP_VERIFY_TOKEN || token === process.env.IG_VERIFY_TOKEN)) {
      console.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};

export const handleIncomingMessage = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // WhatsApp ID / Phone number
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
    console.error('Error handling webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};
