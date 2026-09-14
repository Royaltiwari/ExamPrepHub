const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Class = require("../models/Class");
const Comment = require("../models/Comment");
const User = require("../models/User");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// MULTER SETUP (Thumbnail + PDF upload)
// =====================================================
const uploadDir = path.join(__dirname, "..", "public", "uploads", "classes");
const thumbDir = path.join(uploadDir, "thumbnails");
const pdfDir = path.join(uploadDir, "pdfs");

[uploadDir, thumbDir, pdfDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      cb(null, thumbDir);
    } else if (file.fieldname === "supportingPdf") {
      cb(null, pdfDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files allowed for thumbnail"));
      }
    } else if (file.fieldname === "supportingPdf") {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files allowed"));
      }
    } else {
      cb(null, true);
    }
  }
});

const classUpload = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "supportingPdf", maxCount: 1 }
]);

// =====================================================
// GET ALL CLASSES (Public)
// =====================================================
router.get("/", async (req, res) => {
  try {
    const filter = { visible: true };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.examName) filter.examName = req.query.examName;

    const list = await Class.find(filter)
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET ALL CLASSES (Admin — all statuses)
// =====================================================
router.get("/admin/all", requireLogin, requireAdmin, async (req, res) => {
  try {
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const list = await Class.find(filter)
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET SINGLE CLASS (Public)
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }
    res.json({ success: true, data: cls });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// CREATE CLASS (Admin)
// =====================================================
router.post(
  "/",
  requireLogin,
  requireAdmin,
  classUpload,
  async (req, res) => {
    try {
      const {
        title, subtitle, category, examName, subject, topic,
        teacher, duration, scheduledDate, scheduledTime,
        videoType, status, liveUrl, recordedUrl, description, notes
      } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, message: "Title required" });
      }

      if (!teacher) {
        return res.status(400).json({ success: false, message: "Teacher name required" });
      }

      // Thumbnail
      let thumbnailPath = "";
      if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
        thumbnailPath = "/uploads/classes/thumbnails/" + req.files.thumbnail[0].filename;
      }

      // Supporting PDF
      let pdfPath = "";
      if (req.files && req.files.supportingPdf && req.files.supportingPdf[0]) {
        pdfPath = "/uploads/classes/pdfs/" + req.files.supportingPdf[0].filename;
      }

      const newClass = await Class.create({
        title: title.trim(),
        subtitle: subtitle || "",
        category: category || "Competitive",
        examName: examName || "",
        subject: subject || "",
        topic: topic || "",
        teacher: teacher.trim(),
        duration: parseInt(duration) || 60,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime: scheduledTime || "",
        videoType: videoType || "recorded",
        status: status || "recorded",
        liveUrl: liveUrl || "",
        recordedUrl: recordedUrl || "",
        thumbnail: thumbnailPath,
        supportingPdf: pdfPath,
        description: description || "",
        notes: notes || "",
        visible: true,
        createdBy: req.session.userId
      });

      res.json({
        success: true,
        message: "Class created successfully",
        data: newClass
      });
    } catch (e) {
      console.error("Create class error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

// =====================================================
// UPDATE CLASS (Admin)
// =====================================================
router.put(
  "/:id",
  requireLogin,
  requireAdmin,
  classUpload,
  async (req, res) => {
    try {
      const cls = await Class.findById(req.params.id);
      if (!cls) {
        return res.status(404).json({ success: false, message: "Class not found" });
      }

      const {
        title, subtitle, category, examName, subject, topic,
        teacher, duration, scheduledDate, scheduledTime,
        videoType, status, liveUrl, recordedUrl, description, notes
      } = req.body;

      if (title) cls.title = title.trim();
      if (subtitle !== undefined) cls.subtitle = subtitle;
      if (category) cls.category = category;
      if (examName) cls.examName = examName;
      if (subject) cls.subject = subject;
      if (topic) cls.topic = topic;
      if (teacher) cls.teacher = teacher.trim();
      if (duration) cls.duration = parseInt(duration);
      if (scheduledDate) cls.scheduledDate = new Date(scheduledDate);
      if (scheduledTime !== undefined) cls.scheduledTime = scheduledTime;
      if (videoType) cls.videoType = videoType;
      if (status) cls.status = status;
      if (liveUrl !== undefined) cls.liveUrl = liveUrl;
      if (recordedUrl !== undefined) cls.recordedUrl = recordedUrl;
      if (description !== undefined) cls.description = description;
      if (notes !== undefined) cls.notes = notes;

      // Update thumbnail if new uploaded
      if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
        // Delete old thumbnail
        if (cls.thumbnail) {
          const oldPath = path.join(__dirname, "..", "public", cls.thumbnail);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (err) {}
          }
        }
        cls.thumbnail = "/uploads/classes/thumbnails/" + req.files.thumbnail[0].filename;
      }

      // Update PDF if new uploaded
      if (req.files && req.files.supportingPdf && req.files.supportingPdf[0]) {
        if (cls.supportingPdf) {
          const oldPath = path.join(__dirname, "..", "public", cls.supportingPdf);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (err) {}
          }
        }
        cls.supportingPdf = "/uploads/classes/pdfs/" + req.files.supportingPdf[0].filename;
      }

      await cls.save();

      res.json({
        success: true,
        message: "Class updated successfully",
        data: cls
      });
    } catch (e) {
      console.error("Update class error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

// =====================================================
// DELETE CLASS (Admin)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    // Delete thumbnail file
    if (cls.thumbnail) {
      const thumbPath = path.join(__dirname, "..", "public", cls.thumbnail);
      if (fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch (err) {}
      }
    }

    // Delete PDF file
    if (cls.supportingPdf) {
      const pdfPath = path.join(__dirname, "..", "public", cls.supportingPdf);
      if (fs.existsSync(pdfPath)) {
        try { fs.unlinkSync(pdfPath); } catch (err) {}
      }
    }

    // Delete comments related to this class
    await Comment.deleteMany({ classId: req.params.id });

    await Class.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Class deleted successfully" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET COMMENTS (Public)
// =====================================================
router.get("/:id/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ classId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: comments.length, data: comments });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// POST COMMENT (Logged in users)
// =====================================================
router.post("/:id/comments", requireLogin, async (req, res) => {
  try {
    const { text, isQuestion } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Comment text required" });
    }

    const user = await User.findById(req.session.userId).select("name");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const comment = await Comment.create({
      classId: req.params.id,
      userId: req.session.userId,
      userName: user.name || "User",
      text: text.trim(),
      isQuestion: !!isQuestion
    });

    res.json({ success: true, data: comment });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// DELETE COMMENT (Admin or own comment)
// =====================================================
router.delete("/:classId/comments/:commentId", requireLogin, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const user = await User.findById(req.session.userId).select("role");
    const isAdmin = user && user.role === "admin";
    const isOwner = String(comment.userId) === String(req.session.userId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ success: true, message: "Comment deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;