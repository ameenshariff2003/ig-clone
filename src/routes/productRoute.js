const express = require("express");
const multer  = require("multer");

const {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  addImages,
  deleteProductImage,
  reorderImages,
  toggleActive,
} = require("../controllers/admin.ctrl");

const { isAuthenticated, isAdmin } = require("../middleware/isAdmin");
const asyncHandler                 = require("../middleware/asyncHandler");

const productRouter  = express.Router();
const upload  = multer({ storage: multer.memoryStorage() });

// ─── PUBLIC ROUTES (no auth required) ────────────────────────────────────────
productRouter.get("/",    asyncHandler(getAllProducts));
// productRouter.get("/:id", asyncHandler(getProduct));

// ─── ADMIN-ONLY ROUTES ────────────────────────────────────────────────────────
productRouter.use(isAuthenticated, isAdmin);

productRouter.post(
  "/",
  upload.array("images", 4),
  asyncHandler(createProduct)
);

productRouter.patch("/:id",          asyncHandler(updateProduct));
productRouter.delete("/:id",         asyncHandler(deleteProduct));
productRouter.patch("/:id/toggle",   asyncHandler(toggleActive));

// Image management
productRouter.post(
  "/:id/images",
  upload.array("images", 4),
  asyncHandler(addImages)
);
productRouter.delete("/:id/images/:imageId", asyncHandler(deleteProductImage));
productRouter.patch("/:id/images/reorder",   asyncHandler(reorderImages));

module.exports = productRouter;