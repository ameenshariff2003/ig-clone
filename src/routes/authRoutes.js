const express      = require('express')
const auth         = require('../controllers/user.ctrl.js')
const asyncHandler = require('../middleware/asyncHandler')
const { protect }  = require('../middleware/protect')

const userRouter = express.Router()

// ── Public routes ─────────────────────────────────────────────────────────────
userRouter.post  ('/register',               asyncHandler(auth.signup))
userRouter.post  ('/login',                  asyncHandler(auth.login))
userRouter.post  ('/logout',                 asyncHandler(auth.logout))
userRouter.post  ('/verify-email',           asyncHandler(auth.verifyEmail))
userRouter.post  ('/verify-mobile',          asyncHandler(auth.verifyMobile))
userRouter.post  ('/resend-email-otp',       asyncHandler(auth.resendEmailOtp))
userRouter.post  ('/resend-sms-otp',         asyncHandler(auth.resendSmsOtp))
userRouter.patch ('/update-pending-contact', asyncHandler(auth.updatePendingContact))
userRouter.post  ('/forgot-password',        asyncHandler(auth.forgotPassword))
userRouter.post  ('/reset-password',         asyncHandler(auth.resetPassword))

// ── Protected routes (must be logged in) ──────────────────────────────────────
userRouter.patch ('/save-address', protect, asyncHandler(auth.saveAddress))

module.exports = userRouter