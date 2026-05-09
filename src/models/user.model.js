const mongoose = require("mongoose");

const E164_REGEX = /^\+[1-9]\d{7,14}$/; // e.g. +919876543210

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone:    { type: String, trim: true },
    line1:    { type: String, trim: true },
    line2:    { type: String, trim: true, default: "" },
    city:     { type: String, trim: true },
    state:    { type: String, trim: true },
    pincode:  { type: String, trim: true },
    country:  { type: String, trim: true, default: "India" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      unique: true,
      required: [true, "Mobile number is required"],
      trim: true,
      validate: {
        validator: (v) => E164_REGEX.test(v),
        message: "Mobile must be in E.164 format (e.g. +919876543210)",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    image: {
      type: String,
      default: "",
    },
    role: {
      type:    String,
      enum:    { values: ["user", "admin"], message: 'Role must be "user" or "admin"' },
      default: "user",
      select:  false, // never leaked in API responses unless explicitly selected
    },
    verifiedEmail:  { type: Boolean, default: false },
    verifiedMobile: { type: Boolean, default: false },

    // Saved shipping address — pre-filled at checkout
    savedAddress: { type: addressSchema, default: null },

    passwordResetToken:   String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);