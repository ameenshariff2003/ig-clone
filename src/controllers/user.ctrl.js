const User      = require('../models/user.model')
const OtpModel  = require('../models/otp.model')
const crypto    = require('crypto')
const jwt       = require('jsonwebtoken')
const bcrypt    = require('bcryptjs')
const sendEmail = require('../services/email.services')
const { sendSmsOtp }          = require('../services/sms.services')
const { generateOtp, getOtp } = require('../utils/utils')
const AppError  = require('../utils/AppError')

// ─── Constants ────────────────────────────────────────────────────────────────
const OTP_EXPIRY_MINUTES = 10
const JWT_EXPIRY         = '7d'
const BCRYPT_ROUNDS      = 12
const E164_REGEX         = /^\+[1-9]\d{7,14}$/

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const issueToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_KEY, { expiresIn: JWT_EXPIRY })
  res.cookie('token', token, COOKIE_OPTIONS)
  return token
}

const otpExpiresAt = () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

const createOtpRecord = async ({ userId, email, mobile, channel }) => {
  const otp     = generateOtp()
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS)
  await OtpModel.create({
    user:      userId,
    email:     channel === 'email' ? email  : undefined,
    mobile:    channel === 'sms'   ? mobile : undefined,
    channel,
    otpHash,
    expiresAt: otpExpiresAt(),
  })
  return otp
}

const checkOtpRateLimit = async (userId, channel) => {
  const recent = await OtpModel.findOne({ user: userId, channel, expiresAt: { $gt: new Date() } })
  if (!recent) return { blocked: false }
  return { blocked: true, retryAfterSeconds: Math.ceil((recent.expiresAt - Date.now()) / 1000) }
}

// ─── Controller ───────────────────────────────────────────────────────────────

