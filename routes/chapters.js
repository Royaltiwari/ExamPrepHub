const express = require("express");
const router = express.Router();
const Chapter = require("../models/Chapter");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// GET ALL CHAPTERS (Public) - optionally filter by subject
// =====================================================
router.get("/", async (req, res) => {
  try {
    const filter = { visible: true };
    if (req.query.subject_id) {
      filter.subject_id = req.query.subject_id;
    }
    const list = await Chapter.find(filter)
      .populate("subject_id", "name name_hi icon")
      .sort({ order: 1, chapter_name: 1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET SINGLE CHAPTER (Public)
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id).populate(
      "subject_id",
      "name name_hi icon"
    );
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }
    res.json({ success: true, data: chapter });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// CREATE CHAPTER (Admin Only)
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { subject_id, chapter_name, chapter_name_hi, order } = req.body;

    if (!subject_id || !chapter_name) {
      return res.status(400).json({
        success: false,
        message: "subject_id and chapter_name required"
      });
    }

    const existing = await Chapter.findOne({
      subject_id,
      chapter_name: chapter_name.trim()
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Chapter already exists" });
    }

    const chapter = await Chapter.create({
      subject_id,
      chapter_name: chapter_name.trim(),
      chapter_name_hi: chapter_name_hi || "",
      order: order || 0
    });

    res.status(201).json({
      success: true,
      message: "Chapter added successfully",
      data: chapter
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// UPDATE CHAPTER (Admin Only)
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { chapter_name, chapter_name_hi, order, visible } = req.body;

    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    if (chapter_name) chapter.chapter_name = chapter_name.trim();
    if (chapter_name_hi !== undefined) chapter.chapter_name_hi = chapter_name_hi;
    if (order !== undefined) chapter.order = order;
    if (visible !== undefined) chapter.visible = visible;

    await chapter.save();

    res.json({
      success: true,
      message: "Chapter updated successfully",
      data: chapter
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// DELETE CHAPTER (Admin Only)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);

    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    res.json({
      success: true,
      message: "Chapter deleted successfully"
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;