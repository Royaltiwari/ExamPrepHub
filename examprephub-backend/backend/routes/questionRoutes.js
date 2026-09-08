const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.post('/save-selected', questionController.saveSelectedQuestions);
router.get('/', questionController.getQuestions);
router.get('/:id', questionController.getQuestionById);
router.put('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);

module.exports = router;