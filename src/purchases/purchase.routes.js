import { Router } from 'express';
import {
  getPurchases,
  createPurchase,
  getAllocationsByStockItem,
  getPurchaseAllocations,
  createPurchaseAllocation
} from './purchase.controller.js';
import { verifyAuthToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.use(verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]));
router.get('/', getPurchases);
router.post('/', createPurchase);
router.get('/allocations', getAllocationsByStockItem);
router.get('/:id/allocations', getPurchaseAllocations);
router.post('/:id/allocations', createPurchaseAllocation);

export default router;
