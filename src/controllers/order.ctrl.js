const Razorpay  = require('razorpay')
const crypto    = require('crypto')
const Order     = require('../models/order.model')
const Cart      = require('../models/cart.model')
const AppError  = require('../utils/AppError')
const sendEmail = require('../services/email.services')

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const rupees = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const buildLineItems = (cartDoc) =>
  cartDoc.items.map(item => ({
    productId:    item.productId,
    variantId:    item.variantId,
    name:         item.productName  ?? item.name  ?? 'Shilajit',
    variantLabel: item.variantLabel ?? item.label ?? '',
    weight:       item.weight ?? '',
    unitPrice:    item.price,
    quantity:     item.quantity,
    lineTotal:    item.price * item.quantity,
  }))

// ── Delivery charge helper ────────────────────────────────────────────────────
const getDeliveryChargePaise = (state = '') => {
  const s = state.trim().toLowerCase()
  return ['karnataka', 'ka'].includes(s) ? 10000 : 15000  // 100 or 150 in paise
}

// ── Customer confirmation email ───────────────────────────────────────────────
const customerEmailHtml = (order, user) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Georgia,serif;">
<div style="max-width:600px;margin:40px auto;background:#faf9f6;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#0c2016,#1a3d28);padding:40px;text-align:center;">
    <h1 style="margin:0;color:#d4af37;font-size:26px;letter-spacing:4px;font-weight:400;">BLACK VALLEY</h1>
    <p style="margin:6px 0 0;color:#8a9a8a;font-size:10px;letter-spacing:6px;">HIMALAYAN SHILAJIT</p>
  </div>
  <div style="background:#d4af37;padding:18px 40px;text-align:center;">
    <p style="margin:0;color:#0c2016;font-size:16px;font-weight:700;letter-spacing:1px;">✓ &nbsp;Order Confirmed &amp; Payment Received</p>
  </div>
  <div style="padding:40px;">
    <p style="color:#4a5a4a;font-size:15px;margin:0 0 6px;">Dear ${user.name ?? user.email},</p>
    <p style="color:#4a5a4a;font-size:14px;line-height:1.8;margin:0 0 32px;">
      Thank you for your order! Your payment has been confirmed and your
      Himalayan Shilajit is being prepared for dispatch.
    </p>
    <div style="background:#f0ebe0;border-radius:8px;padding:14px 20px;margin-bottom:28px;">
      <span style="color:#8a7a5a;font-size:11px;letter-spacing:2px;">ORDER ID</span><br/>
      <span style="color:#1a2e1a;font-family:monospace;font-size:12px;font-weight:700;">${order._id}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <thead>
        <tr style="background:#f0ebe0;">
          <th style="padding:10px 12px;text-align:left;color:#8a7a5a;font-size:10px;letter-spacing:2px;">PRODUCT</th>
          <th style="padding:10px 12px;text-align:center;color:#8a7a5a;font-size:10px;letter-spacing:2px;">QTY</th>
          <th style="padding:10px 12px;text-align:right;color:#8a7a5a;font-size:10px;letter-spacing:2px;">PRICE</th>
          <th style="padding:10px 12px;text-align:right;color:#8a7a5a;font-size:10px;letter-spacing:2px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map(i => `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #f0ebe0;color:#1a2e1a;font-size:13px;">
              ${i.name}
              ${i.variantLabel ? `<br/><span style="color:#8a7a5a;font-size:11px;">${i.variantLabel}${i.weight ? ' · ' + i.weight : ''}</span>` : ''}
            </td>
            <td style="padding:12px;border-bottom:1px solid #f0ebe0;color:#4a5a4a;font-size:13px;text-align:center;">${i.quantity}</td>
            <td style="padding:12px;border-bottom:1px solid #f0ebe0;color:#4a5a4a;font-size:13px;text-align:right;">₹${i.unitPrice.toLocaleString('en-IN')}</td>
            <td style="padding:12px;border-bottom:1px solid #f0ebe0;color:#1a2e1a;font-size:13px;text-align:right;font-weight:600;">₹${i.lineTotal.toLocaleString('en-IN')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="background:#0c2016;border-radius:0 0 8px 8px;padding:16px 20px;margin-bottom:32px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#8a9a8a;font-size:12px;">SUBTOTAL</span>
        <span style="color:#e8e0d0;font-size:14px;">${rupees(order.totalPaise - (order.deliveryCharge || 0))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8a9a8a;font-size:12px;">DELIVERY</span>
        <span style="color:#e8e0d0;font-size:14px;">${rupees(order.deliveryCharge || 0)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #1a3d28;padding-top:12px;">
        <span style="color:#8a9a8a;font-size:12px;letter-spacing:1px;">TOTAL PAID</span>
        <span style="color:#d4af37;font-size:22px;font-weight:700;">${rupees(order.totalPaise)}</span>
      </div>
    </div>
    <div style="border:1px solid #e8e0d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;color:#8a7a5a;font-size:10px;letter-spacing:2px;">📦 &nbsp;SHIPPING TO</p>
      <p style="margin:0;color:#1a2e1a;font-size:13px;line-height:2;">
        <strong>${order.shippingAddress.fullName}</strong><br/>
        ${order.shippingAddress.line1}${order.shippingAddress.line2 ? ', ' + order.shippingAddress.line2 : ''}<br/>
        ${order.shippingAddress.city}, ${order.shippingAddress.state} – ${order.shippingAddress.pincode}<br/>
        ${order.shippingAddress.country}<br/>
        📞 &nbsp;${order.shippingAddress.phone}
      </p>
    </div>
    <div style="border:1px solid #e8e0d0;border-radius:8px;padding:20px;margin-bottom:32px;">
      <p style="margin:0 0 10px;color:#8a7a5a;font-size:10px;letter-spacing:2px;">💳 &nbsp;PAYMENT</p>
      <p style="margin:0;color:#4a5a4a;font-size:13px;line-height:2;">
        Payment ID: <span style="font-family:monospace;color:#1a2e1a;">${order.razorpay.paymentId}</span><br/>
        Status: <span style="color:#16a34a;font-weight:700;">✓ &nbsp;Confirmed</span>
      </p>
    </div>
    <p style="color:#4a5a4a;font-size:13px;line-height:1.8;margin:0 0 8px;">
      We'll send you a tracking update as soon as your order ships.
      Most orders dispatch within 1–2 business days.
    </p>
    <p style="color:#4a5a4a;font-size:13px;margin:0;">
      Questions? Contact us at
      <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#8a6a10;text-decoration:none;">${process.env.ADMIN_EMAIL}</a>
    </p>
  </div>
  <div style="background:#0c2016;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:#d4af37;font-size:11px;letter-spacing:4px;">BLACK VALLEY</p>
    <p style="margin:6px 0 0;color:#2a4a2a;font-size:11px;">Forged by Mountains, Perfected by Time</p>
  </div>
</div>
</body>
</html>`

// ── Cancellation email ────────────────────────────────────────────────────────
const cancellationEmailHtml = (order, refundId) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Georgia,serif;">
<div style="max-width:600px;margin:40px auto;background:#faf9f6;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#0c2016,#1a3d28);padding:40px;text-align:center;">
    <h1 style="margin:0;color:#d4af37;font-size:26px;letter-spacing:4px;font-weight:400;">BLACK VALLEY</h1>
    <p style="margin:6px 0 0;color:#8a9a8a;font-size:10px;letter-spacing:6px;">HIMALAYAN SHILAJIT</p>
  </div>
  <div style="background:#dc2626;padding:18px 40px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:16px;font-weight:700;letter-spacing:1px;">Order Cancelled &amp; Refund Initiated</p>
  </div>
  <div style="padding:40px;">
    <p style="color:#4a5a4a;font-size:14px;line-height:1.8;margin:0 0 24px;">
      Your order <strong style="font-family:monospace;">${order._id}</strong> has been cancelled.
      A full refund of <strong>${rupees(order.totalPaise)}</strong> has been initiated to your original payment method.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#991b1b;font-size:11px;letter-spacing:2px;">REFUND DETAILS</p>
      <p style="margin:0;color:#4a5a4a;font-size:13px;line-height:2;">
        Refund ID: <span style="font-family:monospace;color:#1a2e1a;">${refundId}</span><br/>
        Amount: <strong>${rupees(order.totalPaise)}</strong><br/>
        Timeline: <strong>5–7 business days</strong> to reflect in your account
      </p>
    </div>
    <p style="color:#4a5a4a;font-size:13px;margin:0;">
      Questions? Contact us at
      <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#8a6a10;text-decoration:none;">${process.env.ADMIN_EMAIL}</a>
    </p>
  </div>
  <div style="background:#0c2016;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:#d4af37;font-size:11px;letter-spacing:4px;">BLACK VALLEY</p>
    <p style="margin:6px 0 0;color:#2a4a2a;font-size:11px;">Forged by Mountains, Perfected by Time</p>
  </div>
</div>
</body>
</html>`

// ── Admin email ───────────────────────────────────────────────────────────────
const adminEmailHtml = (order, user) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#060e08;font-family:Georgia,serif;">
<div style="max-width:600px;margin:40px auto;background:#0c2016;border-radius:16px;overflow:hidden;border:1px solid #1a3d28;">
  <div style="background:#d4af37;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <h1 style="margin:0;color:#0c2016;font-size:18px;letter-spacing:2px;font-weight:700;">🛒 &nbsp;NEW ORDER RECEIVED</h1>
      <p style="margin:4px 0 0;color:#5a3d00;font-size:11px;letter-spacing:1px;">Black Valley · Payment Confirmed</p>
    </div>
    <div style="background:#0c2016;color:#d4af37;padding:8px 16px;border-radius:20px;font-size:15px;font-weight:700;">
      ${rupees(order.totalPaise)}
    </div>
  </div>
  <div style="padding:32px 40px;">
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:#132b1b;border-radius:8px;padding:16px;">
        <p style="margin:0 0 6px;color:#4a6a4a;font-size:10px;letter-spacing:2px;">ORDER ID</p>
        <p style="margin:0;color:#e8e0d0;font-family:monospace;font-size:12px;word-break:break-all;">${order._id}</p>
      </div>
      <div style="flex:1;background:#132b1b;border-radius:8px;padding:16px;">
        <p style="margin:0 0 6px;color:#4a6a4a;font-size:10px;letter-spacing:2px;">PAYMENT ID</p>
        <p style="margin:0;color:#d4af37;font-family:monospace;font-size:12px;word-break:break-all;">${order.razorpay.paymentId}</p>
      </div>
    </div>
    <div style="background:#132b1b;border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 14px;color:#4a6a4a;font-size:10px;letter-spacing:2px;">👤 &nbsp;CUSTOMER</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#4a6a4a;font-size:12px;width:80px;">Name</td>
          <td style="padding:6px 0;color:#e8e0d0;font-size:13px;">${order.shippingAddress.fullName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#4a6a4a;font-size:12px;">Email</td>
          <td style="padding:6px 0;color:#e8e0d0;font-size:13px;">${user.email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#4a6a4a;font-size:12px;">Phone</td>
          <td style="padding:6px 0;color:#e8e0d0;font-size:13px;">${order.shippingAddress.phone}</td>
        </tr>
      </table>
    </div>
    <div style="background:#132b1b;border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 14px;color:#4a6a4a;font-size:10px;letter-spacing:2px;">📦 &nbsp;ITEMS</p>
      ${order.items.map(i => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1a3d28;">
          <div>
            <p style="margin:0;color:#e8e0d0;font-size:13px;">${i.name}</p>
            <p style="margin:3px 0 0;color:#4a6a4a;font-size:11px;">
              ${i.variantLabel}${i.weight ? ' · ' + i.weight : ''} &nbsp;×&nbsp; ${i.quantity} &nbsp;@ ₹${i.unitPrice.toLocaleString('en-IN')}
            </p>
          </div>
          <p style="margin:0;color:#d4af37;font-size:14px;font-weight:600;">₹${i.lineTotal.toLocaleString('en-IN')}</p>
        </div>
      `).join('')}
      <div style="padding:12px 0 4px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="color:#8a9a8a;font-size:12px;">SUBTOTAL</span>
          <span style="color:#e8e0d0;font-size:13px;">${rupees(order.totalPaise - (order.deliveryCharge || 0))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="color:#8a9a8a;font-size:12px;">DELIVERY</span>
          <span style="color:#e8e0d0;font-size:13px;">${rupees(order.deliveryCharge || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 0;border-top:1px solid #1a3d28;margin-top:8px;">
          <span style="color:#8a9a8a;font-size:12px;letter-spacing:1px;">GRAND TOTAL</span>
          <span style="color:#d4af37;font-size:22px;font-weight:700;">${rupees(order.totalPaise)}</span>
        </div>
      </div>
    </div>
    <div style="background:#132b1b;border-radius:8px;padding:20px;margin-bottom:28px;">
      <p style="margin:0 0 14px;color:#4a6a4a;font-size:10px;letter-spacing:2px;">🚚 &nbsp;SHIP TO</p>
      <p style="margin:0;color:#e8e0d0;font-size:13px;line-height:2;">
        ${order.shippingAddress.fullName}<br/>
        ${order.shippingAddress.line1}${order.shippingAddress.line2 ? ', ' + order.shippingAddress.line2 : ''}<br/>
        ${order.shippingAddress.city}, ${order.shippingAddress.state} – ${order.shippingAddress.pincode}<br/>
        ${order.shippingAddress.country}<br/>
        📞 &nbsp;${order.shippingAddress.phone}
      </p>
    </div>
    <a href="${process.env.CLIENT_URL}/admin/orders/${order._id}"
       style="display:block;text-align:center;background:#d4af37;color:#0c2016;padding:16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;">
      VIEW ORDER IN DASHBOARD &nbsp;→
    </a>
  </div>
  <div style="padding:20px 40px;text-align:center;border-top:1px solid #1a3d28;">
    <p style="margin:0;color:#2a4a2a;font-size:11px;">Black Valley Admin · Automated notification</p>
  </div>
</div>
</body>
</html>`

// ─────────────────────────────────────────────────────────────────────────────

const orders = {

  // ── CREATE RAZORPAY ORDER ─────────────────────────────────────────────────
  createRazorpayOrder: async (req, res) => {
    const cartDoc = await Cart.findOne({ user: req.user._id })

    if (!cartDoc || !cartDoc.items?.length)
      throw new AppError('Your cart is empty.', 400)

    const { shippingAddress } = req.body
    if (!shippingAddress)
      throw new AppError('Shipping address is required.', 400)

    const { fullName, phone, line1, city, state, pincode } = shippingAddress
    if (!fullName || !phone || !line1 || !city || !state || !pincode)
      throw new AppError('fullName, phone, line1, city, state and pincode are required.', 400)

    const lineItems     = buildLineItems(cartDoc)
    const subtotalPaise = Math.round(
      lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100
    )

    if (!subtotalPaise || subtotalPaise < 100)
      throw new AppError('Invalid cart total.', 400)

    // ── Delivery charge based on state ────────────────────────────────────
    const deliveryChargePaise = getDeliveryChargePaise(state)
    const totalPaise          = subtotalPaise + deliveryChargePaise

    let rzpOrder
    try {
      rzpOrder = await razorpay.orders.create({
        amount:   totalPaise,
        currency: 'INR',
        receipt:  `bv_${Date.now()}`,
        notes:    { userId: req.user._id.toString() },
      })
    } catch (rzpErr) {
      console.error('Razorpay error:', rzpErr)
      throw new AppError(
        rzpErr?.error?.description || 'Could not create payment order.',
        502
      )
    }

    res.status(200).json({
      razorpayOrderId:    rzpOrder.id,
      amount:             totalPaise,
      currency:           'INR',
      keyId:              process.env.RAZORPAY_KEY_ID,
      lineItems,
      subtotalPaise,
      deliveryChargePaise,
      totalPaise,
      shippingAddress,
    })
  },

  // ── VERIFY PAYMENT & SAVE ORDER ───────────────────────────────────────────
  verifyPayment: async (req, res) => {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      lineItems,
      totalPaise,
      deliveryChargePaise,
      shippingAddress,
    } = req.body

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
      throw new AppError('Payment details are incomplete.', 400)

    if (!lineItems?.length || !totalPaise || !shippingAddress)
      throw new AppError('Order details are incomplete.', 400)

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSig !== razorpaySignature)
      throw new AppError('Payment verification failed. Invalid signature.', 400)

    const order = await Order.create({
      user:           req.user._id,
      items:          lineItems,
      totalPaise,
      deliveryCharge: deliveryChargePaise || 0,
      shippingAddress,
      razorpay: {
        orderId:   razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      },
      paymentStatus: 'paid',
      orderStatus:   'confirmed',
    })

    await Cart.findOneAndDelete({ user: req.user._id })

    const user = req.user

    sendEmail(
      user.email,
      `✓ Order Confirmed – Black Valley`,
      `Your order has been confirmed. Total: ${rupees(order.totalPaise)}`,
      customerEmailHtml(order, user)
    ).catch(err => console.error('❌ Customer email failed:', err))

    sendEmail(
      process.env.ADMIN_EMAIL,
      `🛒 New Order – ${rupees(order.totalPaise)} – ${order._id}`,
      `New order from ${user.email}. Total: ${rupees(order.totalPaise)}`,
      adminEmailHtml(order, user)
    ).catch(err => console.error('❌ Admin email failed:', err))

    res.status(201).json({
      msg:   'Payment verified. Order confirmed.',
      order: {
        _id:           order._id,
        orderStatus:   order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalPaise:    order.totalPaise,
        totalRupees:   order.totalPaise / 100,
        deliveryCharge: order.deliveryCharge,
      },
    })
  },

  // ── CANCEL ORDER ──────────────────────────────────────────────────────────
  cancelOrder: async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })

    if (!order)
      throw new AppError('Order not found.', 404)

    if (!['placed', 'confirmed'].includes(order.orderStatus))
      throw new AppError(
        `This order cannot be cancelled because it is already ${order.orderStatus}. Please contact support.`,
        400
      )

    if (order.orderStatus === 'cancelled')
      throw new AppError('This order has already been cancelled.', 400)

    let razorpayRefund
    try {
      razorpayRefund = await razorpay.payments.refund(order.razorpay.paymentId, {
        amount: order.totalPaise,
        speed:  'optimum',
        notes:  {
          reason:  'Customer requested cancellation',
          orderId: order._id.toString(),
        },
      })
    } catch (rzpErr) {
      console.error('Razorpay refund error:', rzpErr)
      throw new AppError(
        rzpErr?.error?.description || 'Refund could not be initiated. Please contact support.',
        502
      )
    }

    order.orderStatus   = 'cancelled'
    order.paymentStatus = 'refunded'
    order.refund        = {
      refundId:     razorpayRefund.id,
      refundStatus: 'processed',
      refundedAt:   new Date(),
      refundPaise:  order.totalPaise,
    }
    await order.save()

    sendEmail(
      req.user.email,
      `Order Cancelled & Refund Initiated – Black Valley`,
      `Your order ${order._id} has been cancelled. Refund of ${rupees(order.totalPaise)} initiated (Refund ID: ${razorpayRefund.id}).`,
      cancellationEmailHtml(order, razorpayRefund.id)
    ).catch(err => console.error('❌ Cancellation email failed:', err))

    res.status(200).json({
      msg:          'Order cancelled and refund initiated successfully.',
      orderId:      order._id,
      refundId:     razorpayRefund.id,
      refundAmount: rupees(order.totalPaise),
      note:         'Refund will reflect in your account within 5–7 business days.',
    })
  },

  // ── GET MY ORDERS ─────────────────────────────────────────────────────────
  getMyOrders: async (req, res) => {
    const userOrders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-razorpay.signature')
    res.status(200).json({ orders: userOrders })
  },

  // ── GET SINGLE ORDER ──────────────────────────────────────────────────────
  getOrderById: async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .select('-razorpay.signature')
    if (!order) throw new AppError('Order not found.', 404)
    res.status(200).json({ order })
  },
}

module.exports = orders