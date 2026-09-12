const express = require("express");
const router = express.Router();
const Note = require("../models/Note");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

router.get("/", requireLogin, async (req, res) => {
  try {
    const { class: cls, subject } = req.query;
    const filter = { visible: true };
    if (cls) filter.class = cls;
    if (subject) filter.subject = subject;

    const notes = await Note.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, count: notes.length, data: notes });
  } catch (error) {
    console.error("Get notes error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notes" });
  }
});

router.get("/:id", requireLogin, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch note" });
  }
});

router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { title, class: cls, subject, chapter, pdfUrl, description } = req.body;
    if (!title || !cls || !subject || !pdfUrl) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }
    const note = await Note.create({
      title, class: cls, subject,
      chapter: chapter || "",
      pdfUrl,
      description: description || "",
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Note created", data: note });
  } catch (error) {
    console.error("Create note error:", error);
    res.status(500).json({ success: false, message: "Failed to create note" });
  }
});

router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true, message: "Note updated", data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update note" });
  }
});

router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true, message: "Note deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete note" });
  }
});

module.exports = router;
