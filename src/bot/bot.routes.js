import { Router } from 'express';
import { 
  handleIncomingMessage, 
  verifyWebhook,
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  verifyInstagramWebhook,
  handleInstagramWebhook
} from './bot.controller.js';
import { getTelegramBotInstance } from '../bots/telegram/telegram.bot.js';

import { verifyMetaSignature } from './metaSignature.middleware.js';

const router = Router();

// Telegram Webhook
router.post('/telegram-webhook', (req, res) => {
  const bot = getTelegramBotInstance();
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

// ==========================================
// DEDICATED ENDPOINTS (NEW)
// ==========================================

// WhatsApp Webhook
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', verifyMetaSignature, handleWhatsAppWebhook);

// Instagram Webhook
router.get('/instagram', verifyInstagramWebhook);
router.post('/instagram', verifyMetaSignature, handleInstagramWebhook);

// ==========================================
// UNIFIED/LEGACY ENDPOINT (BACKWARDS COMPAT)
// ==========================================
router.get('/webhook', verifyWebhook);
router.post('/webhook', verifyMetaSignature, handleIncomingMessage);

export default router;
