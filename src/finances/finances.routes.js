import { Router } from 'express'
import * as financeController from './finances.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'
import { requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'
import { verifyRecurrenteSignature } from './recurrenteSignature.middleware.js'

const router = Router()

// Public webhook - must stay above the auth middleware below.
router.post('/recurrente/webhook', verifyRecurrenteSignature, financeController.handleRecurrenteWebhook)

router.use(verifyAuthToken)
router.use(requireRole([USER_ROLES.ADMIN]))

router.get('/summary', financeController.getSummary)

export default router
