const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema(
  {
    subject_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    chapter_name: {
      type: String,
      required: true,
      trim: true
    },
    chapter_name_hi: {
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
    }
  },
  { timestamps: true }
);

// Prevent duplicate chapter name within same subject
chapterSchema.index({ subject_id: 1, chapter_name: 1 }, { unique: true });

module.exports = mongoose.model("Chapter", chapterSchema);