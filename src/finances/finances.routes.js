import { Router } from 'express'
import * as financeController from './finances.controller.js'
import { protect, restrictTo } from '../auth/auth.middleware.js'

const router = Router()

router.use(protect)
router.use(restrictTo('ADMIN'))

router.get('/summary', financeController.getSummary)

export default router
