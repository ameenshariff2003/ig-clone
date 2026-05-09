const mongoose = require('mongoose')

const cartItemSchema = new mongoose.Schema(
  {
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId:    { type: mongoose.Schema.Types.ObjectId, required: true },
    productName:  { type: String, required: true },
    variantLabel: { type: String },
    weight:       { type: String },
    price:        { type: Number, required: true },  // snapshotted from DB at add time
    image:        { type: String },
    quantity:     { type: Number, required: true, min: [1, 'Quantity must be at least 1'], max: [10, 'Maximum 10 units per item'] },
  },
  { _id: true }
)

const cartSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON:  { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Total in rupees
cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

module.exports = mongoose.model('Cart', cartSchema)