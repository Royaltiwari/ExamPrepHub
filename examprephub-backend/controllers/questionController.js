const Question = require('../models/Question');

exports.saveSelectedQuestions = async (req, res) => {
  try {
    const { selectedIndices, subject, examType, batchId } = req.body;
    const tempQuestions = req.session.tempQuestions;
    
    if (!tempQuestions) {
      return res.status(400).json({ error: 'No questions in session' });
    }
    
    const savedQuestions = [];
    
    for (const index of selectedIndices) {
      const qData = tempQuestions[parseInt(index)];
      if (!qData) continue;
      
      const question = new Question({
        ...qData,
        subject: subject || 'General',
        examType: examType || 'SSC',
        isSelected: true,
        batches: batchId ? [batchId] : [],
        selectedDate: new Date(),
        sourcePDF: req.session.pdfMeta?.fileName || 'Unknown'
      });
      
      await question.save();
      savedQuestions.push(question);
    }
    
    delete req.session.tempQuestions;
    delete req.session.pdfMeta;
    
    res.status(201).json({
      success: true,
      message: `${savedQuestions.length} questions saved successfully`,
      savedQuestions
    });
    
  } catch (error) {
    console.error('Save Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const { examType, subject, batchId, isSelected } = req.query;
    
    let query = {};
    if (examType) query.examType = examType;
    if (subject) query.subject = subject;
    if (batchId) query.batches = batchId;
    if (isSelected !== undefined) query.isSelected = isSelected === 'true';
    
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.status(200).json({
      success: true,
      count: questions.length,
      questions
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.status(200).json({ success: true, question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.status(200).json({ success: true, question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.status(200).json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};