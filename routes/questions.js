const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const mammoth = require("mammoth");

const Question = require("../models/Question");
const Test = require("../models/Test");

const router = express.Router();

/* =========================================================
   MULTER - PDF / DOCX UPLOAD
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".docx"];
    const extension = require("path")
      .extname(file.originalname)
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(
        new Error("केवल PDF या DOCX file upload कर सकते हैं।")
      );
    }

    cb(null, true);
  }
});

/* =========================================================
   COMMON HELPERS
========================================================= */

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function normalizeLanguage(language) {
  const value = clean(language).toLowerCase();

  if (["hindi", "hi", "हिंदी"].includes(value)) {
    return "hindi";
  }

  if (["english", "en"].includes(value)) {
    return "english";
  }

  if (["bilingual", "both", "dual"].includes(value)) {
    return "bilingual";
  }

  return "hindi";
}

/* =========================================================
   ADMIN AUTH
========================================================= */

function adminOnly(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Login required."
    });
  }

  const role = String(req.session.user.role || "").toLowerCase();

  if (role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required."
    });
  }

  next();
}

/* =========================================================
   ANSWER
========================================================= */

function answerToIndex(answer) {
  const value = clean(answer).toUpperCase();

  const map = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3
  };

  return Object.prototype.hasOwnProperty.call(map, value)
    ? map[value]
    : null;
}

/* =========================================================
   OPTIONS
========================================================= */

function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((item) => clean(item))
    .filter(Boolean)
    .slice(0, 4);
}

/* =========================================================
   QUESTION DATA
========================================================= */

function prepareQuestionData(input) {
  const language = normalizeLanguage(input.language);

  const hindiQuestion = clean(
    input.hindiQuestion ||
      input.questionHindi ||
      input.hiQuestion
  );

  const englishQuestion = clean(
    input.englishQuestion ||
      input.questionEnglish ||
      input.enQuestion
  );

  const hindiOptions = normalizeOptions(
    input.hindiOptions ||
      input.optionsHindi ||
      []
  );

  const englishOptions = normalizeOptions(
    input.englishOptions ||
      input.optionsEnglish ||
      []
  );

  const genericOptions = normalizeOptions(
    input.options || []
  );

  let finalHindiOptions = hindiOptions;
  let finalEnglishOptions = englishOptions;

  if (language === "hindi") {
    if (finalHindiOptions.length === 0) {
      finalHindiOptions = genericOptions;
    }
  }

  if (language === "english") {
    if (finalEnglishOptions.length === 0) {
      finalEnglishOptions = genericOptions;
    }
  }

  if (language === "bilingual") {
    if (finalHindiOptions.length === 0) {
      finalHindiOptions = genericOptions;
    }

    if (finalEnglishOptions.length === 0) {
      finalEnglishOptions = genericOptions;
    }
  }

  const answerIndex = answerToIndex(
    input.answer ||
      input.correctAnswer ||
      input.correct
  );

  const data = {
    testId: input.testId,

    subject: clean(input.subject),
    chapter: clean(input.chapter),

    language,

    question: hindiQuestion || englishQuestion,

    hindiQuestion,
    englishQuestion,

    options:
      language === "english"
        ? finalEnglishOptions
        : finalHindiOptions,

    hindiOptions: finalHindiOptions,
    englishOptions: finalEnglishOptions,

    answer:
      answerIndex !== null
        ? answerIndex
        : clean(input.answer || input.correctAnswer),

    correctAnswer:
      answerIndex !== null
        ? answerIndex
        : clean(input.answer || input.correctAnswer),

    explanation: clean(
      input.explanation ||
        input.hindiExplanation ||
        input.englishExplanation
    ),

    hindiExplanation: clean(
      input.hindiExplanation
    ),

    englishExplanation: clean(
      input.englishExplanation
    )
  };

  return data;
}

/* =========================================================
   VALIDATE QUESTION
========================================================= */

function validateBulkQuestion(question, language) {
  const errors = [];

  const lang = normalizeLanguage(language);

  if (!clean(question.subject)) {
    errors.push("Subject missing");
  }

  if (lang === "hindi" || lang === "bilingual") {
    if (!clean(question.hindiQuestion)) {
      errors.push("Hindi Question missing");
    }

    if (
      !Array.isArray(question.hindiOptions) ||
      question.hindiOptions.length !== 4
    ) {
      errors.push("Hindi options must be exactly 4");
    }
  }

  if (lang === "english" || lang === "bilingual") {
    if (!clean(question.englishQuestion)) {
      errors.push("English Question missing");
    }

    if (
      !Array.isArray(question.englishOptions) ||
      question.englishOptions.length !== 4
    ) {
      errors.push("English options must be exactly 4");
    }
  }

  const answer = answerToIndex(
    question.answer ||
      question.correctAnswer
  );

  if (answer === null) {
    errors.push("Answer must be A, B, C or D");
  }

  return errors;
}

