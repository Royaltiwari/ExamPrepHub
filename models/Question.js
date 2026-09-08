const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  // PDF से Extract किया गया
  questionText: { type: String, required: true },
  options: {
    A: String,
    B: String,
    C: String,
    D: String
  },
  correctAnswer: { type: String, required: true },
  explanation: String,
  
  // Meta Data
  subject: String,
  topic: String,
  examType: String, // SSC, Railway, etc.
  difficulty: String, // Easy, Medium, Hard
  
  // Admin द्वारा Select किया गया
  isSelected: { type: Boolean, default: false },
  selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  selectedDate: Date,
  
  // Batch/Test से Linked
  batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  
  // PDF Source
  sourcePDF: String,
  pageNumber: Number,
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', QuestionSchema);