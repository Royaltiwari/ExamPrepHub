const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const Question = require("../models/Question");
const Test = require("../models/Test");
const questionController = require("../controllers/questionController");

const router = express.Router();

/* =====================================================
   MULTER
===================================================== */

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    if (ext === ".pdf" || ext === ".docx") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed."));
    }
  }
});


/* =====================================================
   CLEAN TEXT
===================================================== */

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}


/* =====================================================
   NORMALIZE EXTRACTED FILE TEXT
===================================================== */

function normalizeFileText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


/* =====================================================
   QUESTION BLOCKS

   Supports:

   Q1.
   Q1)
   Q1:
   Q1-
   Question 1
   QUESTION 1
===================================================== */

function splitIntoQuestionBlocks(text) {

  const normalized = normalizeFileText(text);

  const questionRegex =
    /(?:^|\n|\s)(?:QUESTION|Q)\s*\.?\s*(\d+)\s*[\.\):\-]?\s*/gi;

  const matches = [];

  let match;

  while ((match = questionRegex.exec(normalized)) !== null) {

    matches.push({
      number: Number(match[1]),
      start: match.index + match[0].length
    });

  }

  const blocks = [];

  for (let i = 0; i < matches.length; i++) {

    const current = matches[i];
    const next = matches[i + 1];

    const end = next
      ? next.start
      : normalized.length;

    const blockText = normalized
      .substring(current.start, end)
      .trim();

    if (blockText) {

      blocks.push({
        number: current.number,
        text: blockText
      });

    }

  }

  return blocks;
}


/* =====================================================
   OPTIONS

   Supports:

   (A) Option
   A. Option
   A) Option

   Also works when PDF puts each option
   on separate lines.
===================================================== */

function extractOptions(block) {

  const options = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  const optionRegex =
    /(?:^|\n|\s)(?:\(([ABCD])\)|([ABCD])\s*[\.\)])\s*/gi;

  const matches = [];

  let match;

  while ((match = optionRegex.exec(block)) !== null) {

    const letter =
      (match[1] || match[2]).toUpperCase();

    matches.push({
      letter,
      start: match.index + match[0].length
    });

  }

  for (let i = 0; i < matches.length; i++) {

    const current = matches[i];
    const next = matches[i + 1];

    const end = next
      ? next.start
      : block.length;

    let value = block
      .substring(current.start, end)
      .trim();

    value = value
      .replace(/\s+/g, " ")
      .trim();

    if (Object.prototype.hasOwnProperty.call(options, current.letter)) {

      options[current.letter] = value;

    }

  }

  return options;
}


/* =====================================================
   ANSWER

   Supports:

   Ans: A
   Ans A
   Answer: A
   Answer A
===================================================== */

function extractAnswer(block) {

  const match = block.match(
    /(?:^|\n)\s*(?:Ans|Answer)\s*[:\-]?\s*\(?([ABCD])\)?\s*(?=\n|$)/i
  );

  if (!match) {
    return "";
  }

  return match[1].toUpperCase();
}


/* =====================================================
   EXPLANATION
===================================================== */

function extractExplanation(block) {

  const match = block.match(
    /(?:^|\n)\s*Explanation\s*:\s*([\s\S]*?)(?=\n\s*(?:Q|Question)\s*\.?\s*\d+\s*[\.\):\-]?|$)/i
  );

  if (!match) {
    return "";
  }

  return cleanText(match[1]);
}


/* =====================================================
   QUESTION TEXT

   Everything before first option is question text.
===================================================== */

function extractQuestionText(block) {

  let text = String(block || "");

  /* Remove answer section */

  text = text.replace(
    /(?:^|\n)\s*(?:Ans|Answer)\s*[:\-]?\s*\(?[ABCD]\)?\s*[\s\S]*$/i,
    ""
  );

  /* Remove explanation section */

  text = text.replace(
    /(?:^|\n)\s*Explanation\s*:\s*[\s\S]*$/i,
    ""
  );

  /* Find first option */

  const optionMatch = text.match(
    /(?:^|\n|\s)(?:\([ABCD]\)|[ABCD]\s*[\.\)])\s*/i
  );

  if (optionMatch) {

    text = text.substring(
      0,
      optionMatch.index
    );

  }

  return cleanText(text);
}


/* =====================================================
   PARSE QUESTION BLOCK
===================================================== */

