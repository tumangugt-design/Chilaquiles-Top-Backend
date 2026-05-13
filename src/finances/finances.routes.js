import { Router } from 'express'
import * as financeController from './finances.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'
import { requireRole } from '../middlewares/role.middleware.js'
import { USER_ROLES } from '../helpers/constants.js'

const router = Router()

router.use(verifyAuthToken)
router.use(requireRole([USER_ROLES.ADMIN]))

router.get('/summary', financeController.getSummary)

export default router
