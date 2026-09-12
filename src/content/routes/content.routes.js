import express from 'express';
import { verifyCronToken } from '../../middlewares/cron.middleware.js';
import { generateContent, listDrafts, approveContentDraft, scheduleContent, runContentScheduler, deleteContentDraft, createManualContent, updateContentCopy, fixBase64Drafts, uploadPlate, sendWhatsApp } from '../controllers/content.controller.js';
import { publishDraft } from '../controllers/publish.controller.js';
import { verifyAuthToken } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { USER_ROLES } from '../../helpers/constants.js';

const router = express.Router();

router.post('/generate', verifyAuthToken, requireRole(['ADMIN']), generateContent);
router.get('/drafts', verifyAuthToken, requireRole(['ADMIN']), listDrafts);
router.post('/drafts/:id/approve', verifyAuthToken, requireRole(['ADMIN']), approveContentDraft);
router.post('/drafts/:id/schedule', verifyAuthToken, requireRole(['ADMIN']), scheduleContent);
router.delete('/drafts/:id', verifyAuthToken, requireRole(['ADMIN']), deleteContentDraft);
router.post('/drafts/:id/publish', verifyAuthToken, requireRole(['ADMIN']), publishDraft);
router.post('/drafts/:id/send-whatsapp', verifyAuthToken, requireRole(['ADMIN']), sendWhatsApp);
router.post('/drafts/manual', verifyAuthToken, requireRole(['ADMIN']), createManualContent);
router.post('/upload-plate', verifyAuthToken, requireRole(['ADMIN']), uploadPlate);
router.put('/drafts/:id/copy', verifyAuthToken, requireRole(['ADMIN']), updateContentCopy);
// Era un GET publico que MUTABA datos: recorria drafts, subia a Firebase
// Storage y reescribia visual.imageUrl. Cualquiera podia dispararlo desde la
// barra del navegador. Pasa a POST y detras de admin.
router.post('/fix-base64', verifyAuthToken, requireRole([USER_ROLES.ADMIN]), fixBase64Drafts);

// Endpoint que puede ser invocado por Cloud Scheduler
router.post('/scheduler/run', verifyCronToken, runContentScheduler);

export default router;