function parseQuestionBlock(block, meta) {

  const text = block.text;

  const options =
    extractOptions(text);

  const correctAnswer =
    extractAnswer(text);

  const explanation =
    extractExplanation(text);

  const questionText =
    extractQuestionText(text);

  return {

    questionText,

    options: {
      A: cleanText(options.A),
      B: cleanText(options.B),
      C: cleanText(options.C),
      D: cleanText(options.D)
    },

    correctAnswer,

    explanation,

    subject:
      meta.subject || "General",

    topic:
      meta.chapter || "General",

    examType:
      meta.examType || "General",

    difficulty: "Medium",

    isSelected: false,

    batches: [],

    tests: [],

    sourcePDF:
      meta.fileName || "",

    pageNumber: 1

  };
}


/* =====================================================
   GET EXAM TYPE
===================================================== */

async function getExamType(testId) {

  if (!testId) {
    return "General";
  }

  try {

    const test =
      await Test.findById(testId).lean();

    if (!test) {
      return "General";
    }

    return (
      test.examType ||
      test.exam ||
      test.examName ||
      "General"
    );

  } catch (error) {

    console.log(
      "ExamType lookup skipped:",
      error.message
    );

    return "General";

  }
}


/* =====================================================
   VALIDATE QUESTION
===================================================== */

function validateQuestion(question) {

  const errors = [];

  if (!question.questionText) {

    errors.push(
      "Question text missing"
    );

  }

  for (const letter of ["A", "B", "C", "D"]) {

    if (
      !question.options ||
      !question.options[letter] ||
      !question.options[letter].trim()
    ) {

      errors.push(
        `Option ${letter} missing`
      );

    }

  }

  if (
    !["A", "B", "C", "D"]
      .includes(question.correctAnswer)
  ) {

    errors.push(
      "Correct answer missing/invalid"
    );

  }

  return errors;
}


/* =====================================================
   BULK PREVIEW
===================================================== */

router.post(
  "/bulk/preview",
  upload.single("pdfFile"),
  async (req, res) => {

    let filePath = null;

    try {

      /* ---------- FILE CHECK ---------- */

      if (!req.file) {

        return res.status(400).json({

          success: false,

          message:
            "PDF or DOCX file upload nahi hui."

        });

      }

      filePath = req.file.path;


      /* ---------- FORM DATA ---------- */

      const {
        language,
        subject,
        chapter,
        testId
      } = req.body;


      /* ---------- EXTENSION ---------- */

      const extension =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();


      let text = "";


      /* =================================================
         PDF
      ================================================= */

      if (extension === ".pdf") {

        const buffer =
          fs.readFileSync(filePath);

        const data =
          await pdfParse(buffer);

        text =
          data.text || "";

      }


      /* =================================================
         DOCX / WORD
      ================================================= */

      else if (extension === ".docx") {

        const result =
          await mammoth.extractRawText({
            path: filePath
          });

        text =
          result.value || "";

      }


      /* =================================================
         OTHER FILE
      ================================================= */

      else {

        return res.status(400).json({

          success: false,

          message:
            "Only PDF and DOCX files allowed."

        });

      }


      /* =================================================
         TEXT CHECK
      ================================================= */

      text =
        normalizeFileText(text);


      if (!text) {

        return res.status(400).json({

          success: false,

          message:
            "File se text extract nahi ho paya. PDF scanned image ho sakti hai."

        });

      }


      /* =================================================
         SPLIT QUESTIONS
      ================================================= */

      const blocks =
        splitIntoQuestionBlocks(text);


      if (!blocks.length) {

        return res.status(400).json({

          success: false,

          message:
            "Q1, Q2, Q3... format mein questions nahi mile."

        });

      }


      /* =================================================
         EXAM TYPE
      ================================================= */

      const examType =
        await getExamType(testId);


      /* =================================================
         META
      ================================================= */

      const meta = {

        language:
          language || "hindi",

        subject:
          subject || "General",

        chapter:
          chapter || "General",

        examType,

        fileName:
          req.file.originalname

      };


      /* =================================================
         PARSE ALL QUESTIONS
      ================================================= */

      const questions =
        blocks.map(block =>
          parseQuestionBlock(
            block,
            meta
          )
        );


      /* =================================================
         VALID / INVALID
      ================================================= */

      const validQuestions = [];
      const invalidQuestions = [];


      questions.forEach(
        (question, index) => {

          const errors =
            validateQuestion(question);


          if (errors.length) {

            invalidQuestions.push({

              questionNumber:
                blocks[index].number,

              errors,

              question

            });

          } else {

            validQuestions.push(question);

          }

        }
      );


      /* =================================================
         RESPONSE
      ================================================= */

      res.json({

        success: true,

        message:
          `${validQuestions.length} questions parsed successfully.`,

        language:
          language || "hindi",

        totalQuestions:
          validQuestions.length,

        invalidQuestions,

        questions:
          validQuestions

      });


    } catch (error) {

      console.error(
        "Bulk Preview Error:",
        error
      );


      res.status(500).json({

        success: false,

        message:
          error.message ||
          "Question preview failed."

      });


    } finally {

      /* =================================================
         DELETE TEMP FILE
      ================================================= */

      if (filePath) {

        try {

          fs.unlinkSync(
            filePath
          );

        } catch (e) {}

      }

    }

  }
);


