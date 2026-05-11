import { Router } from 'express'
import { createOrder, getOrders, getOrderHistory, updateOrderStatus, getOrderWorkflowHelp, clearDeliveredOrders } from './order.controller.js'
import { verifyAuthToken, optionalAuthToken } from '../middlewares/auth.middleware.js'
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'

const router = Router()

router.get('/workflow', getOrderWorkflowHelp)
router.post('/', optionalAuthToken, createOrder)
router.use(verifyAuthToken, requireApprovedStatus)
router.get('/history', requireRole([USER_ROLES.ADMIN]), getOrderHistory)
router.post('/clear-delivered', requireRole([USER_ROLES.ADMIN]), clearDeliveredOrders)
router.get('/', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]), getOrders)
router.patch('/:orderId/status', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]), updateOrderStatus)

export default router
