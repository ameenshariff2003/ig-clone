// services/shiprocket.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Shiprocket REST API wrapper
// Base URL : https://apiv2.shiprocket.in/v1/external
//
// ENV vars required in .env:
//   SHIPROCKET_EMAIL=your_api_user@example.com
//   SHIPROCKET_PASSWORD=your_api_password
//   SHIPROCKET_PICKUP_LOCATION=Primary   ← name of pickup address in SR panel
//   SHIPROCKET_CHANNEL_ID=123456         ← optional, your SR channel/store id
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios')

const SR_BASE = 'https://apiv2.shiprocket.in/v1/external'

// ── Token cache (tokens are valid ~24 hrs per Shiprocket docs) ────────────────
let _token     = null
let _tokenExp  = 0          // unix ms

async function getToken() {
  if (_token && Date.now() < _tokenExp) return _token

  const { data } = await axios.post(`${SR_BASE}/auth/login`, {
    email:    process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  })

  _token    = data.token
  // Expire 23 hrs after issue (SR tokens valid 24 hrs; 1 hr safety margin)
  _tokenExp = Date.now() + 23 * 60 * 60 * 1000
  return _token
}

// Axios instance that auto-attaches Bearer token
async function sr(method, path, body = null) {
  const token = await getToken()
  const cfg = {
    method,
    url: `${SR_BASE}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
  if (body) cfg.data = body
  const { data } = await axios(cfg)
  return data
}

// ── 1. Create a Shiprocket order ──────────────────────────────────────────────
// Call this once the admin decides to ship an order.
// `order`  — your Mongoose Order document (populated with user)
// `product_weight_kg` — total shipment weight in kg (you pass this in)
async function createShiprocketOrder(order, product_weight_kg = 0.5) {
  const addr = order.shippingAddress
  const channelId = process.env.SHIPROCKET_CHANNEL_ID

  // Build line items for Shiprocket
  const order_items = order.items.map(i => ({
    name:      i.productName || 'Product',
    sku:       i.sku || `SKU-${i.variantId}`,
    units:     i.quantity,
    selling_price: i.priceAtPurchase / 100,  // SR wants ₹, we store paise
    discount:  0,
    tax:       0,
  }))

  const payload = {
    order_id:          order._id.toString(),          // your internal order id
    order_date:        new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location:   process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    ...(channelId ? { channel_id: channelId } : {}),

    // Billing  = Shipping (same for most D2C)
    billing_customer_name:  addr.fullName,
    billing_last_name:      '',
    billing_address:        addr.line1,
    billing_address_2:      addr.line2 || '',
    billing_city:           addr.city,
    billing_pincode:        addr.pincode,
    billing_state:          addr.state,
    billing_country:        addr.country || 'India',
    billing_email:          order.user?.email || '',
    billing_phone:          addr.phone || order.user?.mobile || '',

    shipping_is_billing: true,

    order_items,
    payment_method:    order.paymentStatus === 'paid' ? 'Prepaid' : 'COD',
    sub_total:         (order.totalPaise - (order.deliveryCharge || 0)) / 100,
    length:            15,   // cm — update to match your packaging
    breadth:           12,
    height:            5,
    weight:            product_weight_kg,
  }

  return sr('POST', '/orders/create/adhoc', payload)
}

// ── 2. Generate AWB (Air Waybill) & assign courier ────────────────────────────
// After order is created in SR, assign a courier to get tracking AWB.
// `shipment_id` comes from createShiprocketOrder response.
// `courier_id`  is optional — if omitted SR auto-picks cheapest.
async function assignAWB(shipment_id, courier_id = null) {
  const body = { shipment_id: [shipment_id] }
  if (courier_id) body.courier_id = courier_id
  return sr('POST', '/courier/assign/awb', body)
}

// ── 3. Schedule pickup ────────────────────────────────────────────────────────
async function schedulePickup(shipment_id) {
  return sr('POST', '/courier/generate/pickup', {
    shipment_id: [shipment_id],
  })
}

// ── 4. Generate shipping label ────────────────────────────────────────────────
async function generateLabel(shipment_id) {
  return sr('POST', '/courier/generate/label', {
    shipment_id: [shipment_id],
  })
}

// ── 5. Track by AWB ───────────────────────────────────────────────────────────
async function trackShipment(awb) {
  return sr('GET', `/courier/track/awb/${awb}`)
}

// ── 6. Track by Shiprocket order id ──────────────────────────────────────────
async function trackByOrderId(sr_order_id) {
  return sr('GET', `/courier/track/id/${sr_order_id}`)
}

// ── 7. Get available couriers (serviceability check) ─────────────────────────
async function checkServiceability({ pickup_pincode, delivery_pincode, weight, cod = 0 }) {
  const qs = new URLSearchParams({
    pickup_postcode:   pickup_pincode,
    delivery_postcode: delivery_pincode,
    weight,
    cod,
  })
  return sr('GET', `/courier/serviceability/?${qs}`)
}

// ── 8. Cancel shipment ────────────────────────────────────────────────────────
async function cancelShiprocketOrder(sr_order_ids) {
  // sr_order_ids = array of shiprocket order ids
  return sr('POST', '/orders/cancel', { ids: sr_order_ids })
}

module.exports = {
  getToken,
  createShiprocketOrder,
  assignAWB,
  schedulePickup,
  generateLabel,
  trackShipment,
  trackByOrderId,
  checkServiceability,
  cancelShiprocketOrder,
}