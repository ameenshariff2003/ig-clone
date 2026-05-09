const jwt      = require('jsonwebtoken')
const User     = require('../models/user.model')
const AppError = require('../utils/AppError')

// Attach req.user from JWT cookie
const protect = async (req, _res, next) => {
  const token = req.cookies?.token
  if (!token) return next(new AppError('Not authenticated. Please log in.', 401))

  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY)
    const user    = await User.findById(decoded.id).select('-password')
    if (!user) return next(new AppError('User no longer exists.', 401))
    req.user = user
    next()
  } catch {
    next(new AppError('Session expired. Please log in again.', 401))
  }
}

// Must come after protect
const isAdmin = (req, _res, next) => {
  if (req.user?.role !== 'admin')
    return next(new AppError('Admin access required.', 403))
  next()
}

module.exports = { protect, isAdmin }