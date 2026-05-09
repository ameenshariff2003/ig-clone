const Cart    = require('../models/cart.model')
const Product = require('../models/product.model')
const AppError = require('../utils/AppError')

// helper — normalize cart for response
const cartResponse = (cartDoc) => ({
  items: cartDoc.items.map(i => ({
    _id:          i._id.toString(),
    productId:    i.productId.toString(),
    variantId:    i.variantId.toString(),
    productName:  i.productName,
    variantLabel: i.variantLabel,
    weight:       i.weight,
    price:        i.price,
    image:        i.image,
    quantity:     i.quantity,
  })),
  total: cartDoc.total,
})

const cart = {

  // GET /cart
  getCart: async (req, res) => {
    const cartDoc = await Cart.findOne({ user: req.user._id })
    if (!cartDoc || cartDoc.items.length === 0)
      return res.status(200).json({ items: [], total: 0 })
    res.status(200).json(cartResponse(cartDoc))
  },

  // POST /cart — { productId, variantId, quantity }
  addToCart: async (req, res) => {
    const { productId, variantId, quantity = 1 } = req.body

    if (!productId || !variantId)
      throw new AppError('productId and variantId are required.', 400)

    if (!Number.isInteger(quantity) || quantity < 1)
      throw new AppError('quantity must be a positive integer.', 400)

    const product = await Product.findById(productId)
    if (!product)          throw new AppError('Product not found.', 404)
    if (!product.isActive) throw new AppError('Product is not available.', 400)

    const variant = product.variants.id(variantId)
    if (!variant)          throw new AppError('Variant not found.', 404)
    if (!variant.isActive) throw new AppError('This variant is currently unavailable.', 400)
    if (variant.stock < quantity)
      throw new AppError(`Only ${variant.stock} units in stock.`, 400)

    let cartDoc = await Cart.findOne({ user: req.user._id })
    if (!cartDoc) cartDoc = new Cart({ user: req.user._id, items: [] })

    const existingItem = cartDoc.items.find(
      item => item.variantId.toString() === variantId.toString()
    )

    if (existingItem) {
      const newQty = existingItem.quantity + quantity
      if (newQty > 10)
        throw new AppError('Maximum 10 units per variant.', 400)
      if (variant.stock < newQty)
        throw new AppError(`Only ${variant.stock} units in stock.`, 400)
      existingItem.quantity = newQty
      existingItem.price    = variant.price
    } else {
      cartDoc.items.push({
        productId:    product._id,
        variantId:    variant._id,
        productName:  product.name,
        variantLabel: variant.label,
        weight:       variant.weight,
        price:        variant.price,
        image:        product.images[0]?.url ?? null,
        quantity,
      })
    }

    await cartDoc.save()
    res.status(200).json({ msg: 'Item added to cart.', ...cartResponse(cartDoc) })
  },

  // PATCH /cart/:itemId — { quantity }
  updateItem: async (req, res) => {
    const { quantity } = req.body
    const { itemId }   = req.params

    if (!Number.isInteger(quantity) || quantity < 0)
      throw new AppError('quantity must be a non-negative integer.', 400)

    const cartDoc = await Cart.findOne({ user: req.user._id })
    if (!cartDoc) throw new AppError('Cart not found.', 404)

    const item = cartDoc.items.id(itemId)
    if (!item) throw new AppError('Item not found in cart.', 404)

    if (quantity === 0) {
      item.deleteOne()
    } else {
      const product = await Product.findById(item.productId)
      const variant = product?.variants.id(item.variantId)

      if (variant && variant.stock < quantity)
        throw new AppError(`Only ${variant.stock} units in stock.`, 400)

      item.quantity = quantity
      item.price    = variant?.price ?? item.price
    }

    await cartDoc.save()
    res.status(200).json({ msg: 'Cart updated.', ...cartResponse(cartDoc) })
  },

  // DELETE /cart/:itemId
  removeItem: async (req, res) => {
    const cartDoc = await Cart.findOne({ user: req.user._id })
    if (!cartDoc) throw new AppError('Cart not found.', 404)

    const item = cartDoc.items.id(req.params.itemId)
    if (!item) throw new AppError('Item not found in cart.', 404)

    item.deleteOne()
    await cartDoc.save()
    res.status(200).json({ msg: 'Item removed.', ...cartResponse(cartDoc) })
  },

  // DELETE /cart
  clearCart: async (req, res) => {
    await Cart.findOneAndDelete({ user: req.user._id })
    res.status(200).json({ msg: 'Cart cleared.', items: [], total: 0 })
  },
}

module.exports = { cart }