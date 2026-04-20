const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { isApproved } = require('../middlewares/status.middleware');

// Create order (CLIENT)
router.post('/', verifyToken, isApproved, orderController.createOrder);

// Get orders (CHEF, REPARTIDOR, ADMIN)
router.get('/', verifyToken, isApproved, hasRole(['CHEF', 'REPARTIDOR', 'ADMIN']), orderController.getOrders);

// Update order status (CHEF, REPARTIDOR)
router.put('/:id/status', verifyToken, isApproved, hasRole(['CHEF', 'REPARTIDOR', 'ADMIN']), orderController.updateOrderStatus);

module.exports = router;
