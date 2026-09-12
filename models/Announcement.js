const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    class: { type: String, default: "all", enum: ["all", "10", "11", "12", "competitive"] },
    visible: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

announcementSchema.index({ class: 1, visible: 1, createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
