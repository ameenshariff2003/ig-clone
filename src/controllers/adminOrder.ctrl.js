const Order    = require('../models/order.model')
const AppError = require('../utils/AppError')
const sendEmail = require('../services/email.services')

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const VALID_ORDER_STATUSES   = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']

const adminOrders = {

  // GET /admin/orders?page=1&limit=20&status=&paymentStatus=
  getAllOrders: async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1)
    const limit  = Math.min(50, parseInt(req.query.limit) || 20)
    const filter = {}

    if (req.query.status        && VALID_ORDER_STATUSES.includes(req.query.status))
      filter.orderStatus = req.query.status
    if (req.query.paymentStatus && VALID_PAYMENT_STATUSES.includes(req.query.paymentStatus))
      filter.paymentStatus = req.query.paymentStatus

    const [orderDocs, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'email mobile')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-razorpay.signature'),
      Order.countDocuments(filter),
    ])

    res.status(200).json({
      orders: orderDocs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  },

  // GET /admin/orders/:id
  getOrderById: async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate('user', 'email mobile image')
    if (!order) throw new AppError('Order not found.', 404)
    res.status(200).json({ order })
  },

  // PATCH /admin/orders/:id
  // Body: { orderStatus?, paymentStatus?, trackingId?, adminNote? }
  updateOrder: async (req, res) => {
    const { orderStatus, paymentStatus, trackingId, adminNote } = req.body
    const order = await Order.findById(req.params.id).populate('user', 'email')
    if (!order) throw new AppError('Order not found.', 404)

    if (orderStatus) {
      if (!VALID_ORDER_STATUSES.includes(orderStatus))
        throw new AppError(`Invalid orderStatus. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`, 400)
      order.orderStatus = orderStatus
    }
    if (paymentStatus) {
      if (!VALID_PAYMENT_STATUSES.includes(paymentStatus))
        throw new AppError(`Invalid paymentStatus. Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`, 400)
      order.paymentStatus = paymentStatus
    }
    if (trackingId !== undefined) order.trackingId = trackingId
    if (adminNote  !== undefined) order.adminNote  = adminNote

    await order.save()

    // Notify customer on key status changes
    const notifyOn = ['shipped', 'delivered', 'cancelled']
    if (orderStatus && notifyOn.includes(orderStatus)) {
      const statusMessages = {
        shipped:   `Great news! Your order (${order._id}) has been shipped. Tracking ID: ${order.trackingId || 'will be updated soon'}.`,
        delivered: `Your order (${order._id}) has been delivered. We hope you love it!`,
        cancelled: `Your order (${order._id}) has been cancelled. If you were charged, a refund will be processed within 5–7 business days.`,
      }
      sendEmail(
        order.user.email,
        `Order ${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)} – ${order._id}`,
        statusMessages[orderStatus],
        `<div style="font-family:Georgia,serif;padding:32px;background:#faf9f6;border-radius:12px;max-width:600px;margin:0 auto;">
          <h2 style="color:#1a2e1a;">Order Update</h2>
          <p style="color:#4a5a4a;">${statusMessages[orderStatus]}</p>
          ${order.trackingId ? `<p style="color:#4a5a4a;">Tracking: <strong>${order.trackingId}</strong></p>` : ''}
          <p style="color:#8a7a5a;font-size:12px;margin-top:32px;">Black Valley · Himalayan Shilajit</p>
        </div>`
      ).catch(console.error)
    }

    res.status(200).json({ msg: 'Order updated.', order })
  },

  // GET /admin/orders/stats
  getStats: async (_req, res) => {
    const [statusBreakdown, paymentBreakdown, revenueAgg, totalOrders] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$orderStatus',   count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
       { $group: { _id: null, totalPaise: { $sum: '$totalPaise' }, count: { $sum: 1 } } },

      ]),
      Order.countDocuments(),
    ])

    const revenue = revenueAgg[0] || { totalPaise: 0, count: 0 }

    res.status(200).json({
      totalOrders,
      paidOrders:      revenue.count,
      totalRevenuePaise:   revenue.totalPaise,
      totalRevenueRupees:  revenue.totalPaise / 100,
      statusBreakdown:  Object.fromEntries(statusBreakdown.map(s  => [s._id,  s.count])),
      paymentBreakdown: Object.fromEntries(paymentBreakdown.map(p => [p._id, p.count])),
    })
  },
}

module.exports = adminOrders