/* =========================================================
   PDF TEXT EXTRACTION
   pdf-parse v2.x compatible
========================================================= */

async function extractPdfText(buffer) {
  try {
    const pdfModule = require("pdf-parse");

    /*
      pdf-parse v2.x
    */

    if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({
        data: buffer
      });

      try {
        const result = await parser.getText();

        if (result && typeof result.text === "string") {
          return result.text;
        }

        return clean(result);
      } finally {
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
      }
    }

    /*
      Older pdf-parse compatibility
    */

    if (typeof pdfModule === "function") {
      const result = await pdfModule(buffer);

      return result && result.text
        ? result.text
        : "";
    }

    if (pdfModule.default) {
      if (typeof pdfModule.default === "function") {
        const result = await pdfModule.default(buffer);

        return result && result.text
          ? result.text
          : "";
      }
    }

    throw new Error(
      "Installed pdf-parse version का API recognize नहीं हुआ।"
    );
  } catch (error) {
    console.error("PDF extraction error:", error);

    throw new Error(
      "PDF पढ़ने में समस्या हुई: " + error.message
    );
  }
}

/* =========================================================
   DOCX TEXT EXTRACTION
========================================================= */

async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({
      buffer
    });

    return result.value || "";
  } catch (error) {
    console.error("DOCX extraction error:", error);

    throw new Error(
      "Word/DOCX file पढ़ने में समस्या हुई: " +
        error.message
    );
  }
}

/* =========================================================
   NORMALIZE EXTRACTED TEXT
========================================================= */

function normalizeExtractedText(text) {
  return clean(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* =========================================================
   QUESTION BLOCK DETECTION
========================================================= */

/*
 Supported formats:

 QUESTION 1
 QUESTION 1:
 Q1
 Q1:
 Q.1
 Q. 1
 1.
 1)
 1:
 1. QUESTION
 1) QUESTION
 Question 1: भारत...
*/

function splitQuestionBlocks(text) {
  const normalized = normalizeExtractedText(text);

  const lines = normalized
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);

  const blocks = [];

  let current = [];

  function isQuestionStart(line) {
    return /^(?:QUESTION|Question|question)\s*\.?\s*\d+\s*:?\s*$/i.test(
      line
    ) ||
      /^Q\s*\.?\s*\d+\s*:?\s*$/i.test(line) ||
      /^\d+\s*[.)\:]\s*$/.test(line) ||
      /^(?:QUESTION|Question|question)\s+\d+\s*[:.)-]\s+.+$/i.test(
        line
      ) ||
      /^Q\s*\.?\s*\d+\s*[:.)-]\s+.+$/i.test(line) ||
      /^\d+\s*[.)\:]\s+.+/.test(line);
  }

  function cleanQuestionStart(line) {
    return line
      .replace(
        /^(?:QUESTION|Question|question)\s*\.?\s*\d+\s*[:.)-]\s*/i,
        ""
      )
      .replace(
        /^Q\s*\.?\s*\d+\s*[:.)-]\s*/i,
        ""
      )
      .replace(
        /^\d+\s*[.)\:]\s*/,
        ""
      )
      .trim();
  }

  for (const line of lines) {
    if (isQuestionStart(line)) {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
      }

      const cleanedStart = cleanQuestionStart(line);

      current = cleanedStart
        ? [cleanedStart]
        : [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

/* =========================================================
   FIELD EXTRACTION
========================================================= */

function getField(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(
      "^\\s*" +
        escaped +
        "\\s*:\\s*(.*?)\\s*(?=\\n\\s*[A-Za-z][A-Za-z ]*\\s*:|$)",
      "ims"
    );

    const match = text.match(regex);

    if (match && clean(match[1])) {
      return clean(match[1]);
    }
  }

  return "";
}

/* =========================================================
   QUESTION TEXT EXTRACTION
========================================================= */

function getQuestionField(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(
      "^\\s*" +
        escaped +
        "\\s*:\\s*(.*?)\\s*(?=\\n\\s*(?:Subject|Chapter|Hindi Question|English Question|Hindi Option|English Option|Option|Answer|Correct Answer|Hindi Explanation|English Explanation)\\s*:|$)",
      "ims"
    );

    const match = text.match(regex);

    if (match && clean(match[1])) {
      return clean(match[1]);
    }
  }

  return "";
}

