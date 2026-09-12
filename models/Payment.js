const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    itemType: {
      type: String,
      enum: ["class", "test", "bundle"],
      required: true
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    itemTitle: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    // Payment proof
    utrNumber: {
      type: String,
      required: true,
      trim: true
    },

    screenshotUrl: {
      type: String,
      default: ""
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    // Admin action
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    approvedAt: {
      type: Date
    },

    rejectionReason: {
      type: String,
      default: ""
    },

    notes: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ itemType: 1, itemId: 1, userId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
