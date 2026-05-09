const express      = require('express')
const { cart }     = require('../controllers/cart.ctrl')
const asyncHandler = require('../middleware/asyncHandler')
const { protect }  = require('../middleware/protect')

const cartRouter = express.Router()

// All cart routes require login
cartRouter.use(protect)

cartRouter.get   ('/',        asyncHandler(cart.getCart))
cartRouter.post   ('/',        asyncHandler(cart.addToCart))
cartRouter.patch ('/:itemId', asyncHandler(cart.updateItem))   // was PUT, now PATCH
cartRouter.delete('/:itemId', asyncHandler(cart.removeItem))   // was clearCart, now removeItem
cartRouter.delete('/',        asyncHandler(cart.clearCart))    // was getProduct, now clearCart
 

module.exports = cartRouter