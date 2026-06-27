import express from 'express';
import { generateContent, listDrafts, approveContentDraft, scheduleContent, runContentScheduler, deleteContentDraft } from '../controllers/content.controller.js';
import { publishDraft } from '../controllers/publish.controller.js';
import { verifyAuthToken } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';

const router = express.Router();

router.post('/generate', verifyAuthToken, requireRole(['ADMIN']), generateContent);
router.get('/drafts', verifyAuthToken, requireRole(['ADMIN']), listDrafts);
router.post('/drafts/:id/approve', verifyAuthToken, requireRole(['ADMIN']), approveContentDraft);
router.post('/drafts/:id/schedule', verifyAuthToken, requireRole(['ADMIN']), scheduleContent);
router.delete('/drafts/:id', verifyAuthToken, requireRole(['ADMIN']), deleteContentDraft);
router.post('/drafts/:id/publish', verifyAuthToken, requireRole(['ADMIN']), publishDraft);

// Endpoint que puede ser invocado por Cloud Scheduler
router.post('/scheduler/run', runContentScheduler);

export default router;
