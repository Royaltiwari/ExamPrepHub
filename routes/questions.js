const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Question = require("../models/Question");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// MULTER SETUP
// =====================================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// =====================================================
// GET ALL QUESTIONS (Public)
// =====================================================
router.get("/", async (req, res) => {
  try {
    const filter = { visible: true };
    if (req.query.subject_id) filter.subject_id = req.query.subject_id;
    if (req.query.chapter_id) filter.chapter_id = req.query.chapter_id;
    if (req.query.exam_id) filter.exam_id = req.query.exam_id;

    const list = await Question.find(filter)
      .populate("subject_id", "name icon")
      .populate("chapter_id", "chapter_name")
      .populate("exam_id", "name")
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// GET SINGLE QUESTION (Public)
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const q = await Question.findById(req.params.id)
      .populate("subject_id", "name icon")
      .populate("chapter_id", "chapter_name")
      .populate("exam_id", "name");

    if (!q) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }
    res.json({ success: true, data: q });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// CREATE SINGLE QUESTION (Admin)
// =====================================================
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const q = await Question.create(req.body);
    res.json({ success: true, data: q });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// PREVIEW PDF/WORD - Parse without saving to DB
// =====================================================
router.post(
  "/preview",
  requireLogin,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const mimetype = req.file.mimetype;
      let text = "";

      if (mimetype === "application/pdf") {
        const data = await pdfParse(req.file.buffer);
        text = data.text;
      } else if (
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimetype === "application/msword"
      ) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = result.value;
      } else if (mimetype === "text/plain") {
        text = req.file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({
          success: false,
          message: "Only PDF, DOCX, DOC or TXT allowed"
        });
      }

      const parsedQuestions = parseQuestionsFromText(text);

      res.json({
        success: true,
        count: parsedQuestions.length,
        data: parsedQuestions,
        preview: text.substring(0, 500)
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

// =====================================================
// UPLOAD PDF/WORD - Parse & Bulk Insert
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

      const { subject_id, chapter_id, exam_id } = req.body;
      const mimetype = req.file.mimetype;
      let text = "";

      if (mimetype === "application/pdf") {
        const data = await pdfParse(req.file.buffer);
        text = data.text;
      } else if (
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimetype === "application/msword"
      ) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = result.value;
      } else if (mimetype === "text/plain") {
        text = req.file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({
          success: false,
          message: "Only PDF, DOCX, DOC or TXT allowed"
        });
      }

      const parsedQuestions = parseQuestionsFromText(text);

      if (parsedQuestions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No questions found in file",
          preview: text.substring(0, 800)
        });
      }

      const questionsToInsert = parsedQuestions.map((q) => ({
        ...q,
        subject_id: subject_id || null,
        chapter_id: chapter_id || null,
        exam_id: exam_id || null
      }));

      const inserted = await Question.insertMany(questionsToInsert);

      res.json({
        success: true,
        message: inserted.length + " questions imported successfully",
        count: inserted.length,
        data: inserted
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

// =====================================================
// PARSE QUESTIONS FROM RAW TEXT
// =====================================================
function parseQuestionsFromText(text) {
  const questions = [];
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Question blocks split by Q1. / 1. etc.
  const blocks = text.split(/\n(?=(?:Q\.?\s*\d+|\d+)\.\s)/i);

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // Extract question number and question text
    const qMatch = block.match(
      /^(?:Q\.?\s*)?(\d+)\.\s*([\s\S]*?)(?=\n\s*[A-D]\.\s)/i
    );
    if (!qMatch) continue;

    const fullQuestion = qMatch[2].trim().replace(/\n/g, " ");

    let question_hi = fullQuestion;
    let question_en = "";

    if (fullQuestion.includes("/")) {
      const parts = fullQuestion.split("/");
      question_hi = parts[0].trim();
      question_en = parts.slice(1).join("/").trim();
    }

    // Extract options A, B, C, D
    const options = [];
    const options_en = [];
    const optMatches = block.matchAll(/([A-D])\.\s*([^\n]+)/g);

    for (const m of optMatches) {
      const optText = m[2].trim();
      if (optText.includes("/")) {
        const parts = optText.split("/");
        options.push(parts[0].trim());
        options_en.push(parts.slice(1).join("/").trim());
      } else {
        options.push(optText);
        options_en.push(optText);
      }
    }

    // Extract answer (A/B/C/D)
    let answer = "";
    const ansMatch = block.match(/(?:Answer|Ans|à¤‰à¤¤à¥à¤¤à¤°)\s*:?\s*([A-D])/i);
    if (ansMatch) answer = ansMatch[1].toUpperCase();

    // Extract explanation
    let explanation_hi = "";
    let explanation_en = "";
    const expMatch = block.match(
      /(?:Explanation|à¤µà¥à¤¯à¤¾à¤–à¥à¤¯à¤¾|à¤µà¤¿à¤¸à¥à¤¤à¥ƒà¤¤ à¤µà¥à¤¯à¤¾à¤–à¥à¤¯à¤¾)\s*:?\s*([\s\S]*?)(?=\n\s*(?:Key|à¤®à¥à¤–à¥à¤¯|Q\.?\s*\d|\d+\.\s|$))/i
    );
    if (expMatch) {
      const expText = expMatch[1].trim().replace(/\n/g, " ");
      if (expText.includes("/")) {
        const parts = expText.split("/");
        explanation_hi = parts[0].trim();
        explanation_en = parts.slice(1).join("/").trim();
      } else {
        explanation_hi = expText;
        explanation_en = expText;
      }
    }

    // Extract key points
    const key_points = [];
    const kpMatch = block.match(
      /(?:Key Points|à¤®à¥à¤–à¥à¤¯ à¤¬à¤¿à¤‚à¤¦à¥)\s*:?\s*([\s\S]*?)(?=\n\s*(?:Q\.?\s*\d|\d+\.\s|$))/i
    );
    if (kpMatch) {
      const kpText = kpMatch[1].trim();
      kpText.split("\n").forEach((l) => {
        const cleaned = l.replace(/^[-â€¢*]\s*/, "").trim();
        if (cleaned) key_points.push(cleaned);
      });
    }

    // Only add if valid
    if ((question_hi || question_en) && options.length >= 2 && answer) {
      questions.push({
        question_hi,
        question_en,
        options,
        options_en,
        answer,
        explanation_hi,
        explanation_en,
        key_points
      });
    }
  }

  return questions;
}

// =====================================================
// DELETE SINGLE QUESTION (Admin)
// =====================================================
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const q = await Question.findByIdAndDelete(req.params.id);
    if (!q) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }
    res.json({ success: true, message: "Question deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// DELETE ALL QUESTIONS (DEV ONLY)
// =====================================================
router.delete("/all", requireLogin, requireAdmin, async (req, res) => {
  try {
    await Question.deleteMany({});
    res.json({ success: true, message: "All questions deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =====================================================
// REMOVE DUPLICATE QUESTIONS
// =====================================================
router.delete("/duplicates/remove", requireLogin, requireAdmin, async (req, res) => {
  try {
    const allQuestions = await Question.find({}).sort({ createdAt: 1 });
    const seen = new Set();
    const toDelete = [];

    for (const q of allQuestions) {
      const key = (q.question_hi || q.question_en || q.questionText || "").trim().toLowerCase();
      if (!key) continue;

      if (seen.has(key)) {
        toDelete.push(q._id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      await Question.deleteMany({ _id: { $in: toDelete } });
    }

    res.json({
      success: true,
      message: toDelete.length + " duplicate questions removed",
      deleted: toDelete.length,
      remaining: await Question.countDocuments()
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


// ==========================================
// GET /api/questions/admin/test/:testId
// Ek specific test ke saare questions laao
// ==========================================
router.get("/admin/test/:testId", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    
    // Dono tarike se questions dhoondein:
    // 1. Question.testId field se
    // 2. Test.question_ids array se
    const Test = require("../models/Test");
    const test = await Test.findById(testId);
    
    let questions = [];
    
    if (test && test.question_ids && test.question_ids.length > 0) {
      // Test ke question_ids se laao
      questions = await Question.find({ _id: { $in: test.question_ids } })
        .sort({ questionNumber: 1, createdAt: 1 });
    } else {
      // Fallback: Question.testId se laao
      questions = await Question.find({ testId: testId })
        .sort({ questionNumber: 1, createdAt: 1 });
    }
    
    res.json({ success: true, questions, count: questions.length });
  } catch (err) {
    console.error("Error loading test questions:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
// BULK IMPORT - JSON (Frontend se ready questions)
// =====================================================
router.post(
  "/bulk/import-json",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    try {
      const { testId, language, subject, chapter, questions } = req.body;
      
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "No questions provided" 
        });
      }
      
      // Questions ko normalize karein
      const questionsToInsert = questions.map((q, i) => ({
        question_hi: q.question_hi || q.questionHindi || q.questionText || "",
        question_en: q.question_en || q.questionEnglish || "",
        options: q.options || q.optionsHindi || [],
        options_en: q.options_en || q.optionsEnglish || [],
        answer: q.answer || q.correctAnswer || "A",
        correctAnswer: q.correctAnswer || 0,
        explanation_hi: q.explanation_hi || q.explanationHindi || "",
        explanation_en: q.explanation_en || q.explanationEnglish || "",
        subject: q.subject || subject || "General",
        chapter: q.chapter || chapter || "General",
        questionNumber: q.questionNumber || (i + 1),
        language: language || "bilingual",
        testId: testId || null,
        tests: testId ? [testId] : [],
        visible: true
      }));
      
      const inserted = await Question.insertMany(questionsToInsert);
      
      // Agar testId diya hai, toh Test model mein question_ids update karein
      if (testId) {
        const Test = require("../models/Test");
        const test = await Test.findById(testId);
        if (test) {
          const existingIds = test.question_ids || [];
          const newIds = inserted.map(q => q._id);
          test.question_ids = [...new Set([...existingIds, ...newIds])];
          test.total_questions = test.question_ids.length;
          await test.save();
        }
      }
      
      res.json({
        success: true,
        message: inserted.length + " questions imported successfully",
        imported: inserted.length,
        count: inserted.length,
        data: inserted
      });
    } catch (e) {
      console.error("Bulk import error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  }
);


// =====================================================
// BULK IMPORT - JSON
// =====================================================
router.post(
  "/bulk/import-json",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    try {
      const { testId, language, subject, chapter, questions } = req.body;
      
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ success: false, message: "No questions provided" });
      }
      
      const questionsToInsert = questions.map((q, i) => ({
        question_hi: q.question_hi || q.questionHindi || q.questionText || "",
        question_en: q.question_en || q.questionEnglish || "",
        options: q.options || q.optionsHindi || [],
        options_en: q.options_en || q.optionsEnglish || [],
        answer: q.answer || q.correctAnswer || "A",
        correctAnswer: q.correctAnswer || 0,
        explanation_hi: q.explanation_hi || q.explanationHindi || "",
        explanation_en: q.explanation_en || q.explanationEnglish || "",
        subject: q.subject || subject || "General",
        chapter: q.chapter || chapter || "General",
        questionNumber: q.questionNumber || (i + 1),
        language: language || "bilingual",
        testId: testId || null,
        tests: testId ? [testId] : [],
        visible: true
      }));
      
      const inserted = await Question.insertMany(questionsToInsert);
      
      if (testId) {
        const Test = require("../models/Test");
        const test = await Test.findById(testId);
        if (test) {
          const existingIds = test.question_ids || [];
          const newIds = inserted.map(q => q._id);
          test.question_ids = [...new Set([...existingIds, ...newIds])];
          test.total_questions = test.question_ids.length;
          await test.save();
        }
      }
      
      res.json({
        success: true,
        message: inserted.length + " questions imported successfully",
        imported: inserted.length,
        count: inserted.length,
        data: inserted
      });
    } catch (e) {
      console.error("Bulk import error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

module.exports = router;


