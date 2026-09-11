const express = require("express");
const mongoose = require("mongoose");
const Test = require("../models/Test");

const router = express.Router();

// =====================================================
// CREATE TEST
// POST /api/tests
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      name,
      description = "",
      batch,
      examType,
      subject,
      totalQuestions,
      timeLimit = 30,
      isActive = true,
      createdBy
    } = req.body;

    if (!name || !examType || !subject || totalQuestions === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "name, examType, subject and totalQuestions are required"
      });
    }

    const test = new Test({
      name: String(name).trim(),
      description: String(description || "").trim(),
      batch: batch || undefined,
      examType: String(examType).trim(),
      subject: String(subject).trim(),
      totalQuestions: Number(totalQuestions),
      timeLimit: Number(timeLimit),
      isActive: Boolean(isActive),
      createdBy: createdBy || undefined,
      questions: []
    });

    await test.save();

    res.status(201).json({
      success: true,
      message: "Test created successfully",
      test
    });
  } catch (error) {
    console.error("Create Test Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create test",
      error: error.message
    });
  }
});

// =====================================================
// GET ALL ACTIVE TESTS
// GET /api/tests
// =====================================================

router.get("/", async (req, res) => {
  try {
    const tests = await Test.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      success: true,
      tests
    });
  } catch (error) {
    console.error("Get Tests Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load tests",
      error: error.message
    });
  }
});

// =====================================================
// GET EXAM-WISE ACTIVE TESTS
// GET /api/tests/exam/:examName
// =====================================================

router.get("/exam/:examName", async (req, res) => {
  try {
    const examName = decodeURIComponent(req.params.examName).trim();

    const tests = await Test.find({
      isActive: true,
      examType: {
        $regex: new RegExp(`^${escapeRegex(examName)}$`, "i")
      }
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      success: true,
      exam: examName,
      tests
    });
  } catch (error) {
    console.error("Get Exam Tests Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load exam tests",
      error: error.message
    });
  }
});

// =====================================================
// GET SINGLE ACTIVE TEST
// GET /api/tests/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid test ID"
      });
    }

    const test = await Test.findOne({
      _id: req.params.id,
      isActive: true
    }).select("-__v");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    res.json({
      success: true,
      test
    });
  } catch (error) {
    console.error("Get Test Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load test",
      error: error.message
    });
  }
});

// =====================================================
// HELPER
// =====================================================

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;