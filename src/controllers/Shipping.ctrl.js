// controllers/shipping.ctrl.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin shipping controller — wraps Shiprocket service
// All routes are protected by isAuthenticated + isAdmin middleware
// ─────────────────────────────────────────────────────────────────────────────

const Order        = require('../models/order.model')
const AppError     = require('../utils/AppError')
const sendEmail    = require('../services/email.services')
const shiprocket   = require('../services/Shiprocket.service')

const shipping = {

  // ── POST /admin/shipping/push
  // Push a single order to Shiprocket and auto-assign AWB + schedule pickup.
  // Body: { orderId, weight? }
  pushToShiprocket: async (req, res) => {
    const { orderId, weight = 0.5 } = req.body
    if (!orderId) throw new AppError('orderId is required.', 400)

    const order = await Order.findById(orderId).populate('user', 'email mobile')
    if (!order) throw new AppError('Order not found.', 404)

    if (order.shiprocket?.sr_order_id)
      throw new AppError('Order already pushed to Shiprocket.', 400)

    if (!order.shippingAddress)
      throw new AppError('Order has no shipping address.', 400)

    // ── Step 1: Create order in Shiprocket ────────────────────────────────
    const srRes = await shiprocket.createShiprocketOrder(order, weight)

    const sr_order_id  = srRes.order_id
    const shipment_id  = srRes.shipment_id

    if (!sr_order_id || !shipment_id)
      throw new AppError('Shiprocket order creation failed: ' + JSON.stringify(srRes), 502)

    // Save immediately so we don't lose the SR ids
    order.shiprocket = { sr_order_id, shipment_id, status: 'created' }
    order.orderStatus = 'processing'
    await order.save()

    // ── Step 2: Assign AWB (auto courier) ─────────────────────────────────
    let awb = null
    try {
      const awbRes = await shiprocket.assignAWB(shipment_id)
      awb = awbRes?.response?.data?.awb_code || awbRes?.awb_code || null
      if (awb) {
        order.shiprocket.awb          = awb
        order.shiprocket.courier_name = awbRes?.response?.data?.courier_name || ''
        order.shiprocket.status       = 'awb_assigned'
        order.trackingId              = awb
        await order.save()
      }
    } catch (e) {
      console.error('[Shiprocket] AWB assignment failed:', e?.response?.data || e.message)
      // Non-fatal — admin can retry AWB from panel
    }

    // ── Step 3: Schedule pickup ───────────────────────────────────────────
    try {
      await shiprocket.schedulePickup(shipment_id)
      order.shiprocket.status = 'pickup_scheduled'
      order.orderStatus       = 'shipped'
      await order.save()
    } catch (e) {
      console.error('[Shiprocket] Pickup scheduling failed:', e?.response?.data || e.message)
    }

    // ── Step 4: Email customer ────────────────────────────────────────────
    if (order.user?.email && awb) {
      sendEmail(
        order.user.email,
        `Your order has been shipped! — ${order._id}`,
        `Your Black Valley order is on its way. Tracking AWB: ${awb}`,
        `<div style="font-family:Georgia,serif;padding:32px;background:#faf9f6;border-radius:12px;max-width:600px;margin:0 auto;">
          <h2 style="color:#1a2e1a;">Your order is shipped!</h2>
          <p style="color:#4a5a4a;">Great news — your Black Valley order (${order._id}) has been handed to our courier partner.</p>
          <p style="color:#4a5a4a;">Tracking AWB: <strong>${awb}</strong></p>
          ${order.shiprocket?.courier_name ? `<p style="color:#4a5a4a;">Courier: ${order.shiprocket.courier_name}</p>` : ''}
          <p style="color:#8a7a5a;font-size:12px;margin-top:32px;">Black Valley · Himalayan Shilajit</p>
        </div>`
      ).catch(console.error)
    }

    res.status(200).json({
      msg:         'Order pushed to Shiprocket.',
      sr_order_id,
      shipment_id,
      awb,
      orderStatus: order.orderStatus,
      shiprocket:  order.shiprocket,
    })
  },

  // ── POST /admin/shipping/push-bulk
  // Push multiple orders at once.
  // Body: { orderIds: [...], weight? }
  pushBulkToShiprocket: async (req, res) => {
    const { orderIds, weight = 0.5 } = req.body
    if (!Array.isArray(orderIds) || orderIds.length === 0)
      throw new AppError('orderIds array is required.', 400)

    const results = []
    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId).populate('user', 'email mobile')
        if (!order)            { results.push({ orderId, success: false, error: 'Not found' }); continue }
        if (!order.shippingAddress) { results.push({ orderId, success: false, error: 'No shipping address' }); continue }
        if (order.shiprocket?.sr_order_id) { results.push({ orderId, success: false, error: 'Already pushed' }); continue }

        const srRes      = await shiprocket.createShiprocketOrder(order, weight)
        const sr_order_id = srRes.order_id
        const shipment_id = srRes.shipment_id

        order.shiprocket = { sr_order_id, shipment_id, status: 'created' }
        order.orderStatus = 'processing'
        await order.save()

        // AWB
        let awb = null
        try {
          const awbRes = await shiprocket.assignAWB(shipment_id)
          awb = awbRes?.response?.data?.awb_code || awbRes?.awb_code || null
          if (awb) {
            order.shiprocket.awb          = awb
            order.shiprocket.courier_name = awbRes?.response?.data?.courier_name || ''
            order.shiprocket.status       = 'awb_assigned'
            order.trackingId              = awb
            await order.save()
          }
        } catch {}

        // Pickup
        try {
          await shiprocket.schedulePickup(shipment_id)
          order.shiprocket.status = 'pickup_scheduled'
          order.orderStatus       = 'shipped'
          await order.save()
        } catch {}

        results.push({ orderId, success: true, sr_order_id, shipment_id, awb })
      } catch (e) {
        results.push({ orderId, success: false, error: e?.response?.data?.message || e.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    res.status(200).json({
      msg: `${successCount}/${orderIds.length} orders pushed to Shiprocket.`,
      results,
    })
  },

  // ── GET /admin/shipping/track/:orderId
  // Track a single order by your internal order id.
  trackOrder: async (req, res) => {
    const order = await Order.findById(req.params.orderId)
    if (!order) throw new AppError('Order not found.', 404)

    const awb = order.shiprocket?.awb
    if (!awb) throw new AppError('No AWB assigned to this order yet.', 400)

    const tracking = await shiprocket.trackShipment(awb)
    res.status(200).json({ tracking, awb, shiprocket: order.shiprocket })
  },

  // ── GET /admin/shipping/label/:orderId
  // Get label PDF URL for printing.
  getLabel: async (req, res) => {
    const order = await Order.findById(req.params.orderId)
    if (!order) throw new AppError('Order not found.', 404)
    if (!order.shiprocket?.shipment_id) throw new AppError('Order not pushed to Shiprocket yet.', 400)

    const label = await shiprocket.generateLabel(order.shiprocket.shipment_id)
    res.status(200).json({ label })
  },

  // ── POST /admin/shipping/cancel/:orderId
  cancelShipment: async (req, res) => {
    const order = await Order.findById(req.params.orderId).populate('user', 'email')
    if (!order) throw new AppError('Order not found.', 404)
    if (!order.shiprocket?.sr_order_id) throw new AppError('Order not pushed to Shiprocket.', 400)

    await shiprocket.cancelShiprocketOrder([order.shiprocket.sr_order_id])

    order.shiprocket.status = 'cancelled'
    order.orderStatus       = 'cancelled'
    order.paymentStatus     = order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus
    await order.save()

    res.status(200).json({ msg: 'Shipment cancelled.', order })
  },

  // ── GET /admin/shipping/serviceability
  // Check which couriers serve a pincode pair.
  // Query: ?pickup_pincode=&delivery_pincode=&weight=
  checkServiceability: async (req, res) => {
    const { pickup_pincode, delivery_pincode, weight = 0.5 } = req.query
    if (!pickup_pincode || !delivery_pincode)
      throw new AppError('pickup_pincode and delivery_pincode are required.', 400)

    const result = await shiprocket.checkServiceability({
      pickup_pincode, delivery_pincode, weight,
    })
    res.status(200).json({ result })
  },
}

module.exports = shipping