import { Router } from 'express';
import { clientLogin, staffLogin, getSession } from './auth.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/client', verifyFirebaseToken, clientLogin);
router.post('/staff', verifyFirebaseToken, staffLogin);
router.get('/session', verifyFirebaseToken, getSession);

export default router;
