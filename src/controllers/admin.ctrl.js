// admin.ctrl.js
const mongoose  = require("mongoose");
const Product   = require("../models/product.model");
const AppError  = require("../utils/AppError");
const { uploadImage, deleteImage, deleteImages } = require("../services/imageKit.services");

const requireValidId = (id, label = "ID") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}: "${id}".`, 400);
  }
};

const uploadFiles = (files, folder) =>
  Promise.all(files.map((f) => uploadImage(f.buffer, f.originalname, folder)));

// ─── CREATE ────────────────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  let body = req.body;
  if (typeof req.body.data === "string") {
    try { body = JSON.parse(req.body.data); }
    catch { throw new AppError('The "data" field must be valid JSON.', 400); }
  }

  if (!body.name)        throw new AppError("Product name is required.",        400);
  if (!body.description) throw new AppError("Product description is required.", 400);

  const files = req.files || [];
  if (files.length > 4)  throw new AppError("A product can have at most 4 images.", 400);

  const uploadedImages = await uploadFiles(files, "/products");

  const product = await Product.create({
    ...body,
    images:    uploadedImages,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json({ msg: "Product created successfully.", product });
};

// ─── READ ALL ──────────────────────────────────────────────────────────────────
const getAllProducts = async (req, res) => {
  const {
    page = 1, limit = 20, search = "",
    isActive, isFeatured,
    sortBy = "createdAt", sortOrder = "desc",
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {};
  if (search.trim()) {
    filter.$or = [
      { name:             { $regex: search.trim(), $options: "i" } },
      { shortDescription: { $regex: search.trim(), $options: "i" } },
      { tags:             { $regex: search.trim(), $options: "i" } },
    ];
  }
  if (isActive   !== undefined) filter.isActive   = isActive   === "true";
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";

  const ALLOWED_SORT = new Set(["createdAt", "updatedAt", "name", "rating", "reviewCount"]);
  const sortField    = ALLOWED_SORT.has(sortBy) ? sortBy : "createdAt";
  const sortDir      = sortOrder === "asc" ? 1 : -1;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .select("-__v")
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    msg: "Products fetched successfully.",
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    products,
  });
};

// ─── READ ONE ─────────────────────────────────────────────────────────────────
const getProduct = async (req, res) => {
  const { id } = req.params;
  const filter  = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
  const product = await Product.findOne(filter).select("-__v").lean();
  if (!product) throw new AppError("Product not found.", 404);
  res.status(200).json({ msg: "Product fetched successfully.", product });
};

// ─── UPDATE ────────────────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  const { id } = req.params;
  requireValidId(id, "product ID");

  let body = req.body;
  if (typeof req.body.data === "string") {
    try { body = JSON.parse(req.body.data); }
    catch { throw new AppError('The "data" field must be valid JSON.', 400); }
  }

  const { images, createdBy, slug, _id, __v, ...safeBody } = body;

  if (Object.keys(safeBody).length === 0) {
    throw new AppError("No updatable fields provided.", 400);
  }

  // FIX: `new: true` deprecated in Mongoose 8 → use `returnDocument: 'after'`
  const product = await Product.findByIdAndUpdate(
    id,
    { ...safeBody, updatedBy: req.user._id },
    { returnDocument: "after", runValidators: true }
  ).select("-__v");

  if (!product) throw new AppError("Product not found.", 404);
  res.status(200).json({ msg: "Product updated successfully.", product });
};

// ─── DELETE ────────────────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  requireValidId(id, "product ID");

  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new AppError("Product not found.", 404);

  await deleteImages(product.images.map((img) => img.fileId));

  res.status(200).json({ msg: "Product and all its images deleted successfully." });
};

// ─── ADD IMAGES ────────────────────────────────────────────────────────────────
const addImages = async (req, res) => {
  const { id } = req.params;
  requireValidId(id, "product ID");

  const files = req.files || [];
  if (files.length === 0) throw new AppError("No image files provided.", 400);

  const product = await Product.findById(id);
  if (!product) throw new AppError("Product not found.", 404);

  const slotsAvailable = 4 - product.images.length;
  if (slotsAvailable <= 0) {
    throw new AppError("This product already has 4 images. Delete one before adding more.", 400);
  }
  if (files.length > slotsAvailable) {
    throw new AppError(
      `You can only add ${slotsAvailable} more image${slotsAvailable > 1 ? "s" : ""} (max 4 total).`,
      400
    );
  }

  const uploaded = await uploadFiles(files, "/products");
  product.images.push(...uploaded);
  product.updatedBy = req.user._id;
  await product.save();

  res.status(200).json({
    msg:    `${uploaded.length} image${uploaded.length > 1 ? "s" : ""} added successfully.`,
    images: product.images,
  });
};

// ─── DELETE ONE IMAGE ─────────────────────────────────────────────────────────
const deleteProductImage = async (req, res) => {
  const { id, imageId } = req.params;
  requireValidId(id,      "product ID");
  requireValidId(imageId, "image ID");

  const product = await Product.findById(id);
  if (!product) throw new AppError("Product not found.", 404);

  const imgIndex = product.images.findIndex((img) => img._id.toString() === imageId);
  if (imgIndex === -1) throw new AppError("Image not found on this product.", 404);

  const [removed] = product.images.splice(imgIndex, 1);
  product.updatedBy = req.user._id;
  await product.save();

  await deleteImage(removed.fileId);

  res.status(200).json({ msg: "Image deleted successfully.", images: product.images });
};

// ─── REORDER IMAGES ───────────────────────────────────────────────────────────
const reorderImages = async (req, res) => {
  const { id } = req.params;
  requireValidId(id, "product ID");

  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError("orderedIds must be a non-empty array of image IDs.", 400);
  }

  const product = await Product.findById(id);
  if (!product) throw new AppError("Product not found.", 404);

  if (orderedIds.length !== product.images.length) {
    throw new AppError(
      `orderedIds must contain exactly ${product.images.length} image ID${product.images.length > 1 ? "s" : ""}.`,
      400
    );
  }

  const imageMap = new Map(product.images.map((img) => [img._id.toString(), img]));

  const reordered = orderedIds.map((imgId) => {
    if (!mongoose.isValidObjectId(imgId)) throw new AppError(`"${imgId}" is not a valid image ID.`, 400);
    const img = imageMap.get(imgId);
    if (!img) throw new AppError(`Image ID "${imgId}" does not belong to this product.`, 400);
    return img;
  });

  product.images    = reordered;
  product.updatedBy = req.user._id;
  await product.save();

  res.status(200).json({ msg: "Images reordered successfully.", images: product.images });
};

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────
const toggleActive = async (req, res) => {
  const { id } = req.params;
  requireValidId(id, "product ID");

  const product = await Product.findById(id);
  if (!product) throw new AppError("Product not found.", 404);

  product.isActive  = !product.isActive;
  product.updatedBy = req.user._id;
  await product.save();

  res.status(200).json({
    msg:      `Product is now ${product.isActive ? "active" : "inactive"}.`,
    isActive: product.isActive,
  });
};

module.exports = {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  addImages,
  deleteProductImage,
  reorderImages,
  toggleActive,
};