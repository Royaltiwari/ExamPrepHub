const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
    D: { type: String, required: true }
  },
  correctAnswer: { type: String, required: true, enum: ['A', 'B', 'C', 'D'] },
  explanation: { type: String, default: '' },
  subject: { type: String, required: true },
  topic: { type: String, default: 'General' },
  examType: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  isSelected: { type: Boolean, default: false },
  selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  selectedDate: { type: Date, default: Date.now },
  batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  sourcePDF: { type: String, default: '' },
  pageNumber: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', QuestionSchema);