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

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"
    ];

    const ext = (file.originalname || "").toLowerCase();

    if (
      allowed.includes(file.mimetype) ||
      ext.endsWith(".pdf") ||
      ext.endsWith(".docx") ||
      ext.endsWith(".doc")
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
    return res.status(401).json({
      success: false,
      message: "Login required"
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  next();
}

// ======================================================
// HELPERS
// ======================================================

function clean(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeLanguage(language) {
  const value = String(language || "bilingual")
    .trim()
    .toLowerCase();

  if (value === "hindi") return "hindi";
  if (value === "english") return "english";

  return "bilingual";
}

function normalizeText(text) {
  return clean(text)
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// QUESTION NUMBER DETECTION
// Supports:
// QUESTION 1
// QUESTION 10
// Q1
// Q.1
// 1.
// 1)
// ======================================================

function isQuestionHeading(line) {
  return /^\s*(?:QUESTION|Question|question|Q|q)\s*\.?\s*\d+\s*$/i.test(
    line
  );
}

function getQuestionNumber(line) {
  const match = String(line || "").match(
    /^\s*(?:QUESTION|Question|question|Q|q)\s*\.?\s*(\d+)\s*$/i
  );

  return match ? Number(match[1]) : null;
}

// ======================================================
// FIELD EXTRACTION
// ======================================================

function extractField(block, fieldName) {
  const regex = new RegExp(
    "^\\s*" +
      fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "\\s*:\\s*(.*)$",
    "im"
  );

  const match = block.match(regex);

  if (!match) return "";

  const start = match.index + match[0].length;

  const remaining = block.slice(start);

  const stopPatterns = [
    /^English Question\s*:/im,
    /^Hindi Question\s*:/im,
    /^Hindi Explanation\s*:/im,
    /^English Explanation\s*:/im,
    /^Answer\s*:/im,
    /^QUESTION\s+\d+/im
  ];

  let end = remaining.length;

  for (const pattern of stopPatterns) {
    const m = remaining.search(pattern);

    if (m !== -1 && m < end) {
      end = m;
    }
  }

  return clean(match[1] + " " + remaining.slice(0, end));
}

// ======================================================
// ANSWER
// ======================================================

function extractAnswer(block) {
  const match = block.match(
    /^\s*Answer\s*:\s*([A-Da-d])(?:\s|$)/im
  );

  if (!match) return "";

  return match[1].toUpperCase();
}

// ======================================================
// OPTIONS PARSER
//
// Handles:
//
// A. Hindi / English B. Hindi / English C. ...
//
// Also handles:
//
// A. ...
// B. ...
// C. ...
// D. ...
//
// And line breaks between option text.
// ======================================================

function extractOptions(block) {
  const options = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  /*
    Important:
    We detect A/B/C/D even when all four options
    are present inside ONE paragraph.
  */

  const optionRegex =
    /(?:^|\s)([ABCD])\s*[\.\)]\s*/gi;

  const matches = [];
  let match;

  while ((match = optionRegex.exec(block)) !== null) {
    matches.push({
      letter: match[1].toUpperCase(),
      start: match.index,
      contentStart: optionRegex.lastIndex
    });
  }

  if (!matches.length) {
    return options;
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];

    let end =
      i + 1 < matches.length
        ? matches[i + 1].start
        : block.length;

    let value = block
      .slice(current.contentStart, end)
      .trim();

    /*
      Do not allow Answer / Explanation to become
      part of the last option.
    */

    value = value
      .replace(/\bAnswer\s*:\s*[A-Da-d].*$/is, "")
      .replace(/\bHindi Explanation\s*:.*$/is, "")
      .replace(/\bEnglish Explanation\s*:.*$/is, "")
      .trim();

    options[current.letter] = clean(value);
  }

  return options;
}

// ======================================================
// SPLIT HINDI / ENGLISH OPTIONS
//
// Example:
//
// नई दिल्ली / New Delhi
//
// becomes:
//
// hindi: नई दिल्ली
// english: New Delhi
// ======================================================

function splitBilingualOption(value) {
  const text = clean(value);

  if (!text) {
    return {
      hindi: "",
      english: ""
    };
  }

  const parts = text.split(/\s*\/\s*/);

  if (parts.length >= 2) {
    return {
      hindi: clean(parts[0]),
      english: clean(parts.slice(1).join(" / "))
    };
  }

  return {
    hindi: text,
    english: text
  };
}

// ======================================================
// QUESTION BLOCK PARSER
// ======================================================

function parseQuestionBlock(block, number) {
  const hindiQuestion = extractField(block, "Hindi Question");
  const englishQuestion = extractField(block, "English Question");

  const hindiExplanation = extractField(
    block,
    "Hindi Explanation"
  );

  const englishExplanation = extractField(
    block,
    "English Explanation"
  );

  const answer = extractAnswer(block);

  const rawOptions = extractOptions(block);

  const options = {
    hindi: {
      A: "",
      B: "",
      C: "",
      D: ""
    },

    english: {
      A: "",
      B: "",
      C: "",
      D: ""
    }
  };

  for (const letter of ["A", "B", "C", "D"]) {
    const split = splitBilingualOption(rawOptions[letter]);

    options.hindi[letter] = split.hindi;
    options.english[letter] = split.english;
  }

  return {
    questionNumber: number,

    hindiQuestion,
    englishQuestion,

    options,

    answer,

    hindiExplanation,
    englishExplanation,

    rawOptions
  };
}

// ======================================================
// SPLIT DOCUMENT INTO QUESTION BLOCKS
//
// This is the main fix.
//
// It does NOT depend on page breaks.
// It does NOT depend on line count.
// It works with 100 / 500 / 1000 questions.
// ======================================================

function splitIntoQuestionBlocks(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim());

  const blocks = [];

  let current = [];
  let currentNumber = null;

  for (const line of lines) {
    if (!line) {
      if (current.length) {
        current.push("");
      }

      continue;
    }

    if (isQuestionHeading(line)) {
      if (current.length && currentNumber !== null) {
        blocks.push({
          number: currentNumber,
          text: current.join("\n")
        });
      }

      current = [];
      currentNumber = getQuestionNumber(line);

      continue;
    }

    if (currentNumber !== null) {
      current.push(line);
    }
  }

  if (current.length && currentNumber !== null) {
    blocks.push({
      number: currentNumber,
      text: current.join("\n")
    });
  }

  return blocks;
}

// ======================================================
// VALIDATE QUESTION
// ======================================================

function validateQuestion(question) {
  const errors = [];

  if (!question.hindiQuestion && !question.englishQuestion) {
    errors.push("Question missing");
  }

  if (!question.answer) {
    errors.push("Answer missing");
  }

  for (const letter of ["A", "B", "C", "D"]) {
    if (
      !question.rawOptions[letter] ||
      !question.rawOptions[letter].trim()
    ) {
      errors.push(`Option ${letter} missing`);
    }
  }

  if (
    question.answer &&
    !["A", "B", "C", "D"].includes(question.answer)
  ) {
    errors.push("Invalid answer");
  }

  return errors;
}

// ======================================================
// EXTRACT DOCX
// ======================================================

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({
    buffer
  });

  return result.value || "";
}

