const express = require("express");
const router = express.Router();
const Note = require("../models/Note");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// GET ALL NOTES
// Access: Logged-in students
// Query: ?class=10&subject=Physics
// =====================================================
router.get("/", requireLogin, async (req, res) => {
  try {
    const { class: cls, subject } = req.query;

    const filter = { visible: true };
    if (cls) filter.class = cls;
    if (subject) filter.subject = subject;

    const notes = await Note.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email");

    res.json({
      success: true,
      count: notes.length,
      data: notes
    });
  } catch (error) {
    console.error("Get notes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notes"
    });
  }
});

// =====================================================
// GET SINGLE NOTE
// =====================================================
router.get("/:id", requireLogin, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error("Get note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch note"
    });
  }
});

// =====================================================
// CREATE NOTE (Admin only)
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      class: cls,
      subject,
      chapter,
      pdfUrl,
      description
    } = req.body;

    if (!title || !cls || !subject || !pdfUrl) {
      return res.status(400).json({
        success: false,
        message: "Title, class, subject, and pdfUrl are required"
      });
    }

    const note = await Note.create({
      title,
      class: cls,
      subject,
      chapter: chapter || "",
      pdfUrl,
      description: description || "",
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Note created successfully",
      data: note
    });
  } catch (error) {
    console.error("Create note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create note"
    });
  }
});

// =====================================================
// UPDATE NOTE (Admin only)
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    res.json({
      success: true,
      message: "Note updated successfully",
      data: note
    });
  } catch (error) {
    console.error("Update note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update note"
    });
  }
});

// =====================================================
// DELETE NOTE (Admin only)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    res.json({
      success: true,
      message: "Note deleted successfully"
    });
  } catch (error) {
    console.error("Delete note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete note"
    });
  }
});

module.exports = router;