const auth = {

  // ── SIGN UP ────────────────────────────────────────────────────────────────
  signup: async (req, res) => {
    const { email, password, mobile, image } = req.body

    if (!email || !password || !mobile)
      throw new AppError('Email, mobile, and password are required.', 400)

    if (!E164_REGEX.test(mobile))
      throw new AppError('Mobile must be in E.164 format (e.g. +919876543210).', 400)

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase().trim() }, { mobile }] })
    if (exists)
      throw new AppError('An account with those details already exists.', 409)

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      mobile,
      password: passwordHash,
      image,
      verifiedEmail:  false,
      verifiedMobile: false,
    })

    const emailOtp = await createOtpRecord({ userId: newUser._id, email: newUser.email, channel: 'email' })
    await sendEmail(
      newUser.email,
      'Verify your email',
      `Your OTP code is ${emailOtp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      getOtp(emailOtp)
    )

    const smsOtp = await createOtpRecord({ userId: newUser._id, mobile: newUser.mobile, channel: 'sms' })
    await sendSmsOtp(newUser.mobile, smsOtp)

    res.status(201).json({
      msg: 'Account created. Please verify your email and mobile number.',
      user: { email: newUser.email, mobile: newUser.mobile, verifiedEmail: false, verifiedMobile: false },
    })
  },

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  login: async (req, res) => {
    const { email, password } = req.body

    if (!email || !password)
      throw new AppError('Email and password are required.', 400)

const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+role +password')

    if (!user) {
      await bcrypt.hash(password, BCRYPT_ROUNDS) // timing-safe dummy
      throw new AppError('Invalid email or password.', 401)
    }

    if (!await bcrypt.compare(password, user.password))
      throw new AppError('Invalid email or password.', 401)

    if (!user.verifiedEmail)
      throw Object.assign(new AppError('Email not verified. Please check your inbox.', 403), { code: 'EMAIL_UNVERIFIED' })

    if (!user.verifiedMobile)
      throw Object.assign(new AppError('Mobile not verified. Please check your SMS.', 403), { code: 'MOBILE_UNVERIFIED' })

    issueToken(res, user._id)
    res.status(200).json({
      msg:  'Logged in successfully.',
      user: {
        id:           user._id,
        email:        user.email,
        mobile:       user.mobile,
        image:        user.image,
        role:         user.role,         

        savedAddress: user.savedAddress ?? null,
      },
    })
  },

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  logout: async (_req, res) => {
    res.clearCookie('token', COOKIE_OPTIONS)
    res.status(200).json({ msg: 'Logged out successfully.' })
  },

  // ── VERIFY EMAIL ───────────────────────────────────────────────────────────
  verifyEmail: async (req, res) => {
    const { otp, email } = req.body

    if (!otp || !email)
      throw new AppError('Email and OTP are required.', 400)

    const otpDoc = await OtpModel.findOne({
      email: email.toLowerCase().trim(), channel: 'email',
    }).sort({ createdAt: -1 })

    if (!otpDoc)
      throw new AppError('No verification code found. Please request a new one.', 400)

    if (otpDoc.expiresAt < new Date()) {
      await OtpModel.deleteMany({ user: otpDoc.user, channel: 'email' })
      throw Object.assign(new AppError('Verification code has expired. Please request a new one.', 410), { code: 'OTP_EXPIRED' })
    }

    if (!await bcrypt.compare(otp, otpDoc.otpHash))
      throw new AppError('Invalid verification code.', 400)

    await User.findByIdAndUpdate(otpDoc.user, { verifiedEmail: true })
    await OtpModel.deleteMany({ user: otpDoc.user, channel: 'email' })

    const user = await User.findById(otpDoc.user)
    if (user.verifiedEmail && user.verifiedMobile) issueToken(res, user._id)

    res.status(200).json({
      msg:            'Email verified successfully.',
      verifiedEmail:  true,
      verifiedMobile: user.verifiedMobile,
      sessionIssued:  user.verifiedEmail && user.verifiedMobile,
    })
  },

  // ── VERIFY MOBILE ──────────────────────────────────────────────────────────
  verifyMobile: async (req, res) => {
    const { otp, mobile } = req.body

    if (!otp || !mobile)
      throw new AppError('Mobile and OTP are required.', 400)

    if (!E164_REGEX.test(mobile))
      throw new AppError('Mobile must be in E.164 format (e.g. +919876543210).', 400)

    const otpDoc = await OtpModel.findOne({ mobile, channel: 'sms' }).sort({ createdAt: -1 })

    if (!otpDoc)
      throw new AppError('No verification code found. Please request a new one.', 400)

    if (otpDoc.expiresAt < new Date()) {
      await OtpModel.deleteMany({ user: otpDoc.user, channel: 'sms' })
      throw Object.assign(new AppError('Verification code has expired. Please request a new one.', 410), { code: 'OTP_EXPIRED' })
    }

    if (!await bcrypt.compare(otp, otpDoc.otpHash))
      throw new AppError('Invalid verification code.', 400)

    await User.findByIdAndUpdate(otpDoc.user, { verifiedMobile: true })
    await OtpModel.deleteMany({ user: otpDoc.user, channel: 'sms' })

    const user = await User.findById(otpDoc.user)
    if (user.verifiedEmail && user.verifiedMobile) issueToken(res, user._id)

    res.status(200).json({
      msg:            'Mobile verified successfully.',
      verifiedMobile: true,
      verifiedEmail:  user.verifiedEmail,
      sessionIssued:  user.verifiedEmail && user.verifiedMobile,
    })
  },

  // ── RESEND EMAIL OTP ───────────────────────────────────────────────────────
  resendEmailOtp: async (req, res) => {
    const { email } = req.body
    if (!email) throw new AppError('Email is required.', 400)

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    const genericMsg = 'If that email exists and is unverified, a new code has been sent.'

    if (!user || user.verifiedEmail) return res.status(200).json({ msg: genericMsg })

    const { blocked, retryAfterSeconds } = await checkOtpRateLimit(user._id, 'email')
    if (blocked) throw Object.assign(
      new AppError(`A code was already sent. Please wait ${retryAfterSeconds}s before requesting another.`, 429),
      { retryAfterSeconds }
    )

    await OtpModel.deleteMany({ user: user._id, channel: 'email' })
    const otp = await createOtpRecord({ userId: user._id, email: user.email, channel: 'email' })
    await sendEmail(user.email, 'Your new verification code', `Your new OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`, getOtp(otp))

    res.status(200).json({ msg: genericMsg })
  },

  // ── RESEND SMS OTP ─────────────────────────────────────────────────────────
  resendSmsOtp: async (req, res) => {
    const { mobile } = req.body
    if (!mobile) throw new AppError('Mobile is required.', 400)

    if (!E164_REGEX.test(mobile))
      throw new AppError('Mobile must be in E.164 format (e.g. +919876543210).', 400)

    const user = await User.findOne({ mobile })
    const genericMsg = 'If that mobile exists and is unverified, a new code has been sent.'

    if (!user || user.verifiedMobile) return res.status(200).json({ msg: genericMsg })

    const { blocked, retryAfterSeconds } = await checkOtpRateLimit(user._id, 'sms')
    if (blocked) throw Object.assign(
      new AppError(`A code was already sent. Please wait ${retryAfterSeconds}s before requesting another.`, 429),
      { retryAfterSeconds }
    )

    await OtpModel.deleteMany({ user: user._id, channel: 'sms' })
    const otp = await createOtpRecord({ userId: user._id, mobile: user.mobile, channel: 'sms' })
    await sendSmsOtp(user.mobile, otp)

    res.status(200).json({ msg: genericMsg })
  },

  // ── UPDATE PENDING CONTACT ─────────────────────────────────────────────────
  updatePendingContact: async (req, res) => {
    const { channel, currentValue, newValue } = req.body

    if (!channel || !currentValue || !newValue)
      throw new AppError('channel, currentValue, and newValue are required.', 400)

    if (!['email', 'sms'].includes(channel))
      throw new AppError("channel must be 'email' or 'sms'.", 400)

    if (channel === 'email' && !/\S+@\S+\.\S+/.test(newValue))
      throw new AppError('Please provide a valid email address.', 400)

    if (channel === 'sms' && !E164_REGEX.test(newValue))
      throw new AppError('Mobile must be in E.164 format (e.g. +919876543210).', 400)

    const query = channel === 'email' ? { email: currentValue.toLowerCase().trim() } : { mobile: currentValue }
    const user  = await User.findOne(query)

    if (!user)
      throw new AppError('No account found with that contact value.', 404)

    if (channel === 'email' ? user.verifiedEmail : user.verifiedMobile)
      throw new AppError('This contact is already verified and cannot be changed here.', 409)

    const normalised = channel === 'email' ? newValue.toLowerCase().trim() : newValue
    if (normalised === (channel === 'email' ? user.email : user.mobile))
      throw new AppError('The new value is the same as the current one.', 400)

    const taken = channel === 'email'
      ? await User.findOne({ email: normalised, _id: { $ne: user._id } })
      : await User.findOne({ mobile: normalised, _id: { $ne: user._id } })

    if (taken)
      throw new AppError('That contact value is already in use by another account.', 409)

    await User.findByIdAndUpdate(user._id, channel === 'email' ? { email: normalised } : { mobile: normalised })
    await OtpModel.deleteMany({ user: user._id, channel })

    if (channel === 'email') {
      const otp = await createOtpRecord({ userId: user._id, email: normalised, channel: 'email' })
      await sendEmail(normalised, 'Verify your new email', `Your OTP code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`, getOtp(otp))
    } else {
      const otp = await createOtpRecord({ userId: user._id, mobile: normalised, channel: 'sms' })
      await sendSmsOtp(normalised, otp)
    }

    res.status(200).json({
      msg: `${channel === 'email' ? 'Email' : 'Mobile'} updated. A new verification code has been sent.`,
      [channel === 'email' ? 'email' : 'mobile']: normalised,
    })
  },

  // ── SAVE / UPDATE ADDRESS ──────────────────────────────────────────────────
  // PATCH /auth/save-address  (requires protect middleware on router)
  saveAddress: async (req, res) => {
    const { fullName, phone, line1, line2, city, state, pincode, country } = req.body

    if (!fullName || !phone || !line1 || !city || !state || !pincode)
      throw new AppError('fullName, phone, line1, city, state, and pincode are required.', 400)

    if (!/^\+?[0-9]{8,15}$/.test(phone.replace(/\s/g, '')))
      throw new AppError('Enter a valid phone number.', 400)

    if (!/^[0-9]{6}$/.test(pincode))
      throw new AppError('Pincode must be a 6-digit number.', 400)

    const savedAddress = {
      fullName: fullName.trim(),
      phone:    phone.trim(),
      line1:    line1.trim(),
      line2:    (line2 || '').trim(),
      city:     city.trim(),
      state:    state.trim(),
      pincode:  pincode.trim(),
      country:  (country || 'India').trim(),
    }

    // req.user is set by the protect middleware
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { savedAddress },
      { new: true, runValidators: true }
    )

    res.status(200).json({
      msg:          'Address saved successfully.',
      savedAddress: updated.savedAddress,
    })
  },

  // ── FORGOT PASSWORD ────────────────────────────────────────────────────────
  forgotPassword: async (req, res) => {
    const { email } = req.body
    if (!email) throw new AppError('Email is required.', 400)

    const genericMsg = 'If that account exists, a password reset link has been sent.'
    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) return res.status(200).json({ msg: genericMsg })

    const resetToken     = crypto.randomBytes(32).toString('hex')
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')

    user.passwordResetToken   = resetTokenHash
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000)
    await user.save()

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`
    await sendEmail(
      user.email,
      'Reset your password',
      `Reset your password: ${resetUrl} (expires in 15 minutes)`,
      `<p>Click <a href="${resetUrl}">here</a> to reset your password. Expires in 15 minutes.</p>`
    )

    res.status(200).json({ msg: genericMsg })
  },

  // ── RESET PASSWORD ─────────────────────────────────────────────────────────
  resetPassword: async (req, res) => {
    const { token, newPassword } = req.body

    if (!token || !newPassword)
      throw new AppError('Token and new password are required.', 400)

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } })

    if (!user)
      throw new AppError('Reset link is invalid or has expired.', 400)

    user.password             = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    user.passwordResetToken   = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.clearCookie('token', COOKIE_OPTIONS)
    res.status(200).json({ msg: 'Password reset successfully. Please log in again.' })
  },
}

module.exports = auth