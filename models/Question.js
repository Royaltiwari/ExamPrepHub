const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question_hi: { type: String, default: "", trim: true },
    question_en: { type: String, default: "", trim: true },
    questionText: { type: String, default: "" },

    options: [{ type: String }],
    options_en: [{ type: String }],

    answer: { type: String, required: true },
    correctAnswer: { type: Number, default: 0 },

    explanation_hi: { type: String, default: "" },
    explanation_en: { type: String, default: "" },
    explanation: { type: String, default: "" },

    key_points: [{ type: String }],

    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
    exam_id: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },

    subject: { type: String, default: "General" },
    chapter: { type: String, default: "General" },
    examType: String,
    topic: String,

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium"
    },
    language: { type: String, default: "bilingual" },
    type: { type: String, default: "single" },

    marks: { type: Number, default: 1 },
    negative: { type: Number, default: 0.25 },

    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test" },
    tests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Test" }],
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Batch" }],

    questionNumber: { type: Number, default: 0 },

    isSelected: { type: Boolean, default: false },
    selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    selectedDate: Date,

    sourcePDF: String,
    pageNumber: Number,

    visible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
