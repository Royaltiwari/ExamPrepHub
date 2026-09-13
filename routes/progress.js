const express = require("express");
const router = express.Router();
const Progress = require("../models/Progress");
const requireLogin = require("../middleware/auth");

router.get("/my", requireLogin, async (req, res) => {
  try {
    const list = await Progress.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.get("/continue", requireLogin, async (req, res) => {
  try {
    const classProgress = await Progress.findOne({ userId: req.user._id, type: "class", completed: false }).sort({ updatedAt: -1 }).populate("classId");
    const testProgress = await Progress.findOne({ userId: req.user._id, type: "test", completed: false }).sort({ updatedAt: -1 }).populate("testId");
    res.json({ success: true, data: { class: classProgress || null, test: testProgress || null } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.get("/stats", requireLogin, async (req, res) => {
  try {
    const userId = req.user._id;
    const totalTests = await Progress.countDocuments({ userId, type: "test", completed: true });
    const totalClasses = await Progress.countDocuments({ userId, type: "class", completed: true });
    const totalPdfs = await Progress.countDocuments({ userId, type: "pdf", completed: true });
    const testProgress = await Progress.find({ userId, type: "test", completed: true });
    let avgScore = 0;
    if (testProgress.length > 0) {
      const totalScore = testProgress.reduce((sum, p) => sum + (p.score || 0), 0);
      avgScore = Math.round(totalScore / testProgress.length);
    }
    const totalQuestions = testProgress.reduce((sum, p) => sum + (p.questionsAttempted || 0), 0);
    const subjectStats = {};
    testProgress.forEach(p => {
      if (p.subject) {
        if (!subjectStats[p.subject]) subjectStats[p.subject] = { total: 0, sum: 0 };
        subjectStats[p.subject].total += 1;
        subjectStats[p.subject].sum += p.score || 0;
      }
    });
    const subjectWise = Object.keys(subjectStats).map(s => ({ subject: s, avgScore: Math.round(subjectStats[s].sum / subjectStats[s].total) }));
    const overallPrep = totalTests + totalClasses > 0 ? Math.min(100, Math.round(((totalTests + totalClasses) / 20) * 100)) : 0;
    res.json({ success: true, data: { testsAttempted: totalTests, classesWatched: totalClasses, materialsRead: totalPdfs, avgScore, totalQuestions, overallPrep, subjectWise } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/class", requireLogin, async (req, res) => {
  try {
    const { classId, watchedSeconds, totalSeconds, subject, examName } = req.body;
    if (!classId) return res.status(400).json({ success: false, message: "classId required" });
    const percent = totalSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / totalSeconds) * 100)) : 0;
    const completed = percent >= 90;
    const progress = await Progress.findOneAndUpdate(
      { userId: req.user._id, classId },
      { userId: req.user._id, classId, type: "class", watchedSeconds: watchedSeconds || 0, totalSeconds: totalSeconds || 0, completedPercent: percent, completed, subject: subject || "", examName: examName || "" },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: progress });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/test", requireLogin, async (req, res) => {
  try {
    const { testId, questionsAttempted, correctAnswers, score, subject, examName } = req.body;
    if (!testId) return res.status(400).json({ success: false, message: "testId required" });
    const progress = await Progress.findOneAndUpdate(
      { userId: req.user._id, testId },
      { userId: req.user._id, testId, type: "test", questionsAttempted: questionsAttempted || 0, correctAnswers: correctAnswers || 0, score: score || 0, completed: true, subject: subject || "", examName: examName || "" },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: progress });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

module.exports = router;
