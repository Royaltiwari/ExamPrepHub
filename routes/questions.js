const express = require("express");
const mongoose = require("mongoose");

const Question = require("../models/Question");
const Test = require("../models/Test");
const requireAdmin = require("../middleware/admin");

const router = express.Router();


// =====================================================
// PUBLIC: Visible Test Questions
// =====================================================

router.get("/test/:testId", async (req, res) => {
  try {
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid test ID"
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


// =====================================================
// ADMIN: Test Questions
// =====================================================

router.get("/admin/test/:testId", requireAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid test ID"
      });
    }

    const questions = await Question.find({
      testId
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


// =====================================================
// ADMIN: ADD NEW QUESTION
// =====================================================

router.post("/", requireAdmin, async (req, res) => {
  try {

    const {
      testId,
      subject,
      chapter,

      questionHindi,
      questionEnglish,

      optionsHindi,
      optionsEnglish,

      explanationHindi,
      explanationEnglish,

      correctAnswer
    } = req.body;


    // -----------------------------
    // TEST ID
    // -----------------------------

    if (!testId) {
      return res.status(400).json({
        success: false,
        message: "Test is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid test ID"
      });
    }


    // -----------------------------
    // SUBJECT
    // -----------------------------

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required"
      });
    }


    // -----------------------------
    // CHAPTER
    // -----------------------------

    if (!chapter || !String(chapter).trim()) {
      return res.status(400).json({
        success: false,
        message: "Chapter is required"
      });
    }


    // -----------------------------
    // HINDI QUESTION
    // -----------------------------

    if (!questionHindi || !String(questionHindi).trim()) {
      return res.status(400).json({
        success: false,
        message: "Hindi question is required"
      });
    }


    // -----------------------------
    // HINDI OPTIONS
    // -----------------------------

    if (
      !Array.isArray(optionsHindi) ||
      optionsHindi.length !== 4
    ) {
      return res.status(400).json({
        success: false,
        message: "Exactly 4 Hindi options are required"
      });
    }

    const cleanHindiOptions = optionsHindi.map(
      option => String(option || "").trim()
    );

    if (
      cleanHindiOptions.some(option => !option)
    ) {
      return res.status(400).json({
        success: false,
        message: "All 4 Hindi options are required"
      });
    }


    // -----------------------------
    // ENGLISH OPTIONS
    // -----------------------------

    let cleanEnglishOptions = [];

    if (Array.isArray(optionsEnglish)) {

      cleanEnglishOptions = optionsEnglish.map(
        option => String(option || "").trim()
      );

      if (
        cleanEnglishOptions.length !== 0 &&
        cleanEnglishOptions.length !== 4
      ) {
        return res.status(400).json({
          success: false,
          message: "English options must contain 4 options"
        });
      }
    }


    // -----------------------------
    // ENGLISH QUESTION
    // -----------------------------

    const cleanHindiQuestion =
      String(questionHindi).trim();

    const cleanEnglishQuestion =
      questionEnglish
        ? String(questionEnglish).trim()
        : "";


    // -----------------------------
    // COMBINED QUESTION
    // -----------------------------

    let combinedQuestion = cleanHindiQuestion;

    if (cleanEnglishQuestion) {
      combinedQuestion =
        cleanHindiQuestion +
        "\n\n" +
        cleanEnglishQuestion;
    }


    // -----------------------------
    // COMBINED OPTIONS
    // -----------------------------

    const combinedOptions = [];

    for (let i = 0; i < 4; i++) {

      const hindi =
        cleanHindiOptions[i];

      const english =
        cleanEnglishOptions[i] || "";

      if (english) {
        combinedOptions.push(
          `${hindi} / ${english}`
        );
      } else {
        combinedOptions.push(hindi);
      }
    }


    // -----------------------------
    // EXPLANATION
    // -----------------------------

    const cleanExplanationHindi =
      explanationHindi
        ? String(explanationHindi).trim()
        : "";

    const cleanExplanationEnglish =
      explanationEnglish
        ? String(explanationEnglish).trim()
        : "";

    let combinedExplanation =
      cleanExplanationHindi;

    if (cleanExplanationEnglish) {
      combinedExplanation =
        cleanExplanationHindi
          ? cleanExplanationHindi +
            "\n\n" +
            cleanExplanationEnglish
          : cleanExplanationEnglish;
    }


    // -----------------------------
    // CORRECT ANSWER
    // -----------------------------

    const correct = Number(correctAnswer);

    if (
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct > 3
    ) {
      return res.status(400).json({
        success: false,
        message: "Correct answer must be between 0 and 3"
      });
    }


    // -----------------------------
    // TEST CHECK
    // -----------------------------

    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }


    // =================================================
    // CREATE NEW QUESTION
    // IMPORTANT:
    // Every Save creates a NEW MongoDB document.
    // =================================================

    const newQuestion = new Question({

      testId: testId,

      subject: String(subject).trim(),

      chapter: String(chapter).trim(),

      questionHindi: cleanHindiQuestion,

      questionEnglish: cleanEnglishQuestion,

      question: combinedQuestion,

      optionsHindi: cleanHindiOptions,

      optionsEnglish: cleanEnglishOptions,

      options: combinedOptions,

      correctAnswer: correct,

      explanationHindi: cleanExplanationHindi,

      explanationEnglish: cleanExplanationEnglish,

      explanation: combinedExplanation,

      type: "single"
    });


    // Save NEW document
    await newQuestion.save();


    // -----------------------------
    // UPDATE TOTAL QUESTIONS
    // -----------------------------

    const totalQuestions =
      await Question.countDocuments({
        testId: testId
      });

    test.totalQuestions = totalQuestions;

    await test.save();


    // -----------------------------
    // SERVER LOG
    // -----------------------------

    console.log("=================================");
    console.log("✅ NEW QUESTION SAVED");
    console.log("Question ID:", newQuestion._id);
    console.log("Test ID:", testId);
    console.log("Subject:", subject);
    console.log("Chapter:", chapter);
    console.log("Total Questions:", totalQuestions);
    console.log("=================================");


    // -----------------------------
    // RESPONSE
    // -----------------------------

    return res.status(201).json({
      success: true,
      message: "Question added successfully",
      question: newQuestion,
      totalQuestions: totalQuestions
    });


  } catch (error) {

    console.error("=================================");
    console.error("❌ ADD QUESTION ERROR");
    console.error(error);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message: "Unable to add question",
      error: error.message
    });
  }
});


