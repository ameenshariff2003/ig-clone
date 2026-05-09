// const mongoose = require("mongoose")


// const otpSchema = new mongoose.Schema({
//     email:{
//         type:String,
//         required:[true,"Email is required"]
//     },
//     user:{
//         type:mongoose.Schema.Types.ObjectId,
//         ref:"User",
//         required:[true,"User is Required"]

//     },

//     otpHash:{
//         type:String,
//         required:[true,"otp Hash is Required"]

//     }
// },

//     {
//         timestamps:true
//     })


//     const optModel = mongoose.model("Otps",otpSchema)

//     module.exports = optModel


const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email:     { type: String },           // present for email OTPs
    mobile:    { type: String },           // present for SMS OTPs
    channel:   { type: String, enum: ["email", "sms"], required: true },
    otpHash:   { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete expired documents (MongoDB TTL index)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
    