/* =========================================================
   OPTION EXTRACTION
========================================================= */

function getLanguageOptions(text, language) {
  const result = [];

  const prefix =
    language === "hindi"
      ? "Hindi"
      : "English";

  for (const letter of ["A", "B", "C", "D"]) {
    const regex = new RegExp(
      "^\\s*" +
        prefix +
        "\\s+Option\\s+" +
        letter +
        "\\s*:\\s*(.*?)\\s*(?=\\n\\s*(?:Hindi|English)\\s+Option\\s+[ABCD]\\s*:|\\n\\s*(?:Answer|Correct Answer|Hindi Explanation|English Explanation)\\s*:|$)",
      "ims"
    );

    const match = text.match(regex);

    if (match) {
      result.push(clean(match[1]));
    }
  }

  return result;
}

function getGenericOptions(text) {
  const result = [];

  for (const letter of ["A", "B", "C", "D"]) {
    const regex = new RegExp(
      "^\\s*(?:Option\\s*)?" +
        letter +
        "\\s*[.)\\-:]\\s*(.*?)\\s*(?=\\n\\s*(?:Option\\s*)?[ABCD]\\s*[.)\\-:]|\\n\\s*(?:Answer|Correct Answer|Explanation)\\s*:|$)",
      "ims"
    );

    const match = text.match(regex);

    if (match) {
      result.push(clean(match[1]));
    }
  }

  return result;
}

/* =========================================================
   ANSWER EXTRACTION
========================================================= */

function getAnswer(text) {
  return getField(text, [
    "Answer",
    "Correct Answer",
    "CorrectAnswer",
    "Right Answer"
  ]);
}

/* =========================================================
   PARSE ONE QUESTION
========================================================= */

function parseOneQuestion(
  block,
  index,
  language,
  defaultSubject,
  defaultChapter
) {
  const lang = normalizeLanguage(language);

  const subject =
    getField(block, ["Subject"]) ||
    defaultSubject ||
    "";

  const chapter =
    getField(block, ["Chapter"]) ||
    defaultChapter ||
    "";

  const hindiQuestion = getQuestionField(block, [
    "Hindi Question",
    "Question Hindi",
    "HindiQuestion"
  ]);

  const englishQuestion = getQuestionField(block, [
    "English Question",
    "Question English",
    "EnglishQuestion"
  ]);

  let hindiOptions = getLanguageOptions(
    block,
    "hindi"
  );

  let englishOptions = getLanguageOptions(
    block,
    "english"
  );

  const genericOptions = getGenericOptions(block);

  if (
    hindiOptions.length !== 4 &&
    genericOptions.length === 4
  ) {
    hindiOptions = genericOptions;
  }

  if (
    englishOptions.length !== 4 &&
    genericOptions.length === 4
  ) {
    englishOptions = genericOptions;
  }

  const answer = getAnswer(block);

  const hindiExplanation = getField(block, [
    "Hindi Explanation",
    "Explanation Hindi",
    "HindiExplanation"
  ]);

  const englishExplanation = getField(block, [
    "English Explanation",
    "Explanation English",
    "EnglishExplanation"
  ]);

  const explanation =
    getField(block, ["Explanation"]) ||
    hindiExplanation ||
    englishExplanation;

  return {
    number: index + 1,

    subject,
    chapter,

    language: lang,

    hindiQuestion,
    englishQuestion,

    hindiOptions,
    englishOptions,

    answer,

    hindiExplanation,
    englishExplanation,

    explanation
  };
}

/* =========================================================
   PARSE ALL QUESTIONS
========================================================= */

function parseQuestionsFromText(
  text,
  language,
  defaultSubject,
  defaultChapter
) {
  const blocks = splitQuestionBlocks(text);

  if (blocks.length === 0) {
    throw new Error(
      "कोई question नहीं मिला। PDF/Word format check करें।"
    );
  }

  const questions = [];

  for (let i = 0; i < blocks.length; i++) {
    const parsed = parseOneQuestion(
      blocks[i],
      i,
      language,
      defaultSubject,
      defaultChapter
    );

    questions.push(parsed);
  }

  return questions;
}

/* =========================================================
   CONVERT PARSED QUESTION
========================================================= */

