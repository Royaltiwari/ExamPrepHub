const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const multer = require("multer");
const mammoth = require("mammoth");

const Question = require("../models/Question");
const Test = require("../models/Test");

const routerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    const ext = file.originalname.toLowerCase().split(".").pop();

    if (ext === "pdf" || ext === "docx" || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed."));
    }
  }
});


/* =========================================================
   ADMIN MIDDLEWARE
========================================================= */

function adminOnly(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Login required."
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required."
    });
  }

  next();
}


/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}


function normalizeLanguage(language) {
  const value = clean(language).toLowerCase();

  if (
    value === "english" ||
    value === "en"
  ) {
    return "english";
  }

  if (
    value === "bilingual" ||
    value === "both" ||
    value === "bi"
  ) {
    return "bilingual";
  }

  return "hindi";
}


function answerToIndex(answer) {
  const value = clean(answer).toUpperCase();

  if (["A", "1"].includes(value)) return 0;
  if (["B", "2"].includes(value)) return 1;
  if (["C", "3"].includes(value)) return 2;
  if (["D", "4"].includes(value)) return 3;

  return -1;
}


function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map(item => clean(item));
}


function combineQuestion(hindi, english, language) {
  hindi = clean(hindi);
  english = clean(english);

  if (language === "english") {
    return english;
  }

  if (language === "bilingual") {
    return `${hindi}\n\n${english}`;
  }

  return hindi;
}


function combineOptions(hindiOptions, englishOptions, language) {
  if (language === "english") {
    return englishOptions;
  }

  if (language === "bilingual") {
    return hindiOptions.map((hi, index) => {
      return `${hi}\n${englishOptions[index]}`;
    });
  }

  return hindiOptions;
}


function combineExplanation(hindi, english, language) {
  hindi = clean(hindi);
  english = clean(english);

  if (language === "english") {
    return english;
  }

  if (language === "bilingual") {
    return `${hindi}\n\n${english}`;
  }

  return hindi;
}


/* =========================================================
   VALIDATE QUESTION DATA
========================================================= */

function prepareQuestionData(data, language) {

  language = normalizeLanguage(language);

  const subject = clean(data.subject);
  const chapter = clean(data.chapter);

  const questionHindi = clean(data.questionHindi);
  const questionEnglish = clean(data.questionEnglish);

  const optionsHindi = normalizeOptions(data.optionsHindi);
  const optionsEnglish = normalizeOptions(data.optionsEnglish);

  const explanationHindi = clean(data.explanationHindi);
  const explanationEnglish = clean(data.explanationEnglish);

  let correctAnswer = data.correctAnswer;

  if (
    typeof correctAnswer === "string" &&
    !/^\d+$/.test(correctAnswer)
  ) {
    correctAnswer = answerToIndex(correctAnswer);
  } else {
    correctAnswer = Number(correctAnswer);
  }

  if (!subject) {
    throw new Error("Subject is required.");
  }

  if (!chapter) {
    throw new Error("Chapter is required.");
  }


  /* ---------------- HINDI ---------------- */

  if (language === "hindi") {

    if (!questionHindi) {
      throw new Error("Hindi question is required.");
    }

    if (optionsHindi.length !== 4) {
      throw new Error("Hindi question must have exactly 4 options.");
    }

    if (optionsHindi.some(option => !option)) {
      throw new Error("All Hindi options A-D are required.");
    }
  }


  /* ---------------- ENGLISH ---------------- */

  if (language === "english") {

    if (!questionEnglish) {
      throw new Error("English question is required.");
    }

    if (optionsEnglish.length !== 4) {
      throw new Error("English question must have exactly 4 options.");
    }

    if (optionsEnglish.some(option => !option)) {
      throw new Error("All English options A-D are required.");
    }
  }


  /* ---------------- BILINGUAL ---------------- */

  if (language === "bilingual") {

    if (!questionHindi) {
      throw new Error("Hindi question is required for bilingual mode.");
    }

    if (!questionEnglish) {
      throw new Error("English question is required for bilingual mode.");
    }

    if (optionsHindi.length !== 4) {
      throw new Error(
        "Bilingual mode requires exactly 4 Hindi options."
      );
    }

    if (optionsEnglish.length !== 4) {
      throw new Error(
        "Bilingual mode requires exactly 4 English options."
      );
    }

    if (optionsHindi.some(option => !option)) {
      throw new Error("All Hindi options A-D are required.");
    }

    if (optionsEnglish.some(option => !option)) {
      throw new Error("All English options A-D are required.");
    }
  }


  if (
    !Number.isInteger(correctAnswer) ||
    correctAnswer < 0 ||
    correctAnswer > 3
  ) {
    throw new Error(
      "Correct answer must be A, B, C, D or 0, 1, 2, 3."
    );
  }


  const finalOptions = combineOptions(
    optionsHindi,
    optionsEnglish,
    language
  );


  return {
    subject,
    chapter,

    questionHindi,
    questionEnglish,

    optionsHindi,
    optionsEnglish,

    question: combineQuestion(
      questionHindi,
      questionEnglish,
      language
    ),

    options: finalOptions,

    correctAnswer,

    explanationHindi,
    explanationEnglish,

    explanation: combineExplanation(
      explanationHindi,
      explanationEnglish,
      language
    ),

    type: "single"
  };
}


