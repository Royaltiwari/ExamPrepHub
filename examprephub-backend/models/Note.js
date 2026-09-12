const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true
    },

    class: {
      type: String,
      required: [true, "Class is required"],
      enum: ["10", "11", "12", "competitive"]
    },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true
    },

    chapter: {
      type: String,
      trim: true,
      default: ""
    },

    pdfUrl: {
      type: String,
      required: [true, "PDF URL is required"],
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
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
  {
    timestamps: true
  }
);

// Index for faster queries
noteSchema.index({ class: 1, subject: 1, visible: 1 });

module.exports = mongoose.model("Note", noteSchema);