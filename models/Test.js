const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    test_name: { type: String, required: true, trim: true },
    exam_id: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
    batch: { type: String, default: "" },
    language: { type: String, default: "Hindi + English" },
    duration: { type: Number, default: 30 },
    total_questions: { type: Number, default: 0 },
    question_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    visible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Test", testSchema);
