const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Question = require("../models/Question");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// GET all questions (Public)
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
      .limit(500);

    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create single question (Admin)
router.post("/", requireLogin, requireAdmin, async (req, res) => {
  try {
    const q = await Question.create(req.body);
    res.json({ success: true, data: q });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Upload PDF / Word (Admin)
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
        count: inserted.length
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

// Parser
function parseQuestionsFromText(text) {
  const questions = [];
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const blocks = text.split(/\n(?=(?:Q\.?\s*\d+|\d+)\.\s)/i);

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    const qMatch = block.match(/^(?:Q\.?\s*)?(\d+)\.\s*([\s\S]*?)(?=\n\s*[A-D]\.\s)/i);
    if (!qMatch) continue;

    const fullQuestion = qMatch[2].trim().replace(/\n/g, " ");

    let question_hi = fullQuestion;
    let question_en = "";

    if (fullQuestion.includes("/")) {
      const parts = fullQuestion.split("/");
      question_hi = parts[0].trim();
      question_en = parts.slice(1).join("/").trim();
    }

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

    let answer = "";
    const ansMatch = block.match(/(?:Answer|Ans|उत्तर)\s*:?\s*([A-D])/i);
    if (ansMatch) answer = ansMatch[1].toUpperCase();

    let explanation_hi = "";
    let explanation_en = "";
    const expMatch = block.match(
      /(?:Explanation|व्याख्या|विस्तृत व्याख्या)\s*:?\s*([\s\S]*?)(?=\n\s*(?:Key|मुख्य|Q\.?\s*\d|\d+\.\s|$))/i
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

    const key_points = [];
    const kpMatch = block.match(
      /(?:Key Points|मुख्य बिंदु)\s*:?\s*([\s\S]*?)(?=\n\s*(?:Q\.?\s*\d|\d+\.\s|$))/i
    );
    if (kpMatch) {
      const kpText = kpMatch[1].trim();
      kpText.split("\n").forEach((l) => {
        const cleaned = l.replace(/^[-•*]\s*/, "").trim();
        if (cleaned) key_points.push(cleaned);
      });
    }

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

// Delete all (DEV)
router.delete("/all", requireLogin, requireAdmin, async (req, res) => {
  try {
    await Question.deleteMany({});
    res.json({ success: true, message: "All questions deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
