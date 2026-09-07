const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true
    },

    score: {
      type: Number,
      required: true,
      default: 0
    },

    totalQuestions: {
      type: Number,
      required: true,
      default: 0
    },

    correctAnswers: {
      type: Number,
      default: 0
    },

    wrongAnswers: {
      type: Number,
      default: 0
    },

    skippedQuestions: {
      type: Number,
      default: 0
    },

    percentage: {
      type: Number,
      default: 0
    },

    timeTaken: {
      type: Number,
      default: 0
    },

    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question"
        },

        selectedAnswer: {
          type: Number,
          default: null
        },

        isCorrect: {
          type: Boolean,
          default: false
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Result", resultSchema);