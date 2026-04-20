const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { isApproved } = require('../middlewares/status.middleware');

router.get('/', verifyToken, isApproved, hasRole(['ADMIN', 'CHEF']), inventoryController.getInventory);
router.post('/', verifyToken, isApproved, hasRole(['ADMIN']), inventoryController.addInventory);

module.exports = router;
