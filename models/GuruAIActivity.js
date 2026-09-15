const mongoose = require("mongoose");

const guruAIActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    studentName: {
      type: String,
      default: "Guest",
      trim: true
    },

    question: {
      type: String,
      default: ""
    },

    answer: {
      type: String,
      default: ""
    },

    type: {
      type: String,
      default: "AI Chat"
    },

    documentName: {
      type: String,
      default: ""
    },

    documentId: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["SUCCESS", "ERROR"],
      default: "SUCCESS"
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: "guruai_activities"
  }
);

module.exports =
  mongoose.models.GuruAIActivity ||
  mongoose.model("GuruAIActivity", guruAIActivitySchema);
