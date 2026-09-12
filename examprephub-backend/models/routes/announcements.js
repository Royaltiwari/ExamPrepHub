const express = require("express");
const router = express.Router();
const Announcement = require("../models/Announcement");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// GET ALL ANNOUNCEMENTS
// Query: ?class=10
// =====================================================
router.get("/", requireLogin, async (req, res) => {
  try {
    const { class: cls } = req.query;

    const filter = { visible: true };

    if (cls) {
      filter.$or = [{ class: cls }, { class: "all" }];
    }

    const announcements = await Announcement.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .populate("createdBy", "name");

    res.json({
      success: true,
      count: announcements.length,
      data: announcements
    });
  } catch (error) {
    console.error("Get announcements error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements"
    });
  }
});

// =====================================================
// CREATE ANNOUNCEMENT (Admin only)
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { title, message, priority, class: cls } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }

    const announcement = await Announcement.create({
      title,
      message,
      priority: priority || "normal",
      class: cls || "all",
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Announcement posted successfully",
      data: announcement
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create announcement"
    });
  }
});

// =====================================================
// UPDATE ANNOUNCEMENT (Admin only)
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    res.json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement
    });
  } catch (error) {
    console.error("Update announcement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update announcement"
    });
  }
});

// =====================================================
// DELETE ANNOUNCEMENT (Admin only)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    res.json({
      success: true,
      message: "Announcement deleted successfully"
    });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete announcement"
    });
  }
});

module.exports = router;