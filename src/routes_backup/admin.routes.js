const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { isApproved } = require('../middlewares/status.middleware');

router.get('/users/pending', verifyToken, isApproved, hasRole(['ADMIN']), adminController.getPendingUsers);
router.put('/users/:id/status', verifyToken, isApproved, hasRole(['ADMIN']), adminController.updateUserStatus);

module.exports = router;
