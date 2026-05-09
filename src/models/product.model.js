const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },
    fileId:   { type: String, required: true },
    fileName: { type: String, required: true },
    width:    { type: Number },
    height:   { type: Number },
    size:     { type: Number },
    mimeType: { type: String },
  },
  { _id: true }
);

const variantSchema = new mongoose.Schema(
  {
    label:         { type: String, required: [true, "Variant label is required"],  trim: true },
    weight:        { type: String, required: [true, "Variant weight is required"], trim: true },
    price:         { type: Number, required: [true, "Variant price is required"],  min: [0, "Price cannot be negative"] },
    originalPrice: { type: Number, min: [0, "Original price cannot be negative"] },
    servings:      { type: Number, min: [1, "Servings must be at least 1"] },
    sku:           { type: String, trim: true },
    stock:         { type: Number, default: 0, min: [0, "Stock cannot be negative"] },
    badge:         { type: String, trim: true },
    isActive:      { type: Boolean, default: true },
  },
  { _id: true }
);

const ingredientSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    percentage:  { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: true }
);

const benefitSchema = new mongoose.Schema(
  {
    icon:  { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    desc:  { type: String, trim: true },
  },
  { _id: true }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer:   { type: String, required: true, trim: true },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name:     { type: String, required: [true, "Product name is required"],        trim: true, maxlength: [200, "Name cannot exceed 200 characters"] },
    slug:     { type: String, unique: true, lowercase: true, trim: true },
    subtitle: { type: String, trim: true, maxlength: [300, "Subtitle cannot exceed 300 characters"] },
    tagline:  { type: String, trim: true, maxlength: [500, "Tagline cannot exceed 500 characters"] },

    description:      { type: String, required: [true, "Description is required"] },
    shortDescription: { type: String, maxlength: [500, "Short description cannot exceed 500 characters"] },

    images: {
      type:     [imageSchema],
      validate: {
        validator: (arr) => arr.length <= 4,
        message:   "A product can have at most 4 images",
      },
      default: [],
    },

    variants:       { type: [variantSchema],    default: [] },
    certifications: { type: [String],           default: [] },
    benefits:       { type: [benefitSchema],    default: [] },
    ingredients:    { type: [ingredientSchema], default: [] },
    howToUse:       { type: [{ step: String, title: String, desc: String }], default: [] },
    faqs:           { type: [faqSchema],        default: [] },

    metaTitle:       { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    tags:            { type: [String], default: [] },

    isActive:    { type: Boolean, default: true },
    isFeatured:  { type: Boolean, default: false },
    rating:      { type: Number,  default: 0, min: 0, max: 5 },
    reviewCount: { type: Number,  default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

productSchema.index({ isActive: 1, isFeatured: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ createdAt: -1 });

const slugify = (str) =>
  str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

productSchema.pre("save", async function () {
  if (!this.isModified("name")) return;

  let base = slugify(this.name);
  let slug = base;
  let counter = 1;

  while (await mongoose.model("Product").exists({ slug, _id: { $ne: this._id } })) {
    slug = `${base}-${counter++}`;
  }

  this.slug = slug;
});

productSchema.virtual("primaryImage").get(function () {
  return this.images[0]?.url || null;
});

productSchema.virtual("startingPrice").get(function () {
  if (!this.variants.length) return null;
  return Math.min(...this.variants.filter((v) => v.isActive).map((v) => v.price));
});

module.exports = mongoose.model("Product", productSchema);