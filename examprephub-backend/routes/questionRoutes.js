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
    .trim();

}


/* =====================================================
   QUESTION BLOCKS
===================================================== */

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

    const match = line.match(
      /^\s*(?:QUESTION|Question|question|Q|q)\s*\.?\s*(\d+)\s*[\.\):\-]?\s*(.*)$/i
    );

    if (match) {

      if (current.length && currentNumber !== null) {

        blocks.push({
          number: currentNumber,
          text: current.join("\n").trim()
        });

      }

      currentNumber = Number(match[1]);
      current = [];

      if (match[2]) {
        current.push(match[2].trim());
      }

      continue;
    }

    if (currentNumber !== null) {
      current.push(line);
    }

  }

  if (current.length && currentNumber !== null) {

    blocks.push({
      number: currentNumber,
      text: current.join("\n").trim()
    });

  }

  return blocks;

}


/* =====================================================
   OPTIONS
===================================================== */

function extractOptions(block) {

  const options = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  const optionRegex =
    /(?:^|\s|\n)(?:\(([ABCD])\)|([ABCD])\s*[\.\)])\s*/gi;

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

    value = value.replace(/\s+/g, " ");

    if (options.hasOwnProperty(current.letter)) {

      options[current.letter] = value;

    }

  }

  return options;

}


/* =====================================================
   ANSWER
===================================================== */

function extractAnswer(block) {

  const match = block.match(
    /^\s*(?:Ans|Answer)\s*[:\-]?\s*\(?([ABCD])\)?\s*$/im
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
    /^\s*Explanation\s*:\s*([\s\S]*?)(?=\n\s*(?:QUESTION|Question|question|Q|q)\s*\.?\s*\d+|$)/i
  );

  if (!match) {
    return "";
  }

  return cleanText(match[1]);

}


/* =====================================================
   QUESTION TEXT
===================================================== */

function extractQuestionText(block) {

  let text = block;

  text = text.replace(
    /^\s*(?:Ans|Answer)\s*[:\-]?\s*\(?[ABCD]\)?\s*$/im,
    ""
  );

  text = text.replace(
    /^\s*Explanation\s*:\s*[\s\S]*$/im,
    ""
  );

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
   PARSE QUESTION
===================================================== */

function parseQuestionBlock(block, meta) {

  const text = block.text;

  const options = extractOptions(text);

  const correctAnswer =
    extractAnswer(text);

  const explanation =
    extractExplanation(text);

  const questionText =
    extractQuestionText(text);

  return {

    questionText,

    options,

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
    errors.push("Question text missing");
  }

  for (const letter of ["A", "B", "C", "D"]) {

    if (!question.options[letter]) {
      errors.push(`Option ${letter} missing`);
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

      if (!req.file) {

        return res.status(400).json({

          success: false,

          message:
            "PDF or DOCX file upload nahi hui."

        });

      }

      filePath = req.file.path;

      const {
        language,
        subject,
        chapter,
        testId
      } = req.body;


      const extension =
        path.extname(
          req.file.originalname
        ).toLowerCase();


      let text = "";


      /* ---------- PDF ---------- */

      if (extension === ".pdf") {

        const buffer =
          fs.readFileSync(filePath);

        const data =
          await pdfParse(buffer);

        text = data.text || "";

      }


      /* ---------- DOCX ---------- */

      else if (extension === ".docx") {

        const result =
          await mammoth.extractRawText({
            path: filePath
          });

        text = result.value || "";

      }


      else {

        return res.status(400).json({

          success: false,

          message:
            "Only PDF and DOCX allowed."

        });

      }


      if (!text.trim()) {

        return res.status(400).json({

          success: false,

          message:
            "File se text extract nahi ho paya. PDF scanned image ho sakti hai."

        });

      }


      const blocks =
        splitIntoQuestionBlocks(text);


      if (!blocks.length) {

        return res.status(400).json({

          success: false,

          message:
            "Q1, Q2, Q3... format mein questions nahi mile."

        });

      }


      const examType =
        await getExamType(testId);


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


      const questions =
        blocks.map(block =>
          parseQuestionBlock(
            block,
            meta
          )
        );


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

      if (filePath) {

        try {

          fs.unlinkSync(filePath);

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


      if (!testId) {

        return res.status(400).json({

          success: false,

          message:
            "Test select nahi kiya gaya."

        });

      }


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


      const examType =
        await getExamType(testId);


      const documents = [];


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
              .includes(item.difficulty)
              ? item.difficulty
              : "Medium",

          isSelected: false,

          batches:
            Array.isArray(item.batches)
              ? item.batches
              : [],

          tests: [testId],

          sourcePDF:
            cleanText(
              item.sourcePDF
            ),

          pageNumber:
            Number(item.pageNumber) || 1

        };


        const errors =
          validateQuestion(question);


        if (errors.length) {

          return res.status(400).json({

            success: false,

            message:
              `Invalid question: ${errors.join(", ")}`

          });

        }


        documents.push(question);

      }


      const inserted =
        await Question.insertMany(
          documents
        );


      const totalQuestions =
        await Question.countDocuments();


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