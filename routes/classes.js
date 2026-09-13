const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Class = require("../models/Class");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// MULTER - Thumbnail Upload Setup
// =====================================================
const thumbDir = path.join(__dirname, "..", "public", "uploads", "thumbnails");
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, thumbDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Sirf image files allowed (jpg, png, webp, gif)"));
  }
});

// =====================================================
// PUBLIC: GET CATEGORIES
// =====================================================
router.get("/categories", async (req, res) => {
  const categories = [
    "Class 6", "Class 7", "Class 8", "Class 9",
    "Class 10", "Class 11", "Class 12", "Competitive"
  ];
  res.json({ success: true, data: categories });
});

// =====================================================
// PUBLIC: GET EXAMS BY CATEGORY
// =====================================================
router.get("/exams/:category", async (req, res) => {
  try {
    const exams = await Class.distinct("examName", {
      category: req.params.category,
      visible: true
    });
    res.json({ success: true, data: exams });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

// =====================================================
// PUBLIC: GET SUBJECTS (for filter)
// =====================================================
router.get("/subjects/:category/:examName", async (req, res) => {
  try {
    const subjects = await Class.distinct("subject", {
      category: req.params.category,
      examName: decodeURIComponent(req.params.examName),
      visible: true
    });
    res.json({ success: true, data: subjects });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

// =====================================================
// PUBLIC: GET CLASSES
// Query: ?category=&examName=&subject=&status=
// =====================================================
router.get("/", async (req, res) => {
  try {
    const { category, examName, subject, status } = req.query;
    const filter = { visible: true };

    if (category) filter.category = category;
    if (examName) filter.examName = decodeURIComponent(examName);
    if (subject) filter.subject = decodeURIComponent(subject);
    if (status) filter.status = status;

    const list = await Class.find(filter).sort({ scheduledDate: -1, createdAt: -1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    console.error("Get classes error:", e);
    res.status(500).json({ success: false, message: "Failed to fetch" });
  }
});

// =====================================================
// PUBLIC: GET CLASSES GROUPED BY SUBJECT → CHAPTER
// GET /api/classes/grouped/:examName
// =====================================================
router.get("/grouped/:examName", requireLogin, async (req, res) => {
  try {
    const examName = decodeURIComponent(req.params.examName);

    const classes = await Class.find({ examName, visible: true })
      .sort({ scheduledDate: -1, createdAt: -1 });

    const subjects = {};

    classes.forEach(c => {
      const subj = c.subject || "General";
      const chap = c.topic || "General";

      if (!subjects[subj]) subjects[subj] = {};
      if (!subjects[subj][chap]) subjects[subj][chap] = [];

      subjects[subj][chap].push({
        _id: c._id,
        title: c.title,
        status: c.status,
        thumbnail: c.thumbnail,
        duration: c.duration,
        scheduledDate: c.scheduledDate,
        scheduledTime: c.scheduledTime,
        isPaid: c.isPaid,
        price: c.price,
        teacher: c.teacher,
        views: c.views
      });
    });

    res.json({
      success: true,
      examName,
      count: classes.length,
      data: subjects
    });
  } catch (e) {
    console.error("Grouped classes error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to fetch grouped classes"
    });
  }
});

// =====================================================
// PUBLIC: GET ALL SUBJECTS FOR AN EXAM
// GET /api/classes/subjects-list/:examName
// =====================================================
router.get("/subjects-list/:examName", requireLogin, async (req, res) => {
  try {
    const examName = decodeURIComponent(req.params.examName);

    const subjects = await Class.distinct("subject", {
      examName,
      visible: true
    });

    res.json({
      success: true,
      examName,
      subjects
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch subjects"
    });
  }
});

// =====================================================
// PUBLIC: GET SINGLE CLASS
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const c = await Class.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!c) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: c });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

// =====================================================
// ADMIN: UPLOAD THUMBNAIL
// =====================================================
router.post(
  "/upload-thumbnail",
  requireLogin,
  requireAdmin,
  upload.single("thumbnail"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Koi file nahi mili"
        });
      }

      const url = `/uploads/thumbnails/${req.file.filename}`;

      res.json({
        success: true,
        message: "Uploaded",
        url,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (e) {
      console.error("Upload error:", e);
      res.status(500).json({
        success: false,
        message: e.message || "Upload failed"
      });
    }
  }
);

// =====================================================
// ADMIN: GET ALL (including hidden)
// =====================================================
router.get("/admin/all", requireLogin, requireAdmin, async (req, res) => {
  try {
    const list = await Class.find().sort({ createdAt: -1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

// =====================================================
// ADMIN: CREATE
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const c = await Class.create({
      ...req.body,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Class created", data: c });
  } catch (e) {
    console.error("Create class error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// ADMIN: UPDATE
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const c = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!c) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Updated", data: c });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update" });
  }
});

// =====================================================
// ADMIN: DELETE
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

module.exports = router;