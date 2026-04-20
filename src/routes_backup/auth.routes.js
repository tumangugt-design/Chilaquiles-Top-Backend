const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/client', verifyToken, authController.loginClient);
router.post('/staff', verifyToken, authController.loginStaff);

module.exports = router;
