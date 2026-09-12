const express = require("express");
const Test = require("../models/Test");
const requireAdmin = require("../middleware/admin");

const router = express.Router();

// =====================================
// ADMIN: सभी Tests देखना
// =====================================

router.get("/tests", requireAdmin, async (req, res) => {
  try {
    const tests = await Test.find()
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      success: true,
      tests
    });

  } catch (error) {
    console.error("Admin Get Tests Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load tests"
    });
  }
});

// =====================================
// ADMIN: नया Test बनाना
// =====================================

router.post("/tests", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      exam,
      subject,
      chapter,
      language,
      duration,
      description,
      visible,
      isPaid,
      price
    } = req.body;

    if (!name || !exam || !duration) {
      return res.status(400).json({
        success: false,
        message: "Name, exam and duration are required"
      });
    }

    const test = await Test.create({
      name: name.trim(),
      exam: exam.trim(),
      subject: subject ? subject.trim() : "",
      chapter: chapter ? chapter.trim() : "",
      language: language || "Bilingual",
      duration: Number(duration),
      description: description || "",
      visible: Boolean(visible),
      isPaid: Boolean(isPaid),
      price: isPaid ? (Number(price) || 0) : 0,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Test created successfully",
      test
    });

  } catch (error) {
    console.error("Create Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create test"
    });
  }
});

// =====================================
// ADMIN: Test Edit करना
// =====================================

router.put("/tests/:id", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      exam,
      subject,
      chapter,
      language,
      duration,
      description,
      visible,
      isPaid,
      price
    } = req.body;

    const test = await Test.findByIdAndUpdate(
      req.params.id,
      {
        name,
        exam,
        subject,
        chapter,
        language,
        duration: Number(duration),
        description,
        visible: Boolean(visible),
        isPaid: Boolean(isPaid),
        price: isPaid ? (Number(price) || 0) : 0
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    res.json({
      success: true,
      message: "Test updated successfully",
      test
    });

  } catch (error) {
    console.error("Update Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update test"
    });
  }
});

// =====================================
// ADMIN: Test Delete करना
// =====================================

router.delete("/tests/:id", requireAdmin, async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    res.json({
      success: true,
      message: "Test deleted successfully"
    });

  } catch (error) {
    console.error("Delete Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete test"
    });
  }
});

module.exports = router;
