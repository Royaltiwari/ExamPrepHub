const mongoose = require("mongoose");

const liveClassSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    class: { type: String, required: true, enum: ["10", "11", "12", "competitive"] },
    subject: { type: String, required: true, trim: true },
    youtubeUrl: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, default: Date.now },
    isLive: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

liveClassSchema.index({ class: 1, visible: 1, scheduledAt: -1 });

module.exports = mongoose.model("LiveClass", liveClassSchema);
