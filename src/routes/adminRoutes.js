const express      = require("express");
const { upload, handleMulterError }  = require("../config/multer");
const adminOrders  = require('../controllers/adminOrder.ctrl')
const adminUsers   = require('../controllers/adminUsers.ctrl')

const { isAuthenticated, isAdmin }   = require("../middleware/isAdmin");
const asyncHandler = require("../middleware/asyncHandler");
const ctrl         = require("../controllers/admin.ctrl");

const adminRouter = express.Router();

// Every route below requires a valid JWT + admin role
adminRouter.use(isAuthenticated, isAdmin);

// ── Orders (must come BEFORE /:id to avoid route conflict) ──
adminRouter.get   ('/orders/stats', asyncHandler(adminOrders.getStats))
adminRouter.get   ('/orders',       asyncHandler(adminOrders.getAllOrders))
adminRouter.get   ('/orders/:id',   asyncHandler(adminOrders.getOrderById))
adminRouter.patch ('/orders/:id',   asyncHandler(adminOrders.updateOrder))

// ── Users (must come BEFORE /:id to avoid "users" being treated as a product ID) ──
// FIX: These were placed AFTER /:id which caused /admin/users to match /:id
//      with id="users" → requireValidId threw "Invalid ID: users" → 400
adminRouter.get   ('/users',          asyncHandler(adminUsers.getAllUsers))
adminRouter.get   ('/users/:id',      asyncHandler(adminUsers.getUserById))
adminRouter.patch ('/users/:id',      asyncHandler(adminUsers.updateUser))
adminRouter.delete('/users/:id',      asyncHandler(adminUsers.deleteUser))
adminRouter.patch ('/users/:id/role', asyncHandler(adminUsers.changeRole))

// ── Products ──
adminRouter
  .route("/")
  .post(upload.array("images", 4), handleMulterError, asyncHandler(ctrl.createProduct))
  .get(asyncHandler(ctrl.getAllProducts));

adminRouter
  .route("/:id")
  .get(asyncHandler(ctrl.getProduct))
  .patch(asyncHandler(ctrl.updateProduct))
  .delete(asyncHandler(ctrl.deleteProduct));

// Image management
adminRouter.post(  "/:id/images",          upload.array("images", 4), handleMulterError, asyncHandler(ctrl.addImages));
adminRouter.delete("/:id/images/:imageId", asyncHandler(ctrl.deleteProductImage));
adminRouter.patch( "/:id/images/reorder",  asyncHandler(ctrl.reorderImages));

// Visibility toggle
adminRouter.patch("/:id/toggle", asyncHandler(ctrl.toggleActive));

module.exports = adminRouter;