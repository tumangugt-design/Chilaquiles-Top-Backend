
import { Router } from 'express';
import { getUsersByRole, createStaffUser, patchStaffUser, deleteStaffUser, updateProfile, getCustomerByPhone, createDriver, patchDriver } from './user.controller.js';
import { verifyAuthToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.patch('/profile', verifyAuthToken, updateProfile);

router.use(verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]));
router.get('/customer-by-phone/:phone', getCustomerByPhone);
router.get('/role/:role', getUsersByRole);
router.post('/staff', createStaffUser);
router.post('/drivers', createDriver);
router.patch('/drivers/:id', patchDriver);
router.patch('/staff/:id', patchStaffUser);
router.delete('/staff/:id', deleteStaffUser);

export default router;
