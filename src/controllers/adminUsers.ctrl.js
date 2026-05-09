// adminUsers.ctrl.js
const User     = require('../models/user.model')
const Order    = require('../models/order.model')
const AppError = require('../utils/AppError')
const mongoose = require('mongoose')

// FIX: Explicit positive select so `role` is NEVER dropped even if the
// User model has select:false on some fields. Previously `-password -passwordResetToken -passwordResetExpires`
// only excluded fields — if mongoose schema has role with select:false it
// would still be missing. Positive select guarantees inclusion.
const USER_SELECT = 'role email mobile verifiedEmail verifiedMobile savedAddress image createdAt updatedAt'

const adminUsers = {

  // GET /admin/users?page=1&limit=15&search=&role=&verified=
  getAllUsers: async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(50, parseInt(req.query.limit) || 15)
    const filter = {}

    if (req.query.search?.trim()) {
      filter.$or = [
        { email:  { $regex: req.query.search.trim(), $options: 'i' } },
        { mobile: { $regex: req.query.search.trim(), $options: 'i' } },
      ]
    }

    if (req.query.role && ['user', 'admin'].includes(req.query.role))
      filter.role = req.query.role

    // FIX: verified=false was overwriting $or from search above with a plain
    // assignment. Now merges safely with $and so both conditions coexist.
    if (req.query.verified === 'true') {
      filter.verifiedEmail  = true
      filter.verifiedMobile = true
    }
    if (req.query.verified === 'false') {
      const cond = { $or: [{ verifiedEmail: false }, { verifiedMobile: false }] }
      filter.$and = filter.$and ? [...filter.$and, cond] : [cond]
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(USER_SELECT)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    res.status(200).json({
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  },

  // GET /admin/users/:id
  getUserById: async (req, res) => {
    const user = await User.findById(req.params.id)
      .select(USER_SELECT)
      .lean()
    if (!user) throw new AppError('User not found.', 404)
    const orderCount = await Order.countDocuments({ user: user._id })
    res.status(200).json({ user: { ...user, orderCount } })
  },

  // PATCH /admin/users/:id
  updateUser: async (req, res) => {
    const { email, mobile, role } = req.body
    const update = {}
    if (email)  update.email  = email.toLowerCase().trim()
    if (mobile) update.mobile = mobile
    if (role && ['user', 'admin'].includes(role)) update.role = role

    if (Object.keys(update).length === 0)
      throw new AppError('No updatable fields provided.', 400)

    // FIX: `new: true` deprecated in Mongoose 8 → use `returnDocument: 'after'`
    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { returnDocument: 'after', runValidators: true }
    ).select(USER_SELECT)

    if (!user) throw new AppError('User not found.', 404)
    res.status(200).json({ msg: 'User updated.', user })
  },

  // DELETE /admin/users/:id
  deleteUser: async (req, res) => {
    if (req.params.id === req.user._id.toString())
      throw new AppError('You cannot delete your own account.', 400)
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) throw new AppError('User not found.', 404)
    res.status(200).json({ msg: 'User deleted.' })
  },

  // PATCH /admin/users/:id/role
  changeRole: async (req, res) => {
    const { role } = req.body
    if (!['user', 'admin'].includes(role))
      throw new AppError('Role must be "user" or "admin".', 400)
    if (req.params.id === req.user._id.toString())
      throw new AppError('You cannot change your own role.', 400)

    // FIX: `new: true` deprecated → `returnDocument: 'after'`
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { returnDocument: 'after' }
    ).select(USER_SELECT)

    if (!user) throw new AppError('User not found.', 404)
    res.status(200).json({ msg: `Role changed to ${role}.`, user })
  },
}

module.exports = adminUsers