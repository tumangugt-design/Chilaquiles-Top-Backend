import { Router } from 'express'
import { getOperatingHours, updateOperatingHours } from './settings.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'

const router = Router()

router.get('/operating-hours', getOperatingHours)
router.patch('/operating-hours', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateOperatingHours)

export default router
