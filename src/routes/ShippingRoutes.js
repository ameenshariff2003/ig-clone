// routes/shippingRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Mount this in app.js:
//   const shippingRoutes = require('./routes/shippingRoutes')
//   app.use('/admin/shipping', isAuthenticated, isAdmin, shippingRoutes)
// ─────────────────────────────────────────────────────────────────────────────

const express      = require('express')
const asyncHandler = require('../middleware/asyncHandler')
const ctrl         = require('../controllers/shipping.ctrl')
const { isAuthenticated, isAdmin }   = require("../middleware/isAdmin");

const shippingRouter = express.Router()

shippingRouter.use(isAuthenticated, isAdmin);



// Single order push to Shiprocket
shippingRouter.post('/push',           asyncHandler(ctrl.pushToShiprocket))

// Bulk push (multiple selected orders)
shippingRouter.post('/push-bulk',      asyncHandler(ctrl.pushBulkToShiprocket))

// Track by internal order id
shippingRouter.get('/track/:orderId',  asyncHandler(ctrl.trackOrder))

// Get printable label
shippingRouter.get('/label/:orderId',  asyncHandler(ctrl.getLabel))

// Cancel shipment
shippingRouter.post('/cancel/:orderId', asyncHandler(ctrl.cancelShipment))

// Serviceability check (which couriers serve a pincode)
shippingRouter.get('/serviceability',  asyncHandler(ctrl.checkServiceability))

module.exports = shippingRouter