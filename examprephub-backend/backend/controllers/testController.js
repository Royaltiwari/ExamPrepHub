const Test = require('../models/Test');
const Question = require('../models/Question');

exports.generateTest = async (req, res) => {
  try {
    const { batchId, examType, subject, numberOfQuestions = 25, testName } = req.body;
    
    let query = { isSelected: true };
    if (batchId) query.batches = batchId;
    if (examType) query.examType = examType;
    if (subject) query.subject = subject;
    
    const allQuestions = await Question.find(query);
    
    if (allQuestions.length === 0) {
      return res.status(404).json({ error: 'No questions found for the given criteria' });
    }
    
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(numberOfQuestions, allQuestions.length));
    
    const test = new Test({
      name: testName || `Test ${new Date().toLocaleDateString()}`,
      questions: selected.map(q => q._id),
      batch: batchId || null,
      examType: examType || 'SSC',
      subject: subject || 'General',
      totalQuestions: selected.length,
      createdBy: req.user?._id || null
    });
    
    await test.save();
    
    await Question.updateMany(
      { _id: { $in: selected.map(q => q._id) } },
      { $addToSet: { tests: test._id } }
    );
    
    res.status(201).json({
      success: true,
      message: 'Test generated successfully',
      test: {
        id: test._id,
        name: test.name,
        totalQuestions: test.totalQuestions,
        questions: selected
      }
    });
    
  } catch (error) {
    console.error('Test Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTests = async (req, res) => {
  try {
    const { batchId, examType } = req.query;
    let query = {};
    if (batchId) query.batch = batchId;
    if (examType) query.examType = examType;
    
    const tests = await Test.find(query)
      .populate('questions', 'questionText options correctAnswer')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: tests.length,
      tests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('questions', 'questionText options correctAnswer explanation subject');
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    res.status(200).json({ success: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};