const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

router.get("/", async (req, res) => {
  try {
    const list = await Subject.find({ visible: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { name, icon, order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name required" });
    const existing = await Subject.findOne({ name });
    if (existing) return res.status(400).json({ success: false, message: "Already exists" });
    const subject = await Subject.create({ name, icon: icon || "📚", order: order || 0 });
    res.json({ success: true, data: subject });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

module.exports = router;
