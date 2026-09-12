const express = require("express");
const router = express.Router();
const ExamLink = require("../models/ExamLink");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// GET ALL (Public - for index page)
// Query: ?category=SSC
// =====================================================
router.get("/", requireLogin, async (req, res) => {
  try {
    const { category, all } = req.query;

    const filter = { visible: true };
    if (category) filter.category = category;

    const list = await ExamLink.find(filter).sort({ order: 1, examName: 1 });

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    console.error("Get exam links error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch exam links"
    });
  }
});

// =====================================================
// GET SINGLE by exam name
// =====================================================
router.get("/by-name/:examName", async (req, res) => {
  try {
    const examName = decodeURIComponent(req.params.examName);
    const exam = await ExamLink.findOne({
      examName,
      visible: true
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.json({ success: true, data: exam });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch exam"
    });
  }
});

// =====================================================
// ADMIN: GET ALL (including hidden)
// =====================================================
router.get("/admin/all", requireLogin, requireAdmin, async (req, res) => {
  try {
    const list = await ExamLink.find().sort({ category: 1, order: 1, examName: 1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch"
    });
  }
});

// =====================================================
// CREATE (Admin)
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const {
      examName, category, description, icon,
      pdfUrl, testUrl, demoUrl, order, visible
    } = req.body;

    if (!examName) {
      return res.status(400).json({
        success: false,
        message: "Exam name required"
      });
    }

    const exists = await ExamLink.findOne({ examName });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Exam already exists"
      });
    }

    const exam = await ExamLink.create({
      examName,
      category: category || "SSC",
      description: description || "",
      icon: icon || "🏆",
      pdfUrl: pdfUrl || "",
      testUrl: testUrl || "",
      demoUrl: demoUrl || "",
      order: order || 0,
      visible: visible !== false,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Exam created",
      data: exam
    });
  } catch (error) {
    console.error("Create exam error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create exam"
    });
  }
});

// =====================================================
// UPDATE (Admin)
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const exam = await ExamLink.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.json({
      success: true,
      message: "Exam updated",
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update"
    });
  }
});

// =====================================================
// DELETE (Admin)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const exam = await ExamLink.findByIdAndDelete(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.json({ success: true, message: "Exam deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete"
    });
  }
});

module.exports = router;
