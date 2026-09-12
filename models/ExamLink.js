const mongoose = require("mongoose");

const examLinkSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    category: {
      type: String,
      default: "SSC",   // SSC, Railway, Defence, Police, UPSSSC, Banking, Teaching, Other
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    icon: {
      type: String,
      default: "🏆"
    },

    pdfUrl: {
      type: String,
      default: "",
      trim: true
    },

    testUrl: {
      type: String,
      default: "",
      trim: true
    },

    demoUrl: {
      type: String,
      default: "",
      trim: true
    },

    order: {
      type: Number,
      default: 0
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

examLinkSchema.index({ category: 1, order: 1, visible: 1 });

module.exports = mongoose.model("ExamLink", examLinkSchema);