/* =========================================================
   GET QUESTIONS FOR TEST
========================================================= */

router.get("/test/:testId", async (req, res) => {

  try {

    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid test ID."
      });
    }


    const test = await Test.findOne({
      _id: testId,
      visible: true
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found."
      });
    }


    const questions = await Question.find({
      testId
    })
      .select("-correctAnswer -__v")
      .sort({
        createdAt: 1
      });


    res.json({
      success: true,
      questions
    });

  } catch (error) {

    console.error("GET QUESTIONS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load questions."
    });
  }
});


/* =========================================================
   ADMIN GET QUESTIONS
========================================================= */

router.get(
  "/admin/test/:testId",
  adminOnly,
  async (req, res) => {

    try {

      const { testId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(testId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid test ID."
        });
      }


      const questions = await Question.find({
        testId
      })
        .sort({
          createdAt: 1
        });


      res.json({
        success: true,
        questions
      });

    } catch (error) {

      console.error("ADMIN QUESTIONS ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load questions."
      });
    }
  }
);


/* =========================================================
   MANUAL ADD QUESTION
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


      if (!mongoose.Types.ObjectId.isValid(testId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid test ID."
        });
      }


      const test = await Test.findById(testId);

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test not found."
        });
      }


      let selectedLanguage = normalizeLanguage(language);


      /*
        Backward compatibility:
        Agar old HTML language nahi bhej raha,
        to automatically detect language.
      */

      if (!language) {

        const hiQuestion = clean(req.body.questionHindi);
        const enQuestion = clean(req.body.questionEnglish);

        if (hiQuestion && enQuestion) {
          selectedLanguage = "bilingual";
        } else if (enQuestion) {
          selectedLanguage = "english";
        } else {
          selectedLanguage = "hindi";
        }
      }


      const prepared = prepareQuestionData(
        req.body,
        selectedLanguage
      );


      const question = await Question.create({

        testId,

        ...prepared
      });


      await Test.findByIdAndUpdate(
        testId,
        {
          $set: {
            totalQuestions: await Question.countDocuments({
              testId
            })
          }
        }
      );


      res.status(201).json({
        success: true,
        message: "Question added successfully.",
        question
      });

    } catch (error) {

      console.error("ADD QUESTION ERROR:", error);

      res.status(400).json({
        success: false,
        message: error.message || "Failed to add question."
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

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid question ID."
        });
      }


      const existing = await Question.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Question not found."
        });
      }


      let selectedLanguage = normalizeLanguage(
        req.body.language
      );


      if (!req.body.language) {

        const hiQuestion = clean(req.body.questionHindi);
        const enQuestion = clean(req.body.questionEnglish);

        if (hiQuestion && enQuestion) {
          selectedLanguage = "bilingual";
        } else if (enQuestion) {
          selectedLanguage = "english";
        } else {
          selectedLanguage = "hindi";
        }
      }


      const prepared = prepareQuestionData(
        req.body,
        selectedLanguage
      );


      const updated = await Question.findByIdAndUpdate(
        id,
        {
          ...prepared
        },
        {
          new: true,
          runValidators: true
        }
      );


      const count = await Question.countDocuments({
        testId: updated.testId
      });


      await Test.findByIdAndUpdate(
        updated.testId,
        {
          $set: {
            totalQuestions: count
          }
        }
      );


      res.json({
        success: true,
        message: "Question updated successfully.",
        question: updated
      });

    } catch (error) {

      console.error("UPDATE QUESTION ERROR:", error);

      res.status(400).json({
        success: false,
        message: error.message || "Failed to update question."
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

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid question ID."
        });
      }


      const question = await Question.findById(id);

      if (!question) {
        return res.status(404).json({
          success: false,
          message: "Question not found."
        });
      }


      const testId = question.testId;


      await Question.findByIdAndDelete(id);


      const count = await Question.countDocuments({
        testId
      });


      await Test.findByIdAndUpdate(
        testId,
        {
          $set: {
            totalQuestions: count
          }
        }
      );


      res.json({
        success: true,
        message: "Question deleted successfully.",
        totalQuestions: count
      });

    } catch (error) {

      console.error("DELETE QUESTION ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete question."
      });
    }
  }
);


/* =========================================================
   PDF TEXT EXTRACTION
========================================================= */

