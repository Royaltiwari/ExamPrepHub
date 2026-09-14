const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// GET ALL SUBJECTS (Public)
// =====================================================
router.get("/", async (req, res) => {
  try {
    const list = await Subject.find({ visible: true }).sort({
      order: 1,
      name: 1
    });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET SINGLE SUBJECT BY ID (Public)
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    res.json({ success: true, data: subject });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// CREATE SUBJECT (Admin Only)
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { name, name_hi, icon, order } = req.body;

    if (!name || name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Subject name required" });
    }

    const existing = await Subject.findOne({
      name: name.trim()
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Subject already exists" });
    }

    const subject = await Subject.create({
      name: name.trim(),
      name_hi: name_hi || "",
      icon: icon || "📚",
      order: order || 0
    });

    res.status(201).json({
      success: true,
      message: "Subject added successfully",
      data: subject
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// UPDATE SUBJECT (Admin Only)
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { name, name_hi, icon, order, visible } = req.body;

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    if (name) subject.name = name.trim();
    if (name_hi !== undefined) subject.name_hi = name_hi;
    if (icon) subject.icon = icon;
    if (order !== undefined) subject.order = order;
    if (visible !== undefined) subject.visible = visible;

    await subject.save();

    res.json({
      success: true,
      message: "Subject updated successfully",
      data: subject
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// DELETE SUBJECT (Admin Only)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);

    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    res.json({
      success: true,
      message: "Subject deleted successfully"
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;