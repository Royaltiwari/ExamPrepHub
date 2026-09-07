const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    exam: {
      type: String,
      required: true,
      trim: true
    },

    batch: {
      type: String,
      trim: true,
      default: ""
    },

    subject: {
      type: String,
      trim: true,
      default: ""
    },

    chapter: {
      type: String,
      trim: true,
      default: ""
    },

    language: {
      type: String,
      enum: ["Hindi", "English", "Bilingual"],
      default: "Bilingual"
    },

    duration: {
      type: Number,
      required: true,
      default: 30
    },

    totalQuestions: {
      type: Number,
      default: 0
    },

    description: {
      type: String,
      default: ""
    },

    visible: {
      type: Boolean,
      default: false
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

module.exports = mongoose.model("Test", testSchema);