async function extractPdfText(buffer) {

  try {

    const pdfModule = require("pdf-parse");


    /*
      Older pdf-parse versions:
      pdfParse(buffer)
    */

    if (typeof pdfModule === "function") {

      const result = await pdfModule(buffer);

      return result.text || "";
    }


    /*
      Newer pdf-parse versions
    */

    if (
      pdfModule &&
      typeof pdfModule.PDFParse === "function"
    ) {

      const parser = new pdfModule.PDFParse({
        data: buffer
      });

      const result = await parser.getText();

      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }

      return result.text || "";
    }


    throw new Error(
      "PDF parser API was not recognized."
    );

  } catch (error) {

    console.error("PDF PARSER ERROR:", error);

    throw new Error(
      "PDF read nahi ho pa raha. Please PDF file check karein."
    );
  }
}


/* =========================================================
   DOCX TEXT EXTRACTION
========================================================= */

async function extractDocxText(buffer) {

  try {

    const result =
      await mammoth.extractRawText({
        buffer
      });

    return result.value || "";

  } catch (error) {

    console.error("DOCX PARSER ERROR:", error);

    throw new Error(
      "Word file read nahi ho pa rahi. Please DOCX file check karein."
    );
  }
}


/* =========================================================
   FIELD EXTRACTOR
========================================================= */

function getField(text, label, nextLabels) {

  const escapedLabel =
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


  let lookAhead = "";

  if (nextLabels && nextLabels.length) {

    const escapedNext =
      nextLabels.map(
        item =>
          item.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )
      );

    lookAhead =
      `(?=\\n\\s*(?:${escapedNext.join("|")})\\s*:|$)`;
  } else {
    lookAhead = "$";
  }


  const regex = new RegExp(
    `${escapedLabel}\\s*:\\s*([\\s\\S]*?)${lookAhead}`,
    "i"
  );


  const match = text.match(regex);

  if (!match) {
    return "";
  }


  return clean(match[1]);
}


/* =========================================================
   PARSE OPTIONS
========================================================= */

