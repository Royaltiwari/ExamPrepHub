const mongoose = require('mongoose');

const TestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  examType: { type: String, required: true },
  subject: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  timeLimit: { type: Number, default: 30 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', TestSchema);