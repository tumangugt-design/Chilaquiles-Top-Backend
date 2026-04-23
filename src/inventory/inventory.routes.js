import { Router } from 'express';
import { getInventoryItems, saveInventoryItem, deleteInventoryItem, adjustInventoryStock, previewRecipeConsumption, getInventoryLogs, getAvailablePlates } from './inventory.controller.js';
import { verifyAuthToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.get('/available', getAvailablePlates);

router.use(verifyAuthToken, requireApprovedStatus);
router.get('/', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), getInventoryItems);
router.get('/logs', requireRole([USER_ROLES.ADMIN]), getInventoryLogs);
router.post('/', requireRole([USER_ROLES.ADMIN]), saveInventoryItem);
router.delete('/:name', requireRole([USER_ROLES.ADMIN]), deleteInventoryItem);
router.patch('/:name/stock', requireRole([USER_ROLES.ADMIN]), adjustInventoryStock);
router.post('/preview-consumption', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), previewRecipeConsumption);

export default router;
