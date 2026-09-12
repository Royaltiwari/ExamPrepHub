const express = require("express");
const router = express.Router();
const Announcement = require("../models/Announcement");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

router.get("/", requireLogin, async (req, res) => {
  try {
    const { class: cls } = req.query;
    const filter = { visible: true };
    if (cls) filter.$or = [{ class: cls }, { class: "all" }];

    const list = await Announcement.find(filter).sort({ priority: -1, createdAt: -1 });

    res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    console.error("Get announcements error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch announcements" });
  }
});

router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { title, message, priority, class: cls } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message required" });
    }
    const announcement = await Announcement.create({
      title, message,
      priority: priority || "normal",
      class: cls || "all",
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Announcement posted", data: announcement });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ success: false, message: "Failed to create announcement" });
  }
});

router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const a = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!a) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Updated", data: a });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update" });
  }
});

router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const a = await Announcement.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

module.exports = router;
