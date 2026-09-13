// routes/questions.js

const express = require("express");
const router = express.Router();

const multer = require("multer");
const mammoth = require("mammoth");

let pdfParse = null;

try {
  pdfParse = require("pdf-parse");
} catch (err) {
  console.log("pdf-parse not available");
}

const Question = require("../models/Question");
const Test = require("../models/Test");

// ======================================================
// MULTER
// ======================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileName = String(file.originalname || "").toLowerCase();
    if (
      fileName.endsWith(".pdf") ||
      fileName.endsWith(".docx") ||
      fileName.endsWith(".doc")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC or DOCX files are allowed."));
    }
  }
});

// ======================================================
// ADMIN CHECK
// ======================================================

function adminOnly(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: "Login required" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

// ======================================================
// HELPERS
// ======================================================

function clean(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeText(text) {
  return clean(text).replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeLanguage(language) {
  const value = String(language || "bilingual").trim().toLowerCase();
  if (value === "hindi") return "hindi";
  if (value === "english") return "english";
  return "bilingual";
}

// ======================================================
// QUESTION NUMBER DETECTOR
// ======================================================

function getQuestionNumber(line) {
  const l = clean(line);
  const patterns = [
    /^QUESTION\s*[\.\:\-\)]?\s*(\d+)/i,
    /^Q\s*[\.\:\-\)]?\s*(\d+)/i,
    /^प्रश्न\s*[\.\:\-\)]?\s*(\d+)/,
    /^(\d+)\s*[\.\)\:]/
  ];
  for (const p of patterns) {
    const m = l.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

// ======================================================
// SPLIT INTO QUESTION BLOCKS
// ======================================================

function splitIntoQuestionBlocks(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");

  const lines = normalized.split("\n").map(l => l.trim());
  const blocks = [];
  let currentNumber = null;
  let currentLines = [];

  function saveCurrent() {
    if (currentNumber !== null && currentLines.length) {
      const blockText = currentLines.join("\n").trim();
      if (blockText) {
        blocks.push({ number: currentNumber, text: blockText });
      }
    }
  }

  for (const line of lines) {
    if (!line) {
      if (currentNumber !== null) currentLines.push("");
      continue;
    }

    const number = getQuestionNumber(line);

    if (number !== null) {
      const afterHeading = line.replace(
        /^(?:QUESTION|Q|प्रश्न)\s*[\.\:\-\)]?\s*\d+\s*[\.\)\:\-]?\s*/i,
        ""
      ).trim();

      const numericHeading = line.match(/^(\d+)\s*[\.\)]\s*(.*)$/);

      if (afterHeading || numericHeading) {
        saveCurrent();
        currentNumber = number;

        if (afterHeading) {
          currentLines = [afterHeading];
        } else if (numericHeading && numericHeading[2]) {
          currentLines = [numericHeading[2].trim()];
        } else {
          currentLines = [];
        }
        continue;
      }
    }

    if (currentNumber !== null) {
      currentLines.push(line);
    }
  }

  saveCurrent();

  if (blocks.length > 0) {
    return blocks;
  }

  console.log("⚠️  Normal split failed → trying fallback...");
  return splitQuestionBlocksFallback(normalized);
}

// ======================================================
// FALLBACK SPLITTER
// ======================================================

function splitQuestionBlocksFallback(text) {
  const source = String(text || "").replace(/\r/g, "").replace(/\u00A0/g, " ");

  const regex = /(?:^|\s)(?:QUESTION|Q|प्रश्न)\s*[\.\:\-\)]?\s*(\d+)\s*[\.\)\:\-]?\s*/gi;

  const matches = [];
  let match;

  while ((match = regex.exec(source)) !== null) {
    matches.push({ number: Number(match[1]), start: regex.lastIndex });
  }

  console.log(`📦 Fallback found ${matches.length} headings`);

  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const end = next ? next.start : source.length;

    let blockText = source.substring(current.start, end).trim();

    blockText = blockText
      .replace(/\s+(?:QUESTION|Q|प्रश्न)\s*[\.\:\-\)]?\s*\d+\s*[\.\)\:\-]?\s*$/i, "")
      .trim();

    if (blockText) {
      blocks.push({ number: current.number, text: blockText });
    }
  }

  return blocks;
}

