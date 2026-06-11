import { Router } from 'express'
import { 
  getOperatingHours, 
  updateOperatingHours, 
  getPromotions, 
  updatePromotions,
  getCalculatorCosts,
  updateCalculatorCosts,
  getCoupons,
  updateCoupons,
  validateCoupon,
  sendPromotionBlast,
  getCampaignHistory,
  generateMarketing
} from './settings.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'

const router = Router()

router.get('/operating-hours', getOperatingHours)
router.patch('/operating-hours', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateOperatingHours)

router.get('/promotions', getPromotions)
router.patch('/promotions', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updatePromotions)
router.post('/promotions/send-blast', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), sendPromotionBlast)
router.get('/promotions/campaigns', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), getCampaignHistory)
router.post('/promotions/generate-marketing', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), generateMarketing)

router.get('/calculator-costs', getCalculatorCosts)
router.patch('/calculator-costs', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateCalculatorCosts)

router.get('/coupons', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), getCoupons)
router.patch('/coupons', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateCoupons)
router.post('/validate-coupon', validateCoupon)

export default router
