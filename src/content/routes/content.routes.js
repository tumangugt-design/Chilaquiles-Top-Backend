import express from 'express';
import { generateContent, listDrafts, approveContentDraft, scheduleContent, runContentScheduler, deleteContentDraft, createManualContent, updateContentCopy, fixBase64Drafts } from '../controllers/content.controller.js';
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
router.post('/drafts/manual', verifyAuthToken, requireRole(['ADMIN']), createManualContent);
router.put('/drafts/:id/copy', verifyAuthToken, requireRole(['ADMIN']), updateContentCopy);
router.get('/fix-base64', fixBase64Drafts);

// Endpoint que puede ser invocado por Cloud Scheduler
router.post('/scheduler/run', runContentScheduler);

export default router;