// =====================================================
// ADMIN: EDIT QUESTION
// =====================================================

router.put("/:id", requireAdmin, async (req, res) => {
  try {

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID"
      });
    }


    const {
      subject,
      chapter,

      questionHindi,
      questionEnglish,

      optionsHindi,
      optionsEnglish,

      explanationHindi,
      explanationEnglish,

      correctAnswer
    } = req.body;


    if (!subject || !String(subject).trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required"
      });
    }


    if (!chapter || !String(chapter).trim()) {
      return res.status(400).json({
        success: false,
        message: "Chapter is required"
      });
    }


    if (!questionHindi || !String(questionHindi).trim()) {
      return res.status(400).json({
        success: false,
        message: "Hindi question is required"
      });
    }


    if (
      !Array.isArray(optionsHindi) ||
      optionsHindi.length !== 4
    ) {
      return res.status(400).json({
        success: false,
        message: "Exactly 4 Hindi options are required"
      });
    }


    const cleanHindiOptions = optionsHindi.map(
      option => String(option || "").trim()
    );


    if (
      cleanHindiOptions.some(option => !option)
    ) {
      return res.status(400).json({
        success: false,
        message: "All 4 Hindi options are required"
      });
    }


    let cleanEnglishOptions = [];

    if (Array.isArray(optionsEnglish)) {
      cleanEnglishOptions = optionsEnglish.map(
        option => String(option || "").trim()
      );
    }


    const cleanHindiQuestion =
      String(questionHindi).trim();

    const cleanEnglishQuestion =
      questionEnglish
        ? String(questionEnglish).trim()
        : "";


    let combinedQuestion =
      cleanHindiQuestion;

    if (cleanEnglishQuestion) {
      combinedQuestion =
        cleanHindiQuestion +
        "\n\n" +
        cleanEnglishQuestion;
    }


    const combinedOptions = [];

    for (let i = 0; i < 4; i++) {

      const hindi =
        cleanHindiOptions[i];

      const english =
        cleanEnglishOptions[i] || "";

      combinedOptions.push(
        english
          ? `${hindi} / ${english}`
          : hindi
      );
    }


    const cleanExplanationHindi =
      explanationHindi
        ? String(explanationHindi).trim()
        : "";

    const cleanExplanationEnglish =
      explanationEnglish
        ? String(explanationEnglish).trim()
        : "";


    let combinedExplanation =
      cleanExplanationHindi;

    if (cleanExplanationEnglish) {
      combinedExplanation =
        cleanExplanationHindi
          ? cleanExplanationHindi +
            "\n\n" +
            cleanExplanationEnglish
          : cleanExplanationEnglish;
    }


    const correct = Number(correctAnswer);

    if (
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct > 3
    ) {
      return res.status(400).json({
        success: false,
        message: "Correct answer must be between 0 and 3"
      });
    }


    const updatedQuestion =
      await Question.findByIdAndUpdate(
        id,
        {
          subject: String(subject).trim(),

          chapter: String(chapter).trim(),

          questionHindi:
            cleanHindiQuestion,

          questionEnglish:
            cleanEnglishQuestion,

          question:
            combinedQuestion,

          optionsHindi:
            cleanHindiOptions,

          optionsEnglish:
            cleanEnglishOptions,

          options:
            combinedOptions,

          correctAnswer:
            correct,

          explanationHindi:
            cleanExplanationHindi,

          explanationEnglish:
            cleanExplanationEnglish,

          explanation:
            combinedExplanation
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


    console.log(
      "✏️ Question Updated:",
      id
    );


    res.json({
      success: true,
      message: "Question updated successfully",
      question: updatedQuestion
    });


  } catch (error) {

    console.error(
      "❌ Update Question Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to update question",
      error: error.message
    });
  }
});


// =====================================================
// ADMIN: DELETE QUESTION
// =====================================================

router.delete("/:id", requireAdmin, async (req, res) => {
  try {

    const deletedQuestion =
      await Question.findByIdAndDelete(
        req.params.id
      );


    if (!deletedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }


    const totalQuestions =
      await Question.countDocuments({
        testId: deletedQuestion.testId
      });


    await Test.findByIdAndUpdate(
      deletedQuestion.testId,
      {
        totalQuestions: totalQuestions
      }
    );


    console.log(
      "🗑️ Question Deleted:",
      req.params.id
    );


    res.json({
      success: true,
      message: "Question deleted successfully",
      totalQuestions: totalQuestions
    });


  } catch (error) {

    console.error(
      "❌ Delete Question Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to delete question"
    });
  }
});


module.exports = router;