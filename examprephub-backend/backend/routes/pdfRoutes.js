const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

router.post('/upload', pdfController.upload, pdfController.uploadPDF);

router.get('/preview', (req, res) => {
  if (req.session.tempQuestions) {
    res.status(200).json({
      success: true,
      questions: req.session.tempQuestions,
      meta: req.session.pdfMeta
    });
  } else {
    res.status(404).json({ error: 'No questions in session' });
  }
});

module.exports = router;