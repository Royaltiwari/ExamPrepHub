const mongoose = require("mongoose");
const savedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    itemType: { type: String, enum: ["class", "test", "pdf", "question"], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    itemTitle: { type: String, default: "" },
    itemMeta: { type: String, default: "" },
    thumbnail: { type: String, default: "" }
  },
  { timestamps: true }
);
savedSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });
module.exports = mongoose.model("Saved", savedSchema);
