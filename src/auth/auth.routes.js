import { Router } from 'express'
import { staffLogin, registerStaff, getSession } from './auth.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/staff/login', staffLogin)
router.post('/staff/register', registerStaff)
router.get('/session', verifyAuthToken, getSession)

export default router