// ======================================================
// FIELD EXTRACTION
// ======================================================

function extractField(block, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("^\\s*" + escaped + "\\s*:\\s*(.*)$", "im");
  const match = block.match(regex);

  if (!match) return "";

  const start = match.index + match[0].length;
  const remaining = block.slice(start);

  const stopPatterns = [
    /^Hindi Question\s*:/im,
    /^English Question\s*:/im,
    /^Hindi Option\s+[A-D]\s*:/im,
    /^English Option\s+[A-D]\s*:/im,
    /^Option\s+[A-D]\s*:/im,
    /^Answer\s*:/im,
    /^Hindi Explanation\s*:/im,
    /^English Explanation\s*:/im,
    /^Subject\s*:/im,
    /^Chapter\s*:/im
  ];

  let end = remaining.length;
  for (const pattern of stopPatterns) {
    const found = remaining.search(pattern);
    if (found !== -1 && found < end) end = found;
  }

  return clean(match[1] + " " + remaining.slice(0, end));
}

function extractSubject(block) { return extractField(block, "Subject"); }
function extractChapter(block) { return extractField(block, "Chapter"); }

// ======================================================
// ANSWER EXTRACTION
// ======================================================

function extractAnswer(block) {
  const match = block.match(
    /^\s*(?:Answer|Ans|Correct|उत्तर|सही उत्तर)\s*[:\-]\s*\(?\s*([A-Da-d1-4])\s*\)?\s*$/im
  );

  if (!match) return "";

  const value = match[1].trim().toUpperCase();

  if (["A", "B", "C", "D"].includes(value)) return value;

  const numericMap = { "1": "A", "2": "B", "3": "C", "4": "D" };
  return numericMap[value] || "";
}

// ======================================================
// OPTIONS EXTRACTION
// ======================================================

function extractGenericOptions(block) {
  const options = { A: "", B: "", C: "", D: "" };

  const regex = /(?:^|\n|\s)([ABCD])\s*[\.\)\:]\s+/gi;
  const matches = [];
  let match;

  while ((match = regex.exec(block)) !== null) {
    matches.push({
      letter: match[1].toUpperCase(),
      contentStart: regex.lastIndex,
      markerStart: match.index
    });
  }

  if (!matches.length) return options;

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const end = next ? next.markerStart : block.length;

    let value = block.slice(current.contentStart, end);

    value = value.replace(
      /\s*(?:Answer|Ans|Correct|Hindi Explanation|English Explanation|Explanation|Subject|Chapter)\s*:.*$/is,
      ""
    );

    value = clean(value);
    if (!options[current.letter]) options[current.letter] = value;
  }

  return options;
}

// ======================================================
// BILINGUAL SPLITTER
// ======================================================

function splitBilingualValue(value) {
  const text = clean(value);
  if (!text) return { hindi: "", english: "" };

  const parts = text.split(/\s*\/\s*/);
  if (parts.length >= 2) {
    return {
      hindi: clean(parts[0]),
      english: clean(parts.slice(1).join(" / "))
    };
  }

  return { hindi: text, english: text };
}

function parseOptions(block) {
  const generic = extractGenericOptions(block);
  const hindi = { A: "", B: "", C: "", D: "" };
  const english = { A: "", B: "", C: "", D: "" };

  for (const letter of ["A", "B", "C", "D"]) {
    if (generic[letter]) {
      const split = splitBilingualValue(generic[letter]);
      hindi[letter] = split.hindi;
      english[letter] = split.english;
    }
  }

  return { hindi, english };
}

