const express = require("express");
const router = express.Router();
const LiveClass = require("../models/LiveClass");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

router.get("/", requireLogin, async (req, res) => {
  try {
    const { class: cls } = req.query;
    const filter = { visible: true };
    if (cls) filter.class = cls;

    const list = await LiveClass.find(filter).sort({ isLive: -1, scheduledAt: -1 });

    res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    console.error("Get live classes error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch live classes" });
  }
});

router.get("/current", requireLogin, async (req, res) => {
  try {
    const live = await LiveClass.findOne({ isLive: true, visible: true }).sort({ scheduledAt: -1 });
    res.json({ success: true, data: live });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch current live" });
  }
});

router.get("/:id", requireLogin, async (req, res) => {
  try {
    const l = await LiveClass.findById(req.params.id);
    if (!l) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: l });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { title, class: cls, subject, youtubeUrl, scheduledAt, isLive } = req.body;
    if (!title || !cls || !subject || !youtubeUrl) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }
    const liveClass = await LiveClass.create({
      title, class: cls, subject, youtubeUrl,
      scheduledAt: scheduledAt || Date.now(),
      isLive: isLive || false,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Live class created", data: liveClass });
  } catch (error) {
    console.error("Create live error:", error);
    res.status(500).json({ success: false, message: "Failed to create live class" });
  }
});

router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const l = await LiveClass.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!l) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Updated", data: l });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update" });
  }
});

router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const l = await LiveClass.findByIdAndDelete(req.params.id);
    if (!l) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

module.exports = router;