// ======================================================
// EXTRACT PDF
// ======================================================

async function extractPdf(buffer) {
  if (!pdfParse) {
    throw new Error("pdf-parse package is not installed");
  }

  /*
    pdf-parse v2
  */

  try {
    if (typeof pdfParse.PDFParse === "function") {
      const parser = new pdfParse.PDFParse({
        data: buffer
      });

      const result = await parser.getText();

      if (parser.destroy) {
        await parser.destroy();
      }

      return result.text || "";
    }
  } catch (err) {
    console.log("PDF v2 parser failed:", err.message);
  }

  /*
    Old pdf-parse versions
  */

  try {
    if (typeof pdfParse === "function") {
      const result = await pdfParse(buffer);
      return result.text || "";
    }
  } catch (err) {
    console.log("Old PDF parser failed:", err.message);
  }

  throw new Error("Unable to read PDF");
}

// ======================================================
// READ UPLOADED FILE
// ======================================================

async function extractFileText(file) {
  const name = (file.originalname || "").toLowerCase();

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return await extractDocx(file.buffer);
  }

  if (name.endsWith(".pdf")) {
    return await extractPdf(file.buffer);
  }

  throw new Error("Unsupported file type");
}

// ======================================================
// PREVIEW
// ======================================================

router.post(
  "/bulk/preview",
  adminOnly,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a PDF or Word file."
        });
      }

      const language = normalizeLanguage(req.body.language);

      const subject = clean(req.body.subject);
      const chapter = clean(req.body.chapter);

      const text = await extractFileText(req.file);

      if (!text.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "File से text नहीं मिला। अगर PDF scanned image है तो OCR PDF चाहिए।"
        });
      }

      const blocks = splitIntoQuestionBlocks(text);

      const questions = [];
      const invalidQuestions = [];

      for (const block of blocks) {
        const question = parseQuestionBlock(
          block.text,
          block.number
        );

        question.subject = subject;
        question.chapter = chapter;
        question.language = language;

        const errors = validateQuestion(question);

        if (errors.length) {
          invalidQuestions.push({
            questionNumber: block.number,
            errors,
            question
          });
        } else {
          questions.push(question);
        }
      }

      return res.json({
        success: true,

        message: `${questions.length} questions detected successfully.`,

        totalDetected: blocks.length,

        validQuestions: questions.length,

        invalidQuestions: invalidQuestions.length,

        questions,

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
// IMPORT TO MONGODB
// ======================================================

router.post(
  "/bulk/import",
  adminOnly,
  async (req, res) => {
    try {
      const {
        testId,
        language,
        subject,
        chapter,
        questions
      } = req.body;

      // --------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------

      if (!testId) {
        return res.status(400).json({
          success: false,
          message: "Test ID is required"
        });
      }

      if (!Array.isArray(questions) || !questions.length) {
        return res.status(400).json({
          success: false,
          message: "No questions found for import"
        });
      }

      // --------------------------------------------------
      // CHECK TEST
      // --------------------------------------------------

      const test = await Test.findById(testId);

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test not found"
        });
      }

      // --------------------------------------------------
      // NORMALIZE LANGUAGE
      // --------------------------------------------------

      const selectedLanguage = normalizeLanguage(language);

      // --------------------------------------------------
      // BUILD MONGODB DOCUMENTS
      // --------------------------------------------------

      const docs = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // ----------------------------------------------
        // QUESTION TEXT
        // ----------------------------------------------

        const questionHindi = clean(
          q.hindiQuestion ||
          q.questionHindi ||
          q.question?.hindi ||
          ""
        );

        const questionEnglish = clean(
          q.englishQuestion ||
          q.questionEnglish ||
          q.question?.english ||
          ""
        );

        // ----------------------------------------------
        // OPTIONS
        // ----------------------------------------------

        const hindiOptions = [
          clean(
            q.optionsHindi?.[0] ||
            q.options?.hindi?.A ||
            ""
          ),

          clean(
            q.optionsHindi?.[1] ||
            q.options?.hindi?.B ||
            ""
          ),

          clean(
            q.optionsHindi?.[2] ||
            q.options?.hindi?.C ||
            ""
          ),

          clean(
            q.optionsHindi?.[3] ||
            q.options?.hindi?.D ||
            ""
          )
        ];

        const englishOptions = [
          clean(
            q.optionsEnglish?.[0] ||
            q.options?.english?.A ||
            ""
          ),

          clean(
            q.optionsEnglish?.[1] ||
            q.options?.english?.B ||
            ""
          ),

          clean(
            q.optionsEnglish?.[2] ||
            q.options?.english?.C ||
            ""
          ),

          clean(
            q.optionsEnglish?.[3] ||
            q.options?.english?.D ||
            ""
          )
        ];

        // ----------------------------------------------
        // COMBINED OPTIONS
        // ----------------------------------------------

        const combinedOptions = [];

        for (let j = 0; j < 4; j++) {
          const hindi = hindiOptions[j];
          const english = englishOptions[j];

          let combined = "";

          if (hindi && english && hindi !== english) {
            combined = `${hindi} / ${english}`;
          } else {
            combined = hindi || english || "";
          }

          combinedOptions.push(combined);
        }

        // ----------------------------------------------
        // CORRECT ANSWER
        // ----------------------------------------------

        let correctAnswer = q.correctAnswer;

        if (
          typeof correctAnswer === "string" &&
          /^[A-Da-d]$/.test(correctAnswer.trim())
        ) {
          correctAnswer =
            correctAnswer.trim().toUpperCase().charCodeAt(0) -
            "A".charCodeAt(0);
        }

        if (
          correctAnswer === undefined ||
          correctAnswer === null ||
          correctAnswer === ""
        ) {
          const answer = String(
            q.answer || ""
          )
            .trim()
            .toUpperCase();

          if (/^[A-D]$/.test(answer)) {
            correctAnswer =
              answer.charCodeAt(0) -
              "A".charCodeAt(0);
          }
        }

        correctAnswer = Number(correctAnswer);

        // ----------------------------------------------
        // EXPLANATION
        // ----------------------------------------------

        const explanationHindi = clean(
          q.hindiExplanation ||
          q.explanationHindi ||
          q.explanation?.hindi ||
          ""
        );

        const explanationEnglish = clean(
          q.englishExplanation ||
          q.explanationEnglish ||
          q.explanation?.english ||
          ""
        );

        // ----------------------------------------------
        // COMBINED QUESTION
        // ----------------------------------------------

        let combinedQuestion = "";

        if (
          questionHindi &&
          questionEnglish &&
          questionHindi !== questionEnglish
        ) {
          combinedQuestion =
            `${questionHindi}\n\n${questionEnglish}`;
        } else {
          combinedQuestion =
            questionHindi ||
            questionEnglish ||
            "";
        }

        // ----------------------------------------------
        // COMBINED EXPLANATION
        // ----------------------------------------------

        let combinedExplanation = "";

        if (
          explanationHindi &&
          explanationEnglish &&
          explanationHindi !== explanationEnglish
        ) {
          combinedExplanation =
            `${explanationHindi}\n\n${explanationEnglish}`;
        } else {
          combinedExplanation =
            explanationHindi ||
            explanationEnglish ||
            "";
        }

        // ----------------------------------------------
        // VALIDATION
        // ----------------------------------------------

        if (!combinedQuestion) {
          throw new Error(
            `Question ${i + 1}: Question text is missing`
          );
        }

        if (combinedOptions.length !== 4) {
          throw new Error(
            `Question ${i + 1}: Exactly 4 options are required`
          );
        }

        if (
          combinedOptions.some(
            option => !option
          )
        ) {
          throw new Error(
            `Question ${i + 1}: All 4 options are required`
          );
        }

        if (
          !Number.isInteger(correctAnswer) ||
          correctAnswer < 0 ||
          correctAnswer > 3
        ) {
          throw new Error(
            `Question ${i + 1}: Correct answer must be A, B, C or D`
          );
        }

        // ----------------------------------------------
        // FINAL MONGODB DOCUMENT
        // ----------------------------------------------

        const questionData = {
          testId: test._id,

          subject:
            clean(q.subject) ||
            clean(subject) ||
            "General",

          chapter:
            clean(q.chapter) ||
            clean(chapter) ||
            "General",

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
        };

        docs.push(questionData);
      }

      // --------------------------------------------------
      // INSERT ALL QUESTIONS
      // --------------------------------------------------

      const inserted = await Question.insertMany(
        docs,
        {
          ordered: true
        }
      );

      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      return res.json({
        success: true,

        message:
          `${inserted.length} questions imported successfully.`,

        imported: inserted.length,

        total: questions.length
      });

    } catch (error) {
      console.error(
        "Bulk Import Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Questions import failed"
      });
    }
  }
);
router.get(
  "/admin/test/:testId",
  adminOnly,
  async (req, res) => {
    try {
      const questions = await Question.find({
        testId: req.params.testId
      }).sort({
        questionNumber: 1,
        createdAt: 1
      });

      res.json({
        success: true,
        questions
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Unable to load questions"
      });
    }
  }
);

