const mongoose = require('mongoose')

const lineItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantId:    { type: mongoose.Schema.Types.ObjectId },
  name:         String,
  variantLabel: String,
  weight:       String,
  unitPrice:    Number,
  quantity:     Number,
  lineTotal:    Number,
}, { _id: false })

const orderSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:      [lineItemSchema],
  totalPaise: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },   // ← NEW: in paise

  shippingAddress: {
    fullName: String,
    phone:    String,
    line1:    String,
    line2:    String,
    city:     String,
    state:    String,
    pincode:  String,
    country:  { type: String, default: 'India' },
  },

  razorpay: {
    orderId:   String,
    paymentId: String,
    signature: String,
  },

  refund: {
    refundId:     String,
    refundStatus: String,
    refundedAt:   Date,
    refundPaise:  Number,
  },

  paymentStatus: {
    type:    String,
    enum:    ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },

  orderStatus: {
    type:    String,
    enum:    ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'placed',
  },

  trackingId: String,
  adminNote:  String,
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)