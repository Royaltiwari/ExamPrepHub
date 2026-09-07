const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    chapter: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    // Hindi Question
    questionHindi: {
      type: String,
      trim: true,
      default: ""
    },

    // English Question
    questionEnglish: {
      type: String,
      trim: true,
      default: ""
    },

    // Compatibility / Combined Question
    question: {
      type: String,
      required: true,
      trim: true
    },

    // Hindi Options
    optionsHindi: {
      type: [String],
      default: []
    },

    // English Options
    optionsEnglish: {
      type: [String],
      default: []
    },

    // Combined Options
    options: {
      type: [String],
      required: true,
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length === 4;
        },
        message: "Question must have exactly 4 options."
      }
    },

    // 0 = A, 1 = B, 2 = C, 3 = D
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },

    // Hindi Explanation
    explanationHindi: {
      type: String,
      trim: true,
      default: ""
    },

    // English Explanation
    explanationEnglish: {
      type: String,
      trim: true,
      default: ""
    },

    // Combined Explanation
    explanation: {
      type: String,
      trim: true,
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

// Fast loading for test questions
questionSchema.index({
  testId: 1,
  createdAt: 1
});

// Subject + Chapter filtering
questionSchema.index({
  testId: 1,
  subject: 1,
  chapter: 1
});

module.exports = mongoose.model("Question", questionSchema);