const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const StudyMaterial = require("../models/StudyMaterial");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// Storage setup
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF allowed"));
  }
});

// =====================================================
// GET ALL (with filters)
// =====================================================
router.get("/", async (req, res) => {
  try {
    const filter = { visible: true, status: "Active" };
    
    if (req.query.exam) filter.exam = req.query.exam;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.chapter) filter.chapter = req.query.chapter;
    if (req.query.examCategory) filter.examCategory = req.query.examCategory;
    
    if (req.query.search) {
      const search = req.query.search;
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { title_hi: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } }
      ];
    }
    
    const list = await StudyMaterial.find(filter)
      .sort({ publishDate: -1, createdAt: -1 });
    
    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET single material (also increment views)
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const material = await StudyMaterial.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!material) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, data: material });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// UPLOAD PDF (Admin)
// =====================================================
router.post(
  "/upload",
  requireLogin,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const {
        title, title_hi, description,
        exam, examCategory, subject, chapter,
        tags, language, pages, thumbnail, publishDate, status
      } = req.body;

      if (!title) {
        // Delete file if no title
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: "Title required" });
      }

      // Parse tags (comma-separated string)
      let parsedTags = [];
      if (tags) {
        parsedTags = typeof tags === "string" 
          ? tags.split(",").map(t => t.trim()).filter(Boolean)
          : tags;
      }

      const material = await StudyMaterial.create({
        title: title.trim(),
        title_hi: title_hi || "",
        description: description || "",
        exam: exam || "",
        examCategory: examCategory || "",
        subject: subject || "",
        chapter: chapter || "",
        file_url: "/uploads/" + req.file.filename,
        file_name: req.file.originalname,
        file_size: req.file.size,
        thumbnail: thumbnail || "",
        pages: parseInt(pages) || 0,
        tags: parsedTags,
        language: language || "Hindi",
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        status: status || "Active"
      });

      res.json({
        success: true,
        message: "PDF uploaded successfully",
        data: material
      });
    } catch (e) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (err) {}
      }
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

// =====================================================
// UPDATE (Admin)
// =====================================================
router.put("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const material = await StudyMaterial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!material) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, message: "Updated", data: material });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// DELETE (Admin)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const material = await StudyMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Delete physical file
    const filePath = path.join(__dirname, "..", "public", material.file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await StudyMaterial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// INCREMENT DOWNLOAD COUNT
// =====================================================
router.post("/:id/download", async (req, res) => {
  try {
    await StudyMaterial.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET FILTER OPTIONS (for dropdowns)
// =====================================================
router.get("/filters/options", async (req, res) => {
  try {
    const materials = await StudyMaterial.find({ visible: true, status: "Active" });

    const exams = [...new Set(materials.map(m => m.exam).filter(Boolean))].sort();
    const subjects = [...new Set(materials.map(m => m.subject).filter(Boolean))].sort();
    const chapters = [...new Set(materials.map(m => m.chapter).filter(Boolean))].sort();
    const examCategories = [...new Set(materials.map(m => m.examCategory).filter(Boolean))].sort();
    const tags = [...new Set(materials.flatMap(m => m.tags || []))].sort();

    res.json({
      success: true,
      data: { exams, subjects, chapters, examCategories, tags }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;