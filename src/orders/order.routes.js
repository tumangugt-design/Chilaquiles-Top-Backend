import { Router } from 'express'
import { createOrder, getOrders, getOrderHistory, updateOrderStatus, getOrderWorkflowHelp, clearDeliveredOrders, trackOrder, getOrderConfirmationDetails, getDispatchOrders, assignDriver, getDeliveryPayoutsController, settleDeliveryPayoutController } from './order.controller.js'
import { rateLimit } from '../middlewares/rateLimit.middleware.js'
import { verifyAuthToken, optionalAuthToken } from '../middlewares/auth.middleware.js'
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'

const router = Router()

router.get('/workflow', getOrderWorkflowHelp)
router.get('/track/:orderNumber', trackOrder)
router.get('/confirmacion/:orderNumber', getOrderConfirmationDetails)
// Techo por IP mientras el OTP no emita token: un script puede crear pedidos
// reales con datos inventados, y cada uno descuenta inventario, entra a la
// cola del chef y quema un mensaje de WhatsApp.
router.post('/', rateLimit({ ventanaMs: 10 * 60 * 1000, maximo: 8, nombre: 'crear-pedido' }), optionalAuthToken, createOrder)
router.use(verifyAuthToken, requireApprovedStatus)
router.get('/history', requireRole([USER_ROLES.ADMIN]), getOrderHistory)
router.post('/clear-delivered', requireRole([USER_ROLES.ADMIN]), clearDeliveredOrders)
router.get('/dispatch', requireRole([USER_ROLES.ADMIN]), getDispatchOrders)
router.get('/delivery-payouts', requireRole([USER_ROLES.ADMIN]), getDeliveryPayoutsController)
router.post('/delivery-payouts/settle', requireRole([USER_ROLES.ADMIN]), settleDeliveryPayoutController)
router.patch('/:orderId/assign-driver', requireRole([USER_ROLES.ADMIN]), assignDriver)
router.get('/', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]), getOrders)
router.patch('/:orderId/status', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF, USER_ROLES.REPARTIDOR]), updateOrderStatus)

export default router
