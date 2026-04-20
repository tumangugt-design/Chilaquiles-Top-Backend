const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const ordersRoutes = require('./orders.routes');
const inventoryRoutes = require('./inventory.routes');
const adminRoutes = require('./admin.routes');

router.use('/auth', authRoutes);
router.use('/orders', ordersRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
