const mongoose = require("mongoose");
const progressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", default: null },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", default: null },
    type: { type: String, enum: ["class", "test", "pdf"], required: true },
    watchedSeconds: { type: Number, default: 0 },
    totalSeconds: { type: Number, default: 0 },
    completedPercent: { type: Number, default: 0 },
    questionsAttempted: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastPosition: { type: Number, default: 0 },
    subject: { type: String, default: "" },
    examName: { type: String, default: "" }
  },
  { timestamps: true }
);
progressSchema.index({ userId: 1, classId: 1 }, { unique: true, sparse: true });
progressSchema.index({ userId: 1, testId: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("Progress", progressSchema);
