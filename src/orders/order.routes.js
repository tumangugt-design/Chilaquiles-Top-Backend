import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus, getOrderWorkflowHelp } from './order.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.get('/workflow', getOrderWorkflowHelp);
router.use(verifyFirebaseToken, requireApprovedStatus);
router.post('/', requireRole([USER_ROLES.CLIENT]), createOrder);
router.get('/', requireRole([USER_ROLES.CLIENT, USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]), getOrders);
router.patch('/:orderId/status', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]), updateOrderStatus);

export default router;