function getOption(text, language, letter) {

  const label =
    `${language} Option ${letter}`;

  const regex = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:` +
    `${language} Option [ABCD]\\s*:|Answer\\s*:|` +
    `Hindi Explanation\\s*:|English Explanation\\s*:|$)`,
    "i"
  );


  const match = text.match(regex);

  return match ? clean(match[1]) : "";
}


/* =========================================================
   PARSE ONE QUESTION
========================================================= */

function parseOneQuestion(block, number) {

  const subject =
    getField(
      block,
      "Subject",
      [
        "Chapter",
        "Hindi Question",
        "English Question",
        "Answer"
      ]
    );


  const chapter =
    getField(
      block,
      "Chapter",
      [
        "Hindi Question",
        "English Question",
        "Answer"
      ]
    );


  const questionHindi =
    getField(
      block,
      "Hindi Question",
      [
        "English Question",
        "Hindi Option A",
        "English Option A",
        "Answer",
        "Hindi Explanation"
      ]
    );


  const questionEnglish =
    getField(
      block,
      "English Question",
      [
        "Hindi Option A",
        "English Option A",
        "Answer",
        "Hindi Explanation"
      ]
    );


  const optionsHindi = [
    getOption(block, "Hindi", "A"),
    getOption(block, "Hindi", "B"),
    getOption(block, "Hindi", "C"),
    getOption(block, "Hindi", "D")
  ];


  const optionsEnglish = [
    getOption(block, "English", "A"),
    getOption(block, "English", "B"),
    getOption(block, "English", "C"),
    getOption(block, "English", "D")
  ];


  const answer =
    getField(
      block,
      "Answer",
      [
        "Hindi Explanation",
        "English Explanation"
      ]
    );


  const explanationHindi =
    getField(
      block,
      "Hindi Explanation",
      [
        "English Explanation"
      ]
    );


  const explanationEnglish =
    getField(
      block,
      "English Explanation",
      []
    );


  return {

    number,

    subject,
    chapter,

    questionHindi,
    questionEnglish,

    optionsHindi,
    optionsEnglish,

    answer,

    explanationHindi,
    explanationEnglish
  };
}


/* =========================================================
   PARSE COMPLETE FILE
========================================================= */

function parseQuestionsFromText(text) {

  text = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");


  /*
    QUESTION 1
    QUESTION 2

    or

    Q1
    Q2

    or

    Q.1
  */

  const matches = [
    ...text.matchAll(
      /^\s*(?:QUESTION|Q)\s*\.?\s*(\d+)\s*:?\s*$/gim
    )
  ];


  if (!matches.length) {

    throw new Error(
      "Question numbers nahi mile. File format check karein."
    );
  }


  const questions = [];


  for (let i = 0; i < matches.length; i++) {

    const start =
      matches[i].index + matches[i][0].length;

    const end =
      i + 1 < matches.length
        ? matches[i + 1].index
        : text.length;


    const block =
      text.slice(start, end).trim();


    if (!block) {
      continue;
    }


    const question =
      parseOneQuestion(
        block,
        Number(matches[i][1])
      );


    questions.push(question);
  }


  return questions;
}


/* =========================================================
   VALIDATE PARSED QUESTIONS
========================================================= */

function validateBulkQuestions(
  questions,
  language,
  defaultSubject,
  defaultChapter
) {

  language = normalizeLanguage(language);


  if (!Array.isArray(questions)) {
    throw new Error("Questions data invalid.");
  }


  if (!questions.length) {
    throw new Error("No questions found.");
  }


  const validated = [];


  for (let i = 0; i < questions.length; i++) {

    const item = questions[i] || {};


    const data = {

      subject:
        clean(item.subject) ||
        clean(defaultSubject),

      chapter:
        clean(item.chapter) ||
        clean(defaultChapter),

      questionHindi:
        clean(item.questionHindi),

      questionEnglish:
        clean(item.questionEnglish),

      optionsHindi:
        normalizeOptions(item.optionsHindi),

      optionsEnglish:
        normalizeOptions(item.optionsEnglish),

      correctAnswer:
        item.answer !== undefined
          ? item.answer
          : item.correctAnswer,

      explanationHindi:
        clean(item.explanationHindi),

      explanationEnglish:
        clean(item.explanationEnglish)
    };


    try {

      const prepared =
        prepareQuestionData(
          data,
          language
        );


      validated.push({
        ...prepared
      });

    } catch (error) {

      throw new Error(
        `Question ${i + 1}: ${error.message}`
      );
    }
  }


  return validated;
}


/* =========================================================
   BULK PREVIEW
========================================================= */

router.post(
  "/bulk/preview",
  adminOnly,
  routerUpload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          success: false,
          message: "Please upload a PDF or DOCX file."
        });
      }


      const language =
        normalizeLanguage(
          req.body.language
        );


      let text = "";

      const filename =
        req.file.originalname.toLowerCase();


      if (filename.endsWith(".docx")) {

        text =
          await extractDocxText(
            req.file.buffer
          );

      } else if (filename.endsWith(".pdf")) {

        text =
          await extractPdfText(
            req.file.buffer
          );

      } else {

        return res.status(400).json({
          success: false,
          message: "Only PDF and DOCX files are supported."
        });
      }


      if (!text.trim()) {

        return res.status(400).json({
          success: false,
          message: "File se text read nahi hua."
        });
      }


      const parsed =
        parseQuestionsFromText(text);


      const questions =
        validateBulkQuestions(
          parsed,
          language,
          req.body.subject,
          req.body.chapter
        );


      res.json({

        success: true,

        message:
          `${questions.length} questions successfully parsed.`,

        language,

        count: questions.length,

        questions
      });

    } catch (error) {

      console.error(
        "BULK PREVIEW ERROR:",
        error
      );

      res.status(400).json({
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


      if (!mongoose.Types.ObjectId.isValid(testId)) {

        return res.status(400).json({
          success: false,
          message: "Invalid test ID."
        });
      }


      const test =
        await Test.findById(testId);


      if (!test) {

        return res.status(404).json({
          success: false,
          message: "Test not found."
        });
      }


      const selectedLanguage =
        normalizeLanguage(language);


      const validated =
        validateBulkQuestions(
          questions,
          selectedLanguage,
          "",
          ""
        );


      if (!validated.length) {

        return res.status(400).json({
          success: false,
          message: "No valid questions to import."
        });
      }


      const documents =
        validated.map(item => ({
          testId,
          ...item
        }));


      /*
        insertMany:
        Saare questions database me ek saath save honge.
      */

      const inserted =
        await Question.insertMany(
          documents,
          {
            ordered: true
          }
        );


      const totalQuestions =
        await Question.countDocuments({
          testId
        });


      await Test.findByIdAndUpdate(
        testId,
        {
          $set: {
            totalQuestions
          }
        }
      );


      res.status(201).json({

        success: true,

        message:
          `${inserted.length} questions imported successfully.`,

        imported:
          inserted.length,

        totalQuestions
      });

    } catch (error) {

      console.error(
        "BULK IMPORT ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error.message ||
          "Bulk import failed."
      });
    }
  }
);


/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

router.use(
  (error, req, res, next) => {

    if (
      error instanceof multer.MulterError
    ) {

      if (error.code === "LIMIT_FILE_SIZE") {

        return res.status(400).json({
          success: false,
          message:
            "File size maximum 10 MB ho sakta hai."
        });
      }


      return res.status(400).json({
        success: false,
        message: error.message
      });
    }


    if (
      error &&
      error.message &&
      error.message.includes(
        "Only PDF and DOCX"
      )
    ) {

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }


    next(error);
  }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;