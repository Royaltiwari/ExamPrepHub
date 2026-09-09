const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.post('/generate', testController.generateTest);
router.get('/', testController.getTests);
router.get('/:id', testController.getTestById);

module.exports = router;