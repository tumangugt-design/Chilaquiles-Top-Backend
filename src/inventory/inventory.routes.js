import { Router } from 'express';
import { getInventoryItems, saveInventoryItem, previewRecipeConsumption } from './inventory.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.use(verifyFirebaseToken, requireApprovedStatus);
router.get('/', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), getInventoryItems);
router.post('/', requireRole([USER_ROLES.ADMIN]), saveInventoryItem);
router.post('/preview-consumption', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), previewRecipeConsumption);

export default router;
