import express from 'express';
import { generateContent, listDrafts, approveContentDraft, scheduleContent, runContentScheduler } from '../controllers/content.controller.js';
// We should import the authenticate token middleware
import { authenticateToken, authorizeRole } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/generate', authenticateToken, authorizeRole('ADMIN'), generateContent);
router.get('/drafts', authenticateToken, authorizeRole('ADMIN'), listDrafts);
router.post('/drafts/:id/approve', authenticateToken, authorizeRole('ADMIN'), approveContentDraft);
router.post('/drafts/:id/schedule', authenticateToken, authorizeRole('ADMIN'), scheduleContent);

// Endpoint que puede ser invocado por Cloud Scheduler
router.post('/scheduler/run', runContentScheduler);

export default router;
