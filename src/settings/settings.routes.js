import { Router } from 'express'
import { 
  getOperatingHours, 
  updateOperatingHours, 
  getPromotions, 
  updatePromotions,
  getCalculatorCosts,
  updateCalculatorCosts
} from './settings.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'

const router = Router()

router.get('/operating-hours', getOperatingHours)
router.patch('/operating-hours', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateOperatingHours)

router.get('/promotions', getPromotions)
router.patch('/promotions', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updatePromotions)

router.get('/calculator-costs', getCalculatorCosts)
router.patch('/calculator-costs', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateCalculatorCosts)

export default router