// ======================================================
// PARSE QUESTION BLOCK (FINAL)
// ======================================================

function parseQuestionBlock(block, number) {
  let hindiQuestion = extractField(block, "Hindi Question");
  let englishQuestion = extractField(block, "English Question");

  const hindiExplanation = extractField(block, "Hindi Explanation");
  const englishExplanation = extractField(block, "English Explanation");
  const subject = extractSubject(block);
  const chapter = extractChapter(block);
  const answer = extractAnswer(block);
  const parsedOptions = parseOptions(block);

  if (!hindiQuestion && !englishQuestion) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);

    const firstOptionIdx = lines.findIndex(l => /^[ABCD]\s*[\.\)\:]\s+/i.test(l));
    const firstAnswerIdx = lines.findIndex(l => /^(?:Answer|Ans|Correct|उत्तर)\s*[:\-]/i.test(l));

    let endIdx = lines.length;
    if (firstOptionIdx > 0) endIdx = firstOptionIdx;
    if (firstAnswerIdx > 0 && firstAnswerIdx < endIdx) endIdx = firstAnswerIdx;

    const questionLines = lines.slice(0, endIdx);
    const qText = questionLines.join(" ").trim();

    const hasHindi = /[\u0900-\u097F]/.test(qText);
    const hasEnglish = /[a-zA-Z]{3,}/.test(qText);

    if (hasHindi && hasEnglish) {
      let hindiPart = "";
      let englishPart = "";

      const questionMarkMatch = qText.match(/^(.+?[\?।])\s*(.+)$/);
      if (questionMarkMatch) {
        hindiPart = questionMarkMatch[1].trim();
        englishPart = questionMarkMatch[2].trim();
      } else {
        const splitMatch = qText.match(/^([\u0900-\u097F\s\?।\.\,\-]+)\s+(.+)$/);
        if (splitMatch) {
          hindiPart = splitMatch[1].trim();
          englishPart = splitMatch[2].trim();
        } else {
          hindiPart = qText;
          englishPart = qText;
        }
      }

      hindiQuestion = hindiPart;
      englishQuestion = englishPart;
    } else if (hasHindi) {
      hindiQuestion = qText;
      englishQuestion = "";
    } else if (hasEnglish) {
      englishQuestion = qText;
      hindiQuestion = "";
    }
  }

  const rawOptions = { A: "", B: "", C: "", D: "" };
  for (const letter of ["A", "B", "C", "D"]) {
    const h = parsedOptions.hindi[letter];
    const e = parsedOptions.english[letter];
    if (h && e && h !== e) {
      rawOptions[letter] = `${h} / ${e}`;
    } else {
      rawOptions[letter] = h || e || "";
    }
  }

  // ⚡ UNIVERSAL OUTPUT: dono naming conventions
  return {
    questionNumber: Number(number) || 0,
    subject,
    chapter,

    // Original parser fields
    hindiQuestion,
    englishQuestion,
    options: parsedOptions,
    answer,
    hindiExplanation,
    englishExplanation,
    rawOptions,

    // Frontend-compatible aliases
    questionHindi: hindiQuestion,
    questionEnglish: englishQuestion,
    optionsHindi: [
      parsedOptions.hindi.A || "",
      parsedOptions.hindi.B || "",
      parsedOptions.hindi.C || "",
      parsedOptions.hindi.D || ""
    ],
    optionsEnglish: [
      parsedOptions.english.A || "",
      parsedOptions.english.B || "",
      parsedOptions.english.C || "",
      parsedOptions.english.D || ""
    ],
    questionText: hindiQuestion || englishQuestion,
    question: hindiQuestion || englishQuestion,
    explanation: hindiExplanation || englishExplanation,
    correctAnswer: ["A", "B", "C", "D"].indexOf(answer)
  };
}

// ======================================================
// VALIDATE
// ======================================================

