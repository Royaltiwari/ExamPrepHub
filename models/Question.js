const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true
    },

    // =========================
    // BILINGUAL QUESTION
    // =========================

    questionHindi: {
      type: String,
      trim: true,
      default: ""
    },

    questionEnglish: {
      type: String,
      trim: true,
      default: ""
    },

    // Existing question field
    question: {
      type: String,
      required: true,
      trim: true
    },

    // =========================
    // OPTIONS
    // =========================

    optionsHindi: {
      type: [String],
      default: []
    },

    optionsEnglish: {
      type: [String],
      default: []
    },

    // Existing options field
    options: {
      type: [String],
      required: true,
      validate: {
        validator: function (value) {
          return value.length === 4;
        },
        message: "Question must have exactly 4 options."
      }
    },

    // =========================
    // ANSWER
    // =========================

    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },

    // =========================
    // EXPLANATION
    // =========================

    explanationHindi: {
      type: String,
      default: ""
    },

    explanationEnglish: {
      type: String,
      default: ""
    },

    // Existing explanation
    explanation: {
      type: String,
      default: ""
    },

    type: {
      type: String,
      enum: ["single"],
      default: "single"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Question", questionSchema);