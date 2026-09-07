const express = require("express");
const Result = require("../models/Result");
const Question = require("../models/Question");
const Test = require("../models/Test");
const requireLogin = require("../middleware/auth");

const router = express.Router();

// =====================================
// SUBMIT TEST
// =====================================

router.post("/submit", requireLogin, async (req, res) => {
  try {
    const { testId, answers, timeTaken } = req.body;

    if (!testId || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Test ID and answers are required"
      });
    }

    const test = await Test.findOne({
      _id: testId,
      visible: true
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    const questions = await Question.find({
      testId
    }).sort({ createdAt: 1 });

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This test has no questions"
      });
    }

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let skippedQuestions = 0;

    const resultAnswers = [];

    questions.forEach((question) => {
      const submitted = answers.find(
        (answer) =>
          String(answer.questionId) === String(question._id)
      );

      const selectedAnswer =
        submitted &&
        submitted.selectedAnswer !== null &&
        submitted.selectedAnswer !== undefined
          ? Number(submitted.selectedAnswer)
          : null;

      if (selectedAnswer === null) {
        skippedQuestions++;
      } else if (selectedAnswer === question.correctAnswer) {
        correctAnswers++;
      } else {
        wrongAnswers++;
      }

      resultAnswers.push({
        questionId: question._id,
        selectedAnswer,
        isCorrect:
          selectedAnswer !== null &&
          selectedAnswer === question.correctAnswer
      });
    });

    const totalQuestions = questions.length;

    const score = correctAnswers;

    const percentage = Number(
      ((correctAnswers / totalQuestions) * 100).toFixed(2)
    );

    const result = await Result.create({
      userId: req.user._id,
      testId: test._id,
      score,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      skippedQuestions,
      percentage,
      timeTaken: Number(timeTaken) || 0,
      answers: resultAnswers
    });

    res.status(201).json({
      success: true,
      message: "Test submitted successfully",
      result
    });

  } catch (error) {
    console.error("Submit Result Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to submit test"
    });
  }
});

// =====================================
// CURRENT USER: RESULT BY ID
// =====================================

router.get("/:id", requireLogin, async (req, res) => {
  try {
    const result = await Result.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate("testId", "name exam subject chapter duration")
      .populate("answers.questionId", "question options explanation");

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Result not found"
      });
    }

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error("Get Result Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load result"
    });
  }
});

// =====================================
// CURRENT USER: ALL RESULTS
// =====================================

router.get("/", requireLogin, async (req, res) => {
  try {
    const results = await Result.find({
      userId: req.user._id
    })
      .populate("testId", "name exam subject")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error("Get Results Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load results"
    });
  }
});

module.exports = router;