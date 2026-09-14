const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    exam_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam"
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    price: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    visible: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Batch", batchSchema);
