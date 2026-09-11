const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  // ══════════════════════════════════════════════
  // TEST LINK
  // ══════════════════════════════════════════════
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },

  questionNumber: {
    type: Number,
    default: 0
  },

  // ══════════════════════════════════════════════
  // QUESTION TEXT - हर format support
  // ══════════════════════════════════════════════
  questionText: {
    type: String,
    default: ''
  },

  questionHindi: {
    type: String,
    default: ''
  },

  questionEnglish: {
    type: String,
    default: ''
  },

  question: {
    type: String,
    default: ''
  },

  // ══════════════════════════════════════════════
  // OPTIONS - Array format (नया) + Object format (पुराना) दोनों
  // ══════════════════════════════════════════════
  options: {
    type: [String],
    default: []
  },

  optionsHindi: {
    type: [String],
    default: []
  },

  optionsEnglish: {
    type: [String],
    default: []
  },

  optionsText: {
    type: [String],
    default: []
  },

  // ══════════════════════════════════════════════
  // CORRECT ANSWER (0-3 Number, या पुराना String)
  // ══════════════════════════════════════════════
  correctAnswer: {
    type: Number,
    default: 0
  },

  // ══════════════════════════════════════════════
  // EXPLANATION
  // ══════════════════════════════════════════════
  explanation: {
    type: String,
    default: ''
  },

  explanationHindi: {
    type: String,
    default: ''
  },

  explanationEnglish: {
    type: String,
    default: ''
  },

  // ══════════════════════════════════════════════
  // META DATA
  // ══════════════════════════════════════════════
  subject: {
    type: String,
    default: 'General'
  },

  chapter: {
    type: String,
    default: 'General'
  },

  topic: String,

  examType: String,       // SSC, Railway, etc.

  difficulty: String,     // Easy, Medium, Hard

  language: {
    type: String,
    default: 'bilingual'
  },

  type: {
    type: String,
    default: 'single'
  },

  // ══════════════════════════════════════════════
  // ADMIN SELECTION
  // ══════════════════════════════════════════════
  isSelected: {
    type: Boolean,
    default: false
  },

  selectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  selectedDate: Date,

  // ══════════════════════════════════════════════
  // BATCH / TEST LINK (पुराना system)
  // ══════════════════════════════════════════════
  batches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  }],

  tests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test'
  }],

  // ══════════════════════════════════════════════
  // PDF SOURCE
  // ══════════════════════════════════════════════
  sourcePDF: String,

  pageNumber: Number

}, {
  timestamps: true
});

module.exports = mongoose.model('Question', QuestionSchema);