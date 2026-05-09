const express      = require('express')
const orders       = require('../controllers/order.ctrl')
const asyncHandler = require('../middleware/asyncHandler')
const { protect }  = require('../middleware/protect')

const orderRouter = express.Router()

orderRouter.use(protect)

orderRouter.post('/create-razorpay-order',  asyncHandler(orders.createRazorpayOrder))
orderRouter.post('/verify-payment',         asyncHandler(orders.verifyPayment))
orderRouter.get ('/my',                     asyncHandler(orders.getMyOrders))
orderRouter.get ('/:id',                    asyncHandler(orders.getOrderById))

// ✅ Cancel order + automatic Razorpay refund
orderRouter.post('/:id/cancel',             asyncHandler(orders.cancelOrder))

module.exports = orderRouter