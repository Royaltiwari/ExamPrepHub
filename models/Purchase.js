const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
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

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
    },

    isActive: {
      type: Boolean,
      default: true
    },

    // Kab tak access valid hai
    validUntil: {
      type: Date,
      default: null  // null = lifetime
    }
  },
  { timestamps: true }
);

// Ek user, ek item, ek hi baar
purchaseSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model("Purchase", purchaseSchema);