function convertParsedQuestion(
  question,
  language,
  testId
) {
  return prepareQuestionData({
    testId,

    subject: question.subject,
    chapter: question.chapter,

    language,

    hindiQuestion:
      question.hindiQuestion,

    englishQuestion:
      question.englishQuestion,

    hindiOptions:
      question.hindiOptions,

    englishOptions:
      question.englishOptions,

    answer:
      question.answer,

    explanation:
      question.explanation,

    hindiExplanation:
      question.hindiExplanation,

    englishExplanation:
      question.englishExplanation
  });
}

/* =========================================================
   BULK PREVIEW
========================================================= */

router.post(
  "/bulk/preview",
  adminOnly,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "PDF या Word file select करें।"
        });
      }

      const language = normalizeLanguage(
        req.body.language
      );

      const subject = clean(req.body.subject);
      const chapter = clean(req.body.chapter);

      const extension = require("path")
        .extname(req.file.originalname)
        .toLowerCase();

      let text = "";

      if (extension === ".pdf") {
        text = await extractPdfText(
          req.file.buffer
        );
      } else if (extension === ".docx") {
        text = await extractDocxText(
          req.file.buffer
        );
      } else {
        return res.status(400).json({
          success: false,
          message:
            "केवल PDF और DOCX files allowed हैं।"
        });
      }

      text = normalizeExtractedText(text);

      if (!text) {
        return res.status(400).json({
          success: false,
          message:
            "File से कोई text नहीं मिला। अगर PDF scanned image है तो पहले OCR वाला PDF इस्तेमाल करें।"
        });
      }

      const parsedQuestions =
        parseQuestionsFromText(
          text,
          language,
          subject,
          chapter
        );

      const previewQuestions =
        parsedQuestions.map((question) =>
          convertParsedQuestion(
            question,
            language,
            null
          )
        );

      const validation = [];

      previewQuestions.forEach(
        (question, index) => {
          const errors =
            validateBulkQuestion(
              question,
              language
            );

          if (errors.length > 0) {
            validation.push({
              number: index + 1,
              errors
            });
          }
        }
      );

      return res.json({
        success: true,

        message: `${previewQuestions.length} questions मिले।`,

        count: previewQuestions.length,

        valid:
          validation.length === 0,

        validation,

        questions: previewQuestions
      });
    } catch (error) {
      console.error(
        "Bulk preview error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Bulk preview failed."
      });
    }
  }
);

/* =========================================================
   BULK IMPORT
========================================================= */

router.post(
  "/bulk/import",
  adminOnly,
  async (req, res) => {
    try {
      const {
        testId,
        language,
        questions
      } = req.body;

      if (!testId) {
        return res.status(400).json({
          success: false,
          message: "Test ID required."
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          testId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Test ID."
        });
      }

      if (
        !Array.isArray(questions) ||
        questions.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Import करने के लिए questions नहीं मिले। पहले Preview करें।"
        });
      }

      const test = await Test.findById(testId);

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test नहीं मिला।"
        });
      }

      const lang = normalizeLanguage(language);

      const preparedQuestions =
        questions.map((question) =>
          prepareQuestionData({
            ...question,
            testId,
            language: lang
          })
        );

      const errors = [];

      preparedQuestions.forEach(
        (question, index) => {
          const questionErrors =
            validateBulkQuestion(
              question,
              lang
            );

          if (questionErrors.length > 0) {
            errors.push({
              number: index + 1,
              errors: questionErrors
            });
          }
        }
      );

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "कुछ questions में error है। Import रोक दिया गया।",
          errors
        });
      }

      const inserted =
        await Question.insertMany(
          preparedQuestions
        );

      /*
        Test total questions update
      */

      const totalQuestions =
        await Question.countDocuments({
          testId
        });

      test.totalQuestions =
        totalQuestions;

      await test.save();

      return res.json({
        success: true,

        message: `${inserted.length} questions successfully imported.`,

        imported: inserted.length,

        totalQuestions
      });
    } catch (error) {
      console.error(
        "Bulk import error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Bulk import failed."
      });
    }
  }
);

/* =========================================================
   GET QUESTIONS FOR ADMIN
========================================================= */

router.get(
  "/admin/test/:testId",
  adminOnly,
  async (req, res) => {
    try {
      const { testId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          testId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid test ID."
        });
      }

      const questions =
        await Question.find({
          testId
        })
          .sort({ createdAt: 1 })
          .lean();

      return res.json({
        success: true,
        count: questions.length,
        questions
      });
    } catch (error) {
      console.error(
        "Admin questions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Questions load नहीं हो सके।"
      });
    }
  }
);

