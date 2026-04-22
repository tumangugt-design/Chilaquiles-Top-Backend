
import { Router } from 'express';
import { getPendingStaff, getUsersByRole, approveOrRejectStaff, updateProfile } from './user.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.patch('/profile', verifyFirebaseToken, updateProfile);

router.use(verifyFirebaseToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]));
router.get('/pending-staff', getPendingStaff);
router.get('/role/:role', getUsersByRole);
router.patch('/staff/:userId/status', approveOrRejectStaff);

export default router;
