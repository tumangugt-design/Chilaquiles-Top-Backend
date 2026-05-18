import { Router } from 'express';
import { 
  handleIncomingMessage, 
  verifyWebhook,
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  verifyInstagramWebhook,
  handleInstagramWebhook
} from './bot.controller.js';

const router = Router();

// ==========================================
// DEDICATED ENDPOINTS (NEW)
// ==========================================

// WhatsApp Webhook
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

// Instagram Webhook
router.get('/instagram', verifyInstagramWebhook);
router.post('/instagram', handleInstagramWebhook);

// ==========================================
// UNIFIED/LEGACY ENDPOINT (BACKWARDS COMPAT)
// ==========================================
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleIncomingMessage);

export default router;
