import { Router } from 'express'
import { staffLogin, registerStaff, getSession, requestClientAuth, verifyClientAuth } from './auth.controller.js'
import { verifyAuthToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/staff/login', staffLogin)
router.post('/staff/register', registerStaff)
router.get('/session', verifyAuthToken, getSession)

router.post('/client/request-code', requestClientAuth)
router.post('/client/verify-code', verifyClientAuth)

export default router
