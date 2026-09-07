const express = require("express");
const Question = require("../models/Question");
const Test = require("../models/Test");
const requireAdmin = require("../middleware/admin");

const router = express.Router();

// =====================================
// PUBLIC: Visible Test के Questions
// =====================================

router.get("/test/:testId", async (req, res) => {
  try {
    const test = await Test.findOne({
      _id: req.params.testId,
      visible: true
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    // Correct answer public को नहीं भेजना
    const questions = await Question.find({
      testId: req.params.testId
    })
      .select("-correctAnswer -__v")
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error("Get Questions Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load questions"
    });
  }
});

// =====================================
// ADMIN: Test के Questions देखना
// =====================================

router.get("/admin/test/:testId", requireAdmin, async (req, res) => {
  try {
    const questions = await Question.find({
      testId: req.params.testId
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error("Admin Questions Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load questions"
    });
  }
});

// =====================================
// ADMIN: नया Question जोड़ना
// =====================================

router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      testId,
      question,
      options,
      correctAnswer,
      explanation
    } = req.body;

    if (
      !testId ||
      !question ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      correctAnswer === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Test, question, 4 options and correct answer are required"
      });
    }

    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    if (Number(correctAnswer) < 0 || Number(correctAnswer) > 3) {
      return res.status(400).json({
        success: false,
        message: "Correct answer must be between 0 and 3"
      });
    }

    const newQuestion = await Question.create({
      testId,
      question: question.trim(),
      options,
      correctAnswer: Number(correctAnswer),
      explanation: explanation || ""
    });

    // Total questions update
    test.totalQuestions = await Question.countDocuments({
      testId
    });

    await test.save();

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      question: newQuestion
    });

  } catch (error) {
    console.error("Add Question Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to add question"
    });
  }
});

// =====================================
// ADMIN: Question Edit
// =====================================

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const {
      question,
      options,
      correctAnswer,
      explanation
    } = req.body;

    if (
      !question ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      correctAnswer === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Question, 4 options and correct answer are required"
      });
    }

    if (Number(correctAnswer) < 0 || Number(correctAnswer) > 3) {
      return res.status(400).json({
        success: false,
        message: "Correct answer must be between 0 and 3"
      });
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      {
        question: question.trim(),
        options,
        correctAnswer: Number(correctAnswer),
        explanation: explanation || ""
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }

    res.json({
      success: true,
      message: "Question updated successfully",
      question: updatedQuestion
    });

  } catch (error) {
    console.error("Update Question Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update question"
    });
  }
});

// =====================================
// ADMIN: Question Delete
// =====================================

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deletedQuestion = await Question.findByIdAndDelete(
      req.params.id
    );

    if (!deletedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }

    // Total questions update
    await Question.countDocuments({
      testId: deletedQuestion.testId
    }).then(async (count) => {
      await Test.findByIdAndUpdate(
        deletedQuestion.testId,
        {
          totalQuestions: count
        }
      );
    });

    res.json({
      success: true,
      message: "Question deleted successfully"
    });

  } catch (error) {
    console.error("Delete Question Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete question"
    });
  }
});

module.exports = router;