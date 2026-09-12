const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Competitive"]
    },

    examName: {
      type: String,
      required: true,
      trim: true
    },

    subject: {
      type: String,
      required: true,
      trim: true
    },

    topic: {
      type: String,
      default: "",
      trim: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    thumbnail: {
      type: String,
      default: ""
    },

    teacher: {
      type: String,
      default: "",
      trim: true
    },

    scheduledDate: {
      type: Date,
      default: Date.now
    },

    scheduledTime: {
      type: String,
      default: ""
    },

    liveUrl: {
      type: String,
      default: "",
      trim: true
    },

    recordedUrl: {
      type: String,
      default: "",
      trim: true
    },

    supportingPdf: {
      type: String,
      default: "",
      trim: true
    },

    duration: {
      type: Number,
      default: 60
    },

    status: {
      type: String,
      enum: ["scheduled", "live", "recorded"],
      default: "scheduled"
    },

    visible: {
      type: Boolean,
      default: true
    },

    views: {
      type: Number,
      default: 0
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

classSchema.index({ category: 1, examName: 1, subject: 1, status: 1, visible: 1 });

module.exports = mongoose.model("Class", classSchema);