/* =========================================================
   GET QUESTIONS FOR STUDENT
========================================================= */

router.get(
  "/test/:testId",
  async (req, res) => {
    try {
      const { testId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          testId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid test ID."
        });
      }

      const test = await Test.findById(testId);

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test नहीं मिला।"
        });
      }

      /*
        अगर visible field मौजूद है और false है
        तो public users को test नहीं दिखेगा।
      */

      if (
        test.visible === false &&
        (!req.session ||
          !req.session.user ||
          String(
            req.session.user.role
          ).toLowerCase() !== "admin")
      ) {
        return res.status(403).json({
          success: false,
          message: "Test अभी public नहीं है।"
        });
      }

      const questions =
        await Question.find({
          testId
        })
          .sort({ createdAt: 1 })
          .lean();

      const safeQuestions =
        questions.map((question) => {
          const copy = {
            ...question
          };

          delete copy.answer;
          delete copy.correctAnswer;

          return copy;
        });

      return res.json({
        success: true,

        test: {
          _id: test._id,
          name: test.name,
          title: test.title,
          language: test.language,
          duration: test.duration,
          totalQuestions:
            test.totalQuestions
        },

        questions: safeQuestions
      });
    } catch (error) {
      console.error(
        "Student questions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Questions load नहीं हो सके।"
      });
    }
  }
);

/* =========================================================
   ADD SINGLE QUESTION
========================================================= */

router.post(
  "/",
  adminOnly,
  async (req, res) => {
    try {
      const {
        testId,
        language
      } = req.body;

      if (!testId) {
        return res.status(400).json({
          success: false,
          message: "Test ID required."
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          testId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Test ID."
        });
      }

      const test = await Test.findById(testId);

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test नहीं मिला।"
        });
      }

      const data =
        prepareQuestionData({
          ...req.body,
          testId,
          language
        });

      const errors =
        validateBulkQuestion(
          data,
          language
        );

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors.join(", "),
          errors
        });
      }

      const question =
        await Question.create(data);

      test.totalQuestions =
        await Question.countDocuments({
          testId
        });

      await test.save();

      return res.status(201).json({
        success: true,
        message:
          "Question successfully added.",
        question
      });
    } catch (error) {
      console.error(
        "Add question error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Question add नहीं हुआ।"
      });
    }
  }
);

/* =========================================================
   UPDATE QUESTION
========================================================= */

router.put(
  "/:id",
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid question ID."
        });
      }

      const existing =
        await Question.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Question नहीं मिला।"
        });
      }

      const language =
        req.body.language ||
        existing.language ||
        "hindi";

      const data =
        prepareQuestionData({
          ...existing.toObject(),
          ...req.body,

          testId:
            req.body.testId ||
            existing.testId,

          language
        });

      const errors =
        validateBulkQuestion(
          data,
          language
        );

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors.join(", "),
          errors
        });
      }

      const updated =
        await Question.findByIdAndUpdate(
          id,
          data,
          {
            new: true,
            runValidators: true
          }
        );

      return res.json({
        success: true,
        message:
          "Question successfully updated.",
        question: updated
      });
    } catch (error) {
      console.error(
        "Update question error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Question update नहीं हुआ।"
      });
    }
  }
);

/* =========================================================
   DELETE QUESTION
========================================================= */

router.delete(
  "/:id",
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid question ID."
        });
      }

      const question =
        await Question.findById(id);

      if (!question) {
        return res.status(404).json({
          success: false,
          message: "Question नहीं मिला।"
        });
      }

      const testId = question.testId;

      await Question.findByIdAndDelete(id);

      if (
        testId &&
        mongoose.Types.ObjectId.isValid(
          testId
        )
      ) {
        const test =
          await Test.findById(testId);

        if (test) {
          test.totalQuestions =
            await Question.countDocuments({
              testId
            });

          await test.save();
        }
      }

      return res.json({
        success: true,
        message:
          "Question successfully deleted."
      });
    } catch (error) {
      console.error(
        "Delete question error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Question delete नहीं हुआ।"
      });
    }
  }
);

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

router.use(
  (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message:
            "File size maximum 10 MB हो सकती है।"
        });
      }

      return res.status(400).json({
        success: false,
        message:
          "File upload error: " +
          error.message
      });
    }

    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Upload error."
      });
    }

    next();
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;