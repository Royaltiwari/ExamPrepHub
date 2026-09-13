const express = require("express");
const router = express.Router();
const Saved = require("../models/Saved");
const requireLogin = require("../middleware/auth");

router.get("/my", requireLogin, async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { userId: req.user._id };
    if (type) filter.itemType = type;
    const list = await Saved.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.get("/check", requireLogin, async (req, res) => {
  try {
    const { itemType, itemId } = req.query;
    const saved = await Saved.findOne({ userId: req.user._id, itemType, itemId });
    res.json({ success: true, isSaved: !!saved });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/toggle", requireLogin, async (req, res) => {
  try {
    const { itemType, itemId, itemTitle, itemMeta, thumbnail } = req.body;
    if (!itemType || !itemId) return res.status(400).json({ success: false, message: "Required" });
    const existing = await Saved.findOne({ userId: req.user._id, itemType, itemId });
    if (existing) {
      await Saved.findByIdAndDelete(existing._id);
      return res.json({ success: true, saved: false, message: "Removed" });
    }
    await Saved.create({ userId: req.user._id, itemType, itemId, itemTitle: itemTitle || "", itemMeta: itemMeta || "", thumbnail: thumbnail || "" });
    res.json({ success: true, saved: true, message: "Saved!" });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

module.exports = router;
