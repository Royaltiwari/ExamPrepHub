const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, trim: true },
    identifierType: { type: String, enum: ["email", "mobile"], required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OTP", otpSchema);