/* =====================================================
   BULK IMPORT
===================================================== */

router.post(
  "/bulk/import",
  async (req, res) => {

    try {

      const {
        testId,
        language,
        subject,
        chapter,
        questions
      } = req.body;


      /* =================================================
         TEST CHECK
      ================================================= */

      if (!testId) {

        return res.status(400).json({

          success: false,

          message:
            "Test select nahi kiya gaya."

        });

      }


      /* =================================================
         QUESTIONS CHECK
      ================================================= */

      if (
        !Array.isArray(questions) ||
        questions.length === 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Import karne ke liye questions nahi mile."

        });

      }


      /* =================================================
         EXAM TYPE
      ================================================= */

      const examType =
        await getExamType(testId);


      const documents = [];


      /* =================================================
         PREPARE DOCUMENTS
      ================================================= */

      for (const item of questions) {

        const question = {

          questionText:
            cleanText(
              item.questionText
            ),


          options: {

            A:
              cleanText(
                item.options?.A
              ),

            B:
              cleanText(
                item.options?.B
              ),

            C:
              cleanText(
                item.options?.C
              ),

            D:
              cleanText(
                item.options?.D
              )

          },


          correctAnswer:
            String(
              item.correctAnswer || ""
            ).toUpperCase(),


          explanation:
            cleanText(
              item.explanation
            ),


          subject:
            cleanText(
              item.subject || subject
            ) || "General",


          topic:
            cleanText(
              item.topic || chapter
            ) || "General",


          examType:
            cleanText(
              item.examType
            ) || examType,


          difficulty:
            ["Easy", "Medium", "Hard"]
              .includes(
                item.difficulty
              )
              ? item.difficulty
              : "Medium",


          isSelected: false,


          batches:
            Array.isArray(
              item.batches
            )
              ? item.batches
              : [],


          tests: [testId],


          sourcePDF:
            cleanText(
              item.sourcePDF
            ),


          pageNumber:
            Number(
              item.pageNumber
            ) || 1

        };


        /* =================================================
           VALIDATE
        ================================================= */

        const errors =
          validateQuestion(
            question
          );


        if (errors.length) {

          return res.status(400).json({

            success: false,

            message:
              `Invalid question: ${errors.join(", ")}`

          });

        }


        documents.push(
          question
        );

      }


      /* =================================================
         INSERT MONGODB
      ================================================= */

      const inserted =
        await Question.insertMany(
          documents
        );


      /* =================================================
         TOTAL
      ================================================= */

      const totalQuestions =
        await Question.countDocuments();


      /* =================================================
         RESPONSE
      ================================================= */

      res.status(201).json({

        success: true,

        message:
          `${inserted.length} questions successfully MongoDB me import ho gaye.`,

        imported:
          inserted.length,

        totalQuestions,

        questions:
          inserted

      });


    } catch (error) {

      console.error(
        "Bulk Import Error:",
        error
      );


      res.status(500).json({

        success: false,

        message:
          error.message ||
          "Question import failed."

      });

    }

  }
);


/* =====================================================
   EXISTING QUESTION CONTROLLER ROUTES
===================================================== */

router.post(
  "/save-selected",
  questionController.saveSelectedQuestions
);


router.get(
  "/",
  questionController.getQuestions
);


router.get(
  "/:id",
  questionController.getQuestionById
);


router.put(
  "/:id",
  questionController.updateQuestion
);


router.delete(
  "/:id",
  questionController.deleteQuestion
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = router;