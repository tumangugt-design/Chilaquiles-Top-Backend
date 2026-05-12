import { Router } from 'express';
import { handleIncomingMessage, verifyWebhook } from './bot.controller.js';

const router = Router();

// GET for verification
router.get('/webhook', verifyWebhook);

// POST for receiving messages
router.post('/webhook', handleIncomingMessage);

export default router;