function validateQuestion(question) {
  const errors = [];

  if (!question.hindiQuestion && !question.englishQuestion) {
    errors.push("Question text missing");
  }

  if (!question.answer) {
    errors.push("Answer missing");
  }

  for (const letter of ["A", "B", "C", "D"]) {
    const h = question.options?.hindi?.[letter] || "";
    const e = question.options?.english?.[letter] || "";
    if (!clean(h) && !clean(e)) {
      errors.push(`Option ${letter} missing`);
    }
  }

  return errors;
}

// ======================================================
// EXTRACT DOCX / PDF
// ======================================================

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value || "");
}

async function extractPdf(buffer) {
  if (!pdfParse) {
    throw new Error("pdf-parse not installed. Run: npm install pdf-parse");
  }

  try {
    if (typeof pdfParse.PDFParse === "function") {
      const parser = new pdfParse.PDFParse({ data: buffer });
      const result = await parser.getText();
      if (parser && typeof parser.destroy === "function") await parser.destroy();
      const text = result?.text || "";
      if (text.trim()) return normalizeText(text);
    }
  } catch (error) {
    console.log("PDF v2 parser failed:", error.message);
  }

  try {
    if (typeof pdfParse === "function") {
      const result = await pdfParse(buffer);
      const text = result?.text || "";
      if (text.trim()) return normalizeText(text);
    }
  } catch (error) {
    console.log("Old PDF parser failed:", error.message);
  }

  throw new Error("Unable to read PDF text.");
}

async function extractFileText(file) {
  const name = String(file.originalname || "").toLowerCase();

  if (name.endsWith(".docx")) return extractDocx(file.buffer);

  if (name.endsWith(".doc")) {
    throw new Error("Old .DOC not supported. Save as .DOCX and try again.");
  }

  if (name.endsWith(".pdf")) return extractPdf(file.buffer);

  throw new Error("Unsupported file type");
}

// ======================================================
// HEALTH
// ======================================================

router.get("/health", (req, res) => {
  res.json({ success: true, message: "Questions route is working" });
});

// ======================================================
// BULK PREVIEW
// ======================================================

router.post(
  "/bulk/preview",
  adminOnly,
  upload.single("pdfFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a PDF or DOCX file."
        });
      }

      const language = normalizeLanguage(req.body.language);
      const selectedSubject = clean(req.body.subject);
      const selectedChapter = clean(req.body.chapter);

      const text = await extractFileText(req.file);

      console.log("═══════════════════════════════════════════════════════");
      console.log("BULK FILE:", req.file.originalname);
      console.log("TEXT LENGTH:", text.length);
      console.log("───────────────────────────────────────────────────────");
      console.log("EXTRACTED TEXT (first 2000 chars):");
      console.log(text.substring(0, 2000));
      console.log("═══════════════════════════════════════════════════════");

      if (!text.trim()) {
        return res.status(400).json({
          success: false,
          message: "File से text नहीं मिला।"
        });
      }

      const blocks = splitIntoQuestionBlocks(text);
      console.log("✅ QUESTION BLOCKS FOUND:", blocks.length);

      if (!blocks.length) {
        return res.status(400).json({
          success: false,
          message: "No questions found. File में QUESTION 1 जैसा heading होना चाहिए."
        });
      }

      const validQuestions = [];
      const invalidQuestions = [];

      for (const block of blocks) {
        const question = parseQuestionBlock(block.text, block.number);

        question.subject = selectedSubject || question.subject || "General";
        question.chapter = selectedChapter || question.chapter || "General";
        question.language = language;

        const errors = validateQuestion(question);

        if (errors.length) {
          invalidQuestions.push({
            questionNumber: block.number,
            errors,
            question,
            rawBlock: block.text
          });
        } else {
          validQuestions.push(question);
        }
      }

      return res.json({
        success: true,
        message: `${validQuestions.length} questions detected.`,
        totalDetected: blocks.length,
        validQuestions: validQuestions.length,
        invalidQuestions: invalidQuestions.length,
        questions: validQuestions,
        errors: invalidQuestions
      });
    } catch (error) {
      console.error("Bulk Preview Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Preview failed"
      });
    }
  }
);

