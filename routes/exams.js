const express = require("express");
const router = express.Router();

// Temporary in-memory storage
let exams = [];

// =====================================================
// GET ALL EXAMS
// =====================================================
router.get("/", (req, res) => {
  res.json({
    success: true,
    count: exams.length,
    data: exams
  });
});

// =====================================================
// GET SINGLE EXAM BY ID
// =====================================================
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const exam = exams.find((e) => e._id === id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: "Exam not found"
    });
  }

  res.json({
    success: true,
    data: exam
  });
});

// =====================================================
// POST CREATE EXAM
// =====================================================
router.post("/", (req, res) => {
  try {
    const { name, category, order } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Exam name is required"
      });
    }

    // Check duplicate
    const exists = exams.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Exam already exists"
      });
    }

    const newExam = {
      _id: Date.now().toString(),
      name: name.trim(),
      category: category || "General",
      order: order || exams.length + 1,
      createdAt: new Date()
    };

    exams.push(newExam);

    res.status(201).json({
      success: true,
      message: "Exam added successfully",
      data: newExam
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// =====================================================
// PUT UPDATE EXAM
// =====================================================
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, order } = req.body;

    const exam = exams.find((e) => e._id === id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    if (name) exam.name = name.trim();
    if (category) exam.category = category;
    if (order !== undefined) exam.order = order;
    exam.updatedAt = new Date();

    res.json({
      success: true,
      message: "Exam updated successfully",
      data: exam
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// =====================================================
// DELETE EXAM
// =====================================================
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = exams.length;

  exams = exams.filter((e) => e._id !== id);

  if (exams.length === initialLength) {
    return res.status(404).json({
      success: false,
      message: "Exam not found"
    });
  }

  res.json({
    success: true,
    message: "Exam deleted successfully"
  });
});

// =====================================================
// DELETE ALL EXAMS (DEV ONLY)
// =====================================================
router.delete("/", (req, res) => {
  exams = [];
  res.json({
    success: true,
    message: "All exams cleared"
  });
});

module.exports = router;