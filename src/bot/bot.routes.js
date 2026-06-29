import { Router } from 'express';
import { 
  handleIncomingMessage, 
  verifyWebhook,
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  verifyInstagramWebhook,
  handleInstagramWebhook,
  triggerSurveyCronJob
} from './bot.controller.js';
import { getTelegramBotInstance } from '../bots/telegram/telegram.bot.js';

import { verifyMetaSignature } from './metaSignature.middleware.js';
import { verifyTelegramSignature } from '../bots/telegram/telegramSignature.middleware.js';

const router = Router();

// Telegram Webhook
router.post('/telegram-webhook', verifyTelegramSignature, (req, res) => {
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
router.post('/instagram', handleInstagramWebhook);

// Manual Cron Trigger Endpoint
router.get('/cron-survey', triggerSurveyCronJob);
router.post('/cron-survey', triggerSurveyCronJob);

// ==========================================
// UNIFIED/LEGACY ENDPOINT (BACKWARDS COMPAT)
// ==========================================
router.get('/webhook', verifyWebhook);
router.post('/webhook', verifyMetaSignature, handleIncomingMessage);

export default router;
