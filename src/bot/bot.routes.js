import { Router } from 'express';
import { verifyCronToken } from '../middlewares/cron.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';
import { verifyAuthToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

// Cada mensaje entrante dispara una llamada al LLM, que cuesta. Techo por IP.
const limiteBot = rateLimit({ ventanaMs: 60 * 1000, maximo: 60, nombre: 'bot-webhook' });
import { 
  handleIncomingMessage, 
  verifyWebhook,
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  verifyInstagramWebhook,
  handleInstagramWebhook,
  triggerSurveyCronJob, listBotConversations, getBotConversation } from './bot.controller.js';
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
router.post('/whatsapp', limiteBot, verifyMetaSignature, handleWhatsAppWebhook);

// Instagram Webhook
router.get('/instagram', verifyInstagramWebhook);
// La firma vuelve (se habia quitado en 6d92ad2, 28-jun-2026): sin ella
// cualquiera podia POSTear haciendose pasar por el cliente que quisiera.
router.post('/instagram', limiteBot, verifyMetaSignature, handleInstagramWebhook);

// Manual Cron Trigger Endpoint
router.get('/cron-survey', verifyCronToken, triggerSurveyCronJob);
router.post('/cron-survey', verifyCronToken, triggerSurveyCronJob);

// ==========================================
// UNIFIED/LEGACY ENDPOINT (BACKWARDS COMPAT)
// ==========================================
router.get('/webhook', verifyWebhook);
router.post('/webhook', limiteBot, verifyMetaSignature, handleIncomingMessage);

// La pecera: solo lectura, solo admin. No existe endpoint para responderle a
// un cliente desde aca — la atencion la hace el bot.
router.get('/conversations', verifyAuthToken, requireRole([USER_ROLES.ADMIN]), listBotConversations);
router.get('/conversations/:platform/:contactId', verifyAuthToken, requireRole([USER_ROLES.ADMIN]), getBotConversation);

export default router;
