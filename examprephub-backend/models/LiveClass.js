const mongoose = require("mongoose");

const liveClassSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    class: {
      type: String,
      required: true,
      enum: ["10", "11", "12", "competitive"]
    },

    subject: {
      type: String,
      required: true,
      trim: true
    },

    youtubeUrl: {
      type: String,
      required: true,
      trim: true
    },

    // LIVE CLASS ke liye
    isLive: {
      type: Boolean,
      default: false
    },

    // PAST / RECORDED CLASS ke liye
    status: {
      type: String,
      enum: ["live", "upcoming", "completed"],
      default: "upcoming"
    },

    scheduledAt: {
      type: Date,
      default: Date.now
    },

    duration: {
      type: Number,
      default: 0  // minutes me
    },

    thumbnail: {
      type: String,
      default: ""
    },

    visible: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

liveClassSchema.index({ class: 1, visible: 1, status: 1, scheduledAt: -1 });

module.exports = mongoose.model("LiveClass", liveClassSchema);