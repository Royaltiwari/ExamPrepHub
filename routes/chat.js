const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const requireLogin = require("../middleware/auth");

// GET messages for a class
router.get("/:classId", requireLogin, async (req, res) => {
  try {
    const messages = await Chat.find({ classId: req.params.classId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: messages.reverse() });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to fetch chat" });
  }
});

// POST new message
router.post("/:classId", requireLogin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message required" });
    }

    const chat = await Chat.create({
      classId: req.params.classId,
      userId: req.user._id,
      userName: req.user.name,
      message: message.trim()
    });

    res.status(201).json({ success: true, data: chat });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to send" });
  }
});

// DELETE message (admin or own)
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ success: false, message: "Not found" });

    if (String(chat.userId) !== String(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    await Chat.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

module.exports = router;
