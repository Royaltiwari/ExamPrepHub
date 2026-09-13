const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

router.get("/my", requireLogin, async (req, res) => {
  try {
    const user = req.user;
    const filter = { $or: [{ userId: user._id }, { userId: null, forExams: { $in: ["", user.targetExam || ""] } }] };
    const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    const unreadCount = list.filter(n => !n.isRead).length;
    res.json({ success: true, count: list.length, unreadCount, data: list });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/:id/read", requireLogin, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/read-all", requireLogin, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { type, title, message, link, icon, forExams } = req.body;
    if (!title) return res.status(400).json({ success: false, message: "Title required" });
    const notif = await Notification.create({ userId: null, type: type || "announcement", title, message: message || "", link: link || "", icon: icon || "🔔", forExams: forExams || [] });
    res.json({ success: true, data: notif });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

module.exports = router;