// ======================================================
// STUDENT QUESTIONS
// ======================================================

router.get(
  "/test/:testId",
  async (req, res) => {
    try {
      const test = await Test.findById(
        req.params.testId
      );

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test not found"
        });
      }

      if (test.visible === false) {
        return res.status(404).json({
          success: false,
          message: "Test is not available"
        });
      }

      const questions =
        await Question.find({
          testId: req.params.testId
        })
          .select(
            "-answer -explanation"
          )
          .sort({
            questionNumber: 1,
            createdAt: 1
          });

      res.json({
        success: true,
        questions
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Unable to load test questions"
      });
    }
  }
);

// ======================================================
// MANUAL QUESTION ADD
// ======================================================

router.post(
  "/",
  adminOnly,
  async (req, res) => {
    try {
      const question = await Question.create(
        req.body
      );

      res.json({
        success: true,
        message: "Question added successfully",
        question
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ======================================================
// UPDATE QUESTION
// ======================================================

router.put(
  "/:id",
  adminOnly,
  async (req, res) => {
    try {
      const question =
        await Question.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true
          }
        );

      if (!question) {
        return res.status(404).json({
          success: false,
          message: "Question not found"
        });
      }

      res.json({
        success: true,
        message: "Question updated successfully",
        question
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ======================================================
// DELETE QUESTION
// ======================================================

router.delete(
  "/:id",
  adminOnly,
  async (req, res) => {
    try {
      const question =
        await Question.findByIdAndDelete(
          req.params.id
        );

      if (!question) {
        return res.status(404).json({
          success: false,
          message: "Question not found"
        });
      }

      res.json({
        success: true,
        message: "Question deleted successfully"
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Delete failed"
      });
    }
  }
);

// ======================================================
// MULTER ERROR
// ======================================================

router.use(
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    next();
  }
);

module.exports = router;