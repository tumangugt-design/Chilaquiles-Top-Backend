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
  generateMarketing,
  costPromotionPreview,
  proposePromotionPackaging,
  getTaxConfig,
  updateTaxConfig,
  getDeliveryConfig,
  updateDeliveryConfig
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

// Costeo en vivo: el formulario y el agente preguntan aqui antes de guardar.
router.post('/promotions/cost', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), costPromotionPreview)
router.post('/promotions/packaging-proposal', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), proposePromotionPackaging)

router.get('/calculator-costs', getCalculatorCosts)
router.patch('/calculator-costs', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateCalculatorCosts)

router.get('/coupons', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), getCoupons)
router.patch('/coupons', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateCoupons)
router.post('/validate-coupon', validateCoupon)

router.get('/delivery-config', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), getDeliveryConfig)
router.patch('/delivery-config', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateDeliveryConfig)

router.get('/tax-config', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), getTaxConfig)
router.patch('/tax-config', verifyAuthToken, requireApprovedStatus, requireRole([USER_ROLES.ADMIN]), updateTaxConfig)

export default router