// ======================================================
// BULK IMPORT (UNIVERSAL - NO DELETE)
// ======================================================

router.post(
  "/bulk/import",
  adminOnly,
  async (req, res) => {
    try {
      const { testId, language, subject, chapter, questions } = req.body;

      if (!testId) {
        return res.status(400).json({ success: false, message: "Test ID is required" });
      }

      if (!Array.isArray(questions) || !questions.length) {
        return res.status(400).json({ success: false, message: "No questions to import" });
      }

      const test = await Test.findById(testId);
      if (!test) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }

      const selectedLanguage = normalizeLanguage(language);
      const docs = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i] || {};

        // ---------- UNIVERSAL QUESTION TEXT ----------
        const questionHindi = clean(q.hindiQuestion || q.questionHindi || "");
        const questionEnglish = clean(q.englishQuestion || q.questionEnglish || "");

        // ---------- UNIVERSAL OPTIONS ----------
        let hindiArr = ["", "", "", ""];
        let englishArr = ["", "", "", ""];

        // Priority 1: q.optionsHindi[] / q.optionsEnglish[]
        if (Array.isArray(q.optionsHindi) && q.optionsHindi.length) {
          hindiArr = [
            q.optionsHindi[0] || "",
            q.optionsHindi[1] || "",
            q.optionsHindi[2] || "",
            q.optionsHindi[3] || ""
          ];
        }
        if (Array.isArray(q.optionsEnglish) && q.optionsEnglish.length) {
          englishArr = [
            q.optionsEnglish[0] || "",
            q.optionsEnglish[1] || "",
            q.optionsEnglish[2] || "",
            q.optionsEnglish[3] || ""
          ];
        }

        // Priority 2: q.options.hindi.A / q.options.english.A
        if (q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
          const h = q.options.hindi || {};
          const e = q.options.english || {};
          if (!hindiArr.some(o => o)) hindiArr = [h.A || "", h.B || "", h.C || "", h.D || ""];
          if (!englishArr.some(o => o)) englishArr = [e.A || "", e.B || "", e.C || "", e.D || ""];
        }

        // Priority 3: q.options[] (combined)
        if (Array.isArray(q.options) && q.options.length) {
          if (!hindiArr.some(o => o) && !englishArr.some(o => o)) {
            hindiArr = [
              q.options[0] || "",
              q.options[1] || "",
              q.options[2] || "",
              q.options[3] || ""
            ];
          }
        }

        const hindiOptions = hindiArr.map(o => clean(o));
        const englishOptions = englishArr.map(o => clean(o));

        const combinedOptions = [];
        for (let j = 0; j < 4; j++) {
          const h = hindiOptions[j];
          const e = englishOptions[j];
          let combined = "";
          if (h && e && h !== e) combined = `${h} / ${e}`;
          else combined = h || e || "";
          combinedOptions.push(combined);
        }

        // ---------- CORRECT ANSWER ----------
        let correctAnswer = q.correctAnswer;

        if (typeof correctAnswer === "string") {
          const a = correctAnswer.trim().toUpperCase();
          if (/^[A-D]$/.test(a)) correctAnswer = a.charCodeAt(0) - 65;
          else if (/^[1-4]$/.test(a)) correctAnswer = Number(a) - 1;
        }

        if (
          correctAnswer === undefined ||
          correctAnswer === null ||
          correctAnswer === "" ||
          isNaN(Number(correctAnswer))
        ) {
          const answer = String(q.answer || "").trim().toUpperCase();
          if (/^[A-D]$/.test(answer)) correctAnswer = answer.charCodeAt(0) - 65;
          else if (/^[1-4]$/.test(answer)) correctAnswer = Number(answer) - 1;
          else correctAnswer = 0;
        }

        correctAnswer = Number(correctAnswer);

        // ---------- EXPLANATION ----------
        const explanationHindi = clean(q.hindiExplanation || q.explanationHindi || "");
        const explanationEnglish = clean(q.englishExplanation || q.explanationEnglish || "");

        let combinedQuestion = "";
        if (questionHindi && questionEnglish && questionHindi !== questionEnglish) {
          combinedQuestion = `${questionHindi}\n\n${questionEnglish}`;
        } else {
          combinedQuestion = questionHindi || questionEnglish || "";
        }

        let combinedExplanation = "";
        if (explanationHindi && explanationEnglish && explanationHindi !== explanationEnglish) {
          combinedExplanation = `${explanationHindi}\n\n${explanationEnglish}`;
        } else {
          combinedExplanation = explanationHindi || explanationEnglish || clean(q.explanation || "");
        }

        // ---------- VALIDATION ----------
        if (!combinedQuestion) {
          return res.status(400).json({
            success: false,
            message: `Q${i + 1}: Question text missing. Hindi: "${questionHindi}", English: "${questionEnglish}"`
          });
        }
        if (combinedOptions.some(opt => !clean(opt))) {
          return res.status(400).json({
            success: false,
            message: `Q${i + 1}: All 4 options required. Got: ${JSON.stringify(combinedOptions)}`
          });
        }
        if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
          return res.status(400).json({
            success: false,
            message: `Q${i + 1}: Correct answer invalid (${q.correctAnswer}/${q.answer}). Must be A/B/C/D or 0-3.`
          });
        }

        // ---------- BUILD DOC ----------
        docs.push({
          testId: test._id,
          questionNumber: Number(q.questionNumber) || i + 1,
          subject: clean(q.subject) || clean(subject) || "General",
          chapter: clean(q.chapter) || clean(chapter) || "General",
          language: selectedLanguage,
          questionText: combinedQuestion,
          optionsText: combinedOptions,
          questionHindi,
          questionEnglish,
          question: combinedQuestion,
          optionsHindi: hindiOptions,
          optionsEnglish: englishOptions,
          options: combinedOptions,
          correctAnswer,
          explanationHindi,
          explanationEnglish,
          explanation: combinedExplanation,
          type: "single"
        });
      }

      const inserted = await Question.insertMany(docs, { ordered: true });

      return res.json({
        success: true,
        message: `${inserted.length} questions imported.`,
        imported: inserted.length,
        total: questions.length
      });
    } catch (error) {
      console.error("Bulk Import Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Import failed"
      });
    }
  }
);

// ======================================================
// ADMIN: GET QUESTIONS
// ======================================================

router.get("/admin/test/:testId", adminOnly, async (req, res) => {
  try {
    const questions = await Question.find({ testId: req.params.testId })
      .sort({ questionNumber: 1, createdAt: 1 });
    return res.json({ success: true, questions });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ======================================================
// STUDENT: GET QUESTIONS
// ======================================================

router.get("/test/:testId", async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });
    if (test.visible === false) return res.status(404).json({ success: false, message: "Not available" });

    const questions = await Question.find({ testId: req.params.testId })
      .select("-answer -explanation")
      .sort({ questionNumber: 1, createdAt: 1 });

    return res.json({ success: true, questions });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ======================================================
// MANUAL ADD
// ======================================================

router.post("/", adminOnly, async (req, res) => {
  try {
    const question = await Question.create(req.body);
    return res.json({ success: true, message: "Added", question });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ======================================================
// UPDATE
// ======================================================

router.put("/:id", adminOnly, async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!question) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, message: "Updated", question });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ======================================================
// DELETE
// ======================================================

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ======================================================
// MULTER ERROR
// ======================================================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;