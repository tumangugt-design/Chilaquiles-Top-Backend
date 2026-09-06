import { Router } from 'express';
import {
  getPurchases,
  createPurchase,
  getAllocationsByStockItem,
  getPurchaseAllocations,
  getProductionBatches,
  createProductionBatch
} from './purchase.controller.js';
import { verifyAuthToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.use(verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]));
router.get('/', getPurchases);
router.post('/', createPurchase);
router.get('/allocations', getAllocationsByStockItem);
router.get('/production-batches', getProductionBatches);
router.get('/:id/allocations', getPurchaseAllocations);
router.post('/production-batches', createProductionBatch);

export default router;
