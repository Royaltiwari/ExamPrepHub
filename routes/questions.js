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
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"
    ];

    const fileName = String(
      file.originalname || ""
    ).toLowerCase();

    const allowedExtension =
      fileName.endsWith(".pdf") ||
      fileName.endsWith(".docx") ||
      fileName.endsWith(".doc");

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtension
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, DOC or DOCX files are allowed."
        )
      );
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
// CLEAN TEXT
// ======================================================

function clean(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ======================================================
// NORMALIZE TEXT
// ======================================================

function normalizeText(text) {
  return clean(text)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ======================================================
// LANGUAGE
// ======================================================

function normalizeLanguage(language) {
  const value = String(language || "bilingual")
    .trim()
    .toLowerCase();

  if (value === "hindi") {
    return "hindi";
  }

  if (value === "english") {
    return "english";
  }

  return "bilingual";
}

// ======================================================
// QUESTION HEADING
//
// Supports:
//
// QUESTION 1
// QUESTION 10
// QUESTION 1:
// QUESTION 1.
// QUESTION 1)
// QUESTION 1 -
// Q1
// Q.1
// ======================================================

function isQuestionHeading(line) {
  return /^\s*(?:QUESTION|Q)\s*\.?\s*\d+\s*[\.\):\-]?\s*$/i.test(
    clean(line)
  );
}

// ======================================================
// QUESTION NUMBER
// ======================================================

function getQuestionNumber(line) {
  const match = clean(line).match(
    /^\s*(?:QUESTION|Q)\s*\.?\s*(\d+)\s*[\.\):\-]?\s*$/i
  );

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

// ======================================================
// SPLIT DOCUMENT INTO QUESTION BLOCKS
//
// IMPORTANT:
// This works with line-based Word/PDF extraction.
// ======================================================

function splitIntoQuestionBlocks(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");

  const lines = normalized
    .split("\n")
    .map(line => line.trim());

  const blocks = [];

  let currentNumber = null;
  let currentLines = [];

  function saveCurrent() {
    if (
      currentNumber !== null &&
      currentLines.length
    ) {
      const blockText = currentLines
        .join("\n")
        .trim();

      if (blockText) {
        blocks.push({
          number: currentNumber,
          text: blockText
        });
      }
    }
  }

  for (const line of lines) {
    if (!line) {
      if (currentNumber !== null) {
        currentLines.push("");
      }

      continue;
    }

    const number = getQuestionNumber(line);

    if (number !== null) {
      saveCurrent();

      currentNumber = number;
      currentLines = [];

      continue;
    }

    /*
      Also support:
      1.
      2.
      3.
      10.
    */

    const numericHeading = line.match(
      /^(\d+)\s*[\.\)]\s*$/
    );

    if (numericHeading) {
      saveCurrent();

      currentNumber = Number(
        numericHeading[1]
      );

      currentLines = [];

      continue;
    }

    if (currentNumber !== null) {
      currentLines.push(line);
    }
  }

  saveCurrent();

  /*
    FALLBACK:
    Sometimes PDF extraction removes line breaks
    and gives:

    QUESTION 1 Subject: ...
    QUESTION 2 Subject: ...

    So if normal parsing found zero blocks,
    use regex based splitting.
  */

  if (blocks.length === 0) {
    return splitQuestionBlocksFallback(normalized);
  }

  return blocks;
}

// ======================================================
// FALLBACK QUESTION BLOCK SPLITTER
// ======================================================

function splitQuestionBlocksFallback(text) {
  const source = String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ");

  const regex =
    /(?:^|\s)(QUESTION|Q)\s*\.?\s*(\d+)\s*[\.\):\-]?\s*/gi;

  const matches = [];

  let match;

  while (
    (match = regex.exec(source)) !== null
  ) {
    matches.push({
      number: Number(match[2]),
      start: regex.lastIndex
    });
  }

  const blocks = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];

    const next =
      matches[i + 1];

    const end = next
      ? next.start -
        (
          next.start -
          source.lastIndexOf(
            "\n",
            next.start - 1
          )
        )
      : source.length;

    let blockText = source
      .substring(
        current.start,
        end
      )
      .trim();

    /*
      Extra safety:
      remove accidental QUESTION heading
      from the end of previous block.
    */

    blockText = blockText
      .replace(
        /\s+(?:QUESTION|Q)\s*\.?\s*\d+\s*[\.\):\-]?\s*$/i,
        ""
      )
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

// ======================================================
// FIELD EXTRACTION
//
// Exact fields:
//
// Hindi Question:
// English Question:
// Hindi Explanation:
// English Explanation:
// ======================================================

function extractField(block, fieldName) {
  const escaped =
    fieldName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const regex = new RegExp(
    "^\\s*" +
      escaped +
      "\\s*:\\s*(.*)$",
    "im"
  );

  const match = block.match(regex);

  if (!match) {
    return "";
  }

  const start =
    match.index + match[0].length;

  const remaining =
    block.slice(start);

  /*
    IMPORTANT:
    Options are included here as stop points.
    This fixes the old parser problem.
  */

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
    /^Chapter\s*:/im,

    /^(?:QUESTION|Q)\s*\.?\s*\d+\s*[\.\):\-]?\s*$/im
  ];

  let end =
    remaining.length;

  for (
    const pattern of stopPatterns
  ) {
    const found =
      remaining.search(pattern);

    if (
      found !== -1 &&
      found < end
    ) {
      end = found;
    }
  }

  const value =
    match[1] +
    " " +
    remaining.slice(
      0,
      end
    );

  return clean(value);
}

// ======================================================
// SUBJECT
// ======================================================

function extractSubject(block) {
  return extractField(
    block,
    "Subject"
  );
}

// ======================================================
// CHAPTER
// ======================================================

function extractChapter(block) {
  return extractField(
    block,
    "Chapter"
  );
}

// ======================================================
// ANSWER
//
// Supports:
// Answer: A
// Answer: B
// Answer: C
// Answer: D
// Answer: 1
// Answer: 2
// Answer: 3
// Answer: 4
// ======================================================

function extractAnswer(block) {
  const match =
    block.match(
      /^\s*Answer\s*:\s*([A-Da-d1-4])\s*$/im
    );

  if (!match) {
    return "";
  }

  const value =
    match[1]
      .trim()
      .toUpperCase();

  if (
    ["A", "B", "C", "D"].includes(value)
  ) {
    return value;
  }

  const numericMap = {
    "1": "A",
    "2": "B",
    "3": "C",
    "4": "D"
  };

  return numericMap[value] || "";
}

// ======================================================
// EXPLICIT HINDI OPTIONS
//
// Hindi Option A:
// Hindi Option B:
// Hindi Option C:
// Hindi Option D:
// ======================================================

function extractExplicitOptions(
  block,
  language
) {
  const options = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  const prefix =
    language === "hindi"
      ? "Hindi Option"
      : "English Option";

  for (
    const letter of ["A", "B", "C", "D"]
  ) {
    const escapedPrefix =
      prefix.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const regex =
      new RegExp(
        "^\\s*" +
          escapedPrefix +
          "\\s+" +
          letter +
          "\\s*:\\s*(.*)$",
        "im"
      );

    const match =
      block.match(regex);

    if (!match) {
      continue;
    }

    const start =
      match.index +
      match[0].length;

    const remaining =
      block.slice(start);

    const stopPatterns = [
      new RegExp(
        "^\\s*" +
          escapedPrefix +
          "\\s+[ABCD]\\s*:",
        "im"
      ),

      /^Hindi Option\s+[ABCD]\s*:/im,
      /^English Option\s+[ABCD]\s*:/im,

      /^Answer\s*:/im,

      /^Hindi Explanation\s*:/im,
      /^English Explanation\s*:/im,

      /^Subject\s*:/im,
      /^Chapter\s*:/im
    ];

    let end =
      remaining.length;

    for (
      const pattern of stopPatterns
    ) {
      const found =
        remaining.search(pattern);

      if (
        found !== -1 &&
        found < end
      ) {
        end = found;
      }
    }

    options[letter] =
      clean(
        match[1] +
        " " +
        remaining.slice(
          0,
          end
        )
      );
  }

  return options;
}

// ======================================================
// GENERIC OPTIONS
//
// Supports:
//
// A. text
// B. text
// C. text
// D. text
//
// A) text
// B) text
// C) text
// D) text
//
// Also works when options are in one paragraph.
// ======================================================

function extractGenericOptions(
  block
) {
  const options = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  const regex =
    /(?:^|\n|\s)([ABCD])\s*[\.\)]\s+/gi;

  const matches = [];

  let match;

  while (
    (match = regex.exec(block)) !== null
  ) {
    matches.push({
      letter:
        match[1].toUpperCase(),

      contentStart:
        regex.lastIndex,

      markerStart:
        match.index
    });
  }

  if (!matches.length) {
    return options;
  }

  for (
    let i = 0;
    i < matches.length;
    i++
  ) {
    const current =
      matches[i];

    const next =
      matches[i + 1];

    let end =
      next
        ? next.markerStart
        : block.length;

    let value =
      block.slice(
        current.contentStart,
        end
      );

    /*
      Remove metadata if it became part
      of option D.
    */

    value =
      value.replace(
        /\s*(?:Answer|Hindi Explanation|English Explanation)\s*:.*$/is,
        ""
      );

    value =
      clean(value);

    /*
      Only keep first occurrence of A-D.
    */

    if (
      !options[current.letter]
    ) {
      options[current.letter] =
        value;
    }
  }

  return options;
}

// ======================================================
// BILINGUAL OPTION SPLITTER
//
// Example:
//
// नई दिल्ली / New Delhi
//
// => Hindi: नई दिल्ली
// => English: New Delhi
// ======================================================

function splitBilingualOption(
  value
) {
  const text =
    clean(value);

  if (!text) {
    return {
      hindi: "",
      english: ""
    };
  }

  const parts =
    text.split(
      /\s*\/\s*/
    );

  if (parts.length >= 2) {
    return {
      hindi:
        clean(parts[0]),

      english:
        clean(
          parts
            .slice(1)
            .join(" / ")
        )
    };
  }

  return {
    hindi: text,
    english: text
  };
}

// ======================================================
// PARSE OPTIONS
// ======================================================

function parseOptions(block) {
  const hindiExplicit =
    extractExplicitOptions(
      block,
      "hindi"
    );

  const englishExplicit =
    extractExplicitOptions(
      block,
      "english"
    );

  const generic =
    extractGenericOptions(block);

  const hindi = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  const english = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  for (
    const letter of
      ["A", "B", "C", "D"]
  ) {
    /*
      First preference:
      explicit Hindi / English fields
    */

    hindi[letter] =
      hindiExplicit[letter] ||
      "";

    english[letter] =
      englishExplicit[letter] ||
      "";

    /*
      If explicit options don't exist,
      use generic A/B/C/D.
    */

    if (
      !hindi[letter] &&
      !english[letter] &&
      generic[letter]
    ) {
      const split =
        splitBilingualOption(
          generic[letter]
        );

      hindi[letter] =
        split.hindi;

      english[letter] =
        split.english;
    }
  }

  /*
    If only Hindi options exist,
    use Hindi text as fallback for combined
    English option field.

    If only English options exist,
    use English text as fallback for combined
    Hindi option field.

    This is useful for Hindi-only / English-only
    imports.
  */

  for (
    const letter of
      ["A", "B", "C", "D"]
  ) {
    if (
      !hindi[letter] &&
      english[letter]
    ) {
      hindi[letter] =
        english[letter];
    }

    if (
      !english[letter] &&
      hindi[letter]
    ) {
      english[letter] =
        hindi[letter];
    }
  }

  return {
    hindi,
    english
  };
}

// ======================================================
// PARSE QUESTION BLOCK
// ======================================================

function parseQuestionBlock(
  block,
  number
) {
  const hindiQuestion =
    extractField(
      block,
      "Hindi Question"
    );

  const englishQuestion =
    extractField(
      block,
      "English Question"
    );

  const hindiExplanation =
    extractField(
      block,
      "Hindi Explanation"
    );

  const englishExplanation =
    extractField(
      block,
      "English Explanation"
    );

  const subject =
    extractSubject(block);

  const chapter =
    extractChapter(block);

  const answer =
    extractAnswer(block);

  const parsedOptions =
    parseOptions(block);

  const rawOptions = {
    A: "",
    B: "",
    C: "",
    D: ""
  };

  for (
    const letter of
      ["A", "B", "C", "D"]
  ) {
    if (
      parsedOptions.hindi[letter] &&
      parsedOptions.english[letter] &&
      parsedOptions.hindi[letter] !==
        parsedOptions.english[letter]
    ) {
      rawOptions[letter] =
        `${parsedOptions.hindi[letter]} / ${parsedOptions.english[letter]}`;
    } else {
      rawOptions[letter] =
        parsedOptions.hindi[letter] ||
        parsedOptions.english[letter] ||
        "";
    }
  }

  return {
    questionNumber:
      Number(number) || 0,

    subject,

    chapter,

    hindiQuestion,

    englishQuestion,

    options:
      parsedOptions,

    answer,

    hindiExplanation,

    englishExplanation,

    rawOptions
  };
}

// ======================================================
// VALIDATE QUESTION
// ======================================================

function validateQuestion(
  question
) {
  const errors = [];

  if (
    !question.hindiQuestion &&
    !question.englishQuestion
  ) {
    errors.push(
      "Question text missing"
    );
  }

  if (!question.answer) {
    errors.push(
      "Answer missing"
    );
  }

  if (
    question.answer &&
    !["A", "B", "C", "D"].includes(
      question.answer
    )
  ) {
    errors.push(
      "Invalid answer"
    );
  }

  for (
    const letter of
      ["A", "B", "C", "D"]
  ) {
    const hindi =
      question.options?.hindi?.[letter] ||
      "";

    const english =
      question.options?.english?.[letter] ||
      "";

    if (
      !clean(hindi) &&
      !clean(english)
    ) {
      errors.push(
        `Option ${letter} missing`
      );
    }
  }

  return errors;
}

// ======================================================
// EXTRACT DOCX
// ======================================================

async function extractDocx(
  buffer
) {
  const result =
    await mammoth.extractRawText({
      buffer
    });

  return normalizeText(
    result.value || ""
  );
}

// ======================================================
// EXTRACT PDF
// ======================================================

async function extractPdf(
  buffer
) {
  if (!pdfParse) {
    throw new Error(
      "pdf-parse package is not installed. Run: npm install pdf-parse"
    );
  }

  /*
    pdf-parse v2
  */

  try {
    if (
      typeof pdfParse.PDFParse ===
      "function"
    ) {
      const parser =
        new pdfParse.PDFParse({
          data: buffer
        });

      const result =
        await parser.getText();

      if (
        parser &&
        typeof parser.destroy ===
          "function"
      ) {
        await parser.destroy();
      }

      const text =
        result?.text || "";

      if (text.trim()) {
        return normalizeText(text);
      }
    }
  } catch (error) {
    console.log(
      "PDF v2 parser failed:",
      error.message
    );
  }

  /*
    Older pdf-parse versions
  */

  try {
    if (
      typeof pdfParse ===
      "function"
    ) {
      const result =
        await pdfParse(buffer);

      const text =
        result?.text || "";

      if (text.trim()) {
        return normalizeText(text);
      }
    }
  } catch (error) {
    console.log(
      "Old PDF parser failed:",
      error.message
    );
  }

  throw new Error(
    "Unable to read PDF text. If this is a scanned/image PDF, OCR is required."
  );
}

// ======================================================
// READ UPLOADED FILE
// ======================================================

async function extractFileText(
  file
) {
  const name =
    String(
      file.originalname || ""
    ).toLowerCase();

  if (
    name.endsWith(".docx")
  ) {
    return extractDocx(
      file.buffer
    );
  }

  /*
    .doc is NOT reliably supported by mammoth.
    Tell user clearly instead of silently failing.
  */

  if (
    name.endsWith(".doc")
  ) {
    throw new Error(
      "Old .DOC format is not supported reliably. Please save the file as .DOCX and upload again."
    );
  }

  if (
    name.endsWith(".pdf")
  ) {
    return extractPdf(
      file.buffer
    );
  }

  throw new Error(
    "Unsupported file type"
  );
}

// ======================================================
// HEALTH
// ======================================================

router.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      message:
        "Questions route is working"
    });
  }
);

// ======================================================
// BULK PREVIEW
// ======================================================

router.post(
  "/bulk/preview",
  adminOnly,
  upload.single("pdfFile"),

  async (req, res) => {
    try {
      // ----------------------------------------------
      // FILE CHECK
      // ----------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "Please upload a PDF or DOCX file."
        });
      }

      // ----------------------------------------------
      // FORM DATA
      // ----------------------------------------------

      const language =
        normalizeLanguage(
          req.body.language
        );

      const selectedSubject =
        clean(
          req.body.subject
        );

      const selectedChapter =
        clean(
          req.body.chapter
        );

      // ----------------------------------------------
      // EXTRACT TEXT
      // ----------------------------------------------

      const text =
        await extractFileText(
          req.file
        );

      console.log(
        "------------------------------------------"
      );

      console.log(
        "BULK FILE:",
        req.file.originalname
      );

      console.log(
        "EXTRACTED TEXT LENGTH:",
        text.length
      );

      console.log(
        "EXTRACTED TEXT PREVIEW:"
      );

      console.log(
        text.substring(0, 2000)
      );

      console.log(
        "------------------------------------------"
      );

      // ----------------------------------------------
      // EMPTY FILE
      // ----------------------------------------------

      if (!text.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "File से text नहीं मिला। अगर PDF scanned/image PDF है तो OCR PDF चाहिए।"
        });
      }

      // ----------------------------------------------
      // SPLIT QUESTIONS
      // ----------------------------------------------

      const blocks =
        splitIntoQuestionBlocks(
          text
        );

      console.log(
        "QUESTION BLOCKS FOUND:",
        blocks.length
      );

      // ----------------------------------------------
      // NO QUESTIONS
      // ----------------------------------------------

      if (!blocks.length) {
        return res.status(400).json({
          success: false,

          message:
            "No questions found. File में QUESTION 1, QUESTION 2... जैसा heading होना चाहिए.",

          diagnostic: {
            fileName:
              req.file.originalname,

            textLength:
              text.length,

            textPreview:
              text.substring(
                0,
                3000
              )
          }
        });
      }

      // ----------------------------------------------
      // PARSE
      // ----------------------------------------------

      const validQuestions = [];
      const invalidQuestions = [];

      for (
        const block of blocks
      ) {
        const question =
          parseQuestionBlock(
            block.text,
            block.number
          );

        /*
          UI-selected subject/chapter
          has priority if selected.
        */

        question.subject =
          selectedSubject ||
          question.subject ||
          "General";

        question.chapter =
          selectedChapter ||
          question.chapter ||
          "General";

        question.language =
          language;

        const errors =
          validateQuestion(
            question
          );

        if (errors.length) {
          invalidQuestions.push({
            questionNumber:
              block.number,

            errors,

            question,

            rawBlock:
              block.text
          });
        } else {
          validQuestions.push(
            question
          );
        }
      }

      // ----------------------------------------------
      // RESPONSE
      // ----------------------------------------------

      return res.json({
        success: true,

        message:
          `${validQuestions.length} questions detected successfully.`,

        totalDetected:
          blocks.length,

        validQuestions:
          validQuestions.length,

        invalidQuestions:
          invalidQuestions.length,

        questions:
          validQuestions,

        errors:
          invalidQuestions
      });
    } catch (error) {
      console.error(
        "Bulk Preview Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Preview failed"
      });
    }
  }
);

// ======================================================
// BULK IMPORT
//
// IMPORTANT:
// NO DELETE.
// NO deleteMany.
// ONLY insertMany.
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

      // ----------------------------------------------
      // TEST ID
      // ----------------------------------------------

      if (!testId) {
        return res.status(400).json({
          success: false,
          message:
            "Test ID is required"
        });
      }

      // ----------------------------------------------
      // QUESTIONS
      // ----------------------------------------------

      if (
        !Array.isArray(questions) ||
        !questions.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No questions found for import"
        });
      }

      // ----------------------------------------------
      // CHECK TEST
      // ----------------------------------------------

      const test =
        await Test.findById(
          testId
        );

      if (!test) {
        return res.status(404).json({
          success: false,
          message:
            "Test not found"
        });
      }

      // ----------------------------------------------
      // LANGUAGE
      // ----------------------------------------------

      const selectedLanguage =
        normalizeLanguage(
          language
        );

      // ----------------------------------------------
      // BUILD DOCUMENTS
      // ----------------------------------------------

      const docs = [];

      for (
        let i = 0;
        i < questions.length;
        i++
      ) {
        const q =
          questions[i] || {};

        // --------------------------------------------
        // QUESTION
        // --------------------------------------------

        const questionHindi =
          clean(
            q.hindiQuestion ||
            q.questionHindi ||
            q.question?.hindi ||
            ""
          );

        const questionEnglish =
          clean(
            q.englishQuestion ||
            q.questionEnglish ||
            q.question?.english ||
            ""
          );

        // --------------------------------------------
        // OPTIONS
        // --------------------------------------------

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

        // --------------------------------------------
        // COMBINED OPTIONS
        // --------------------------------------------

        const combinedOptions = [];

        for (
          let j = 0;
          j < 4;
          j++
        ) {
          const hindi =
            hindiOptions[j];

          const english =
            englishOptions[j];

          let combined = "";

          if (
            hindi &&
            english &&
            hindi !== english
          ) {
            combined =
              `${hindi} / ${english}`;
          } else {
            combined =
              hindi ||
              english ||
              "";
          }

          combinedOptions.push(
            combined
          );
        }

        // --------------------------------------------
        // ANSWER
        // --------------------------------------------

        let correctAnswer =
          q.correctAnswer;

        if (
          typeof correctAnswer ===
            "string" &&
          /^[A-Da-d]$/.test(
            correctAnswer.trim()
          )
        ) {
          correctAnswer =
            correctAnswer
              .trim()
              .toUpperCase()
              .charCodeAt(0) -
            "A".charCodeAt(0);
        }

        if (
          correctAnswer ===
            undefined ||
          correctAnswer ===
            null ||
          correctAnswer === ""
        ) {
          const answer =
            String(
              q.answer || ""
            )
              .trim()
              .toUpperCase();

          if (
            /^[A-D]$/.test(
              answer
            )
          ) {
            correctAnswer =
              answer.charCodeAt(0) -
              "A".charCodeAt(0);
          }

          if (
            /^[1-4]$/.test(
              answer
            )
          ) {
            correctAnswer =
              Number(answer) - 1;
          }
        }

        correctAnswer =
          Number(
            correctAnswer
          );

        // --------------------------------------------
        // EXPLANATIONS
        // --------------------------------------------

        const explanationHindi =
          clean(
            q.hindiExplanation ||
            q.explanationHindi ||
            q.explanation?.hindi ||
            ""
          );

        const explanationEnglish =
          clean(
            q.englishExplanation ||
            q.explanationEnglish ||
            q.explanation?.english ||
            ""
          );

        // --------------------------------------------
        // COMBINED QUESTION
        // --------------------------------------------

        let combinedQuestion =
          "";

        if (
          questionHindi &&
          questionEnglish &&
          questionHindi !==
            questionEnglish
        ) {
          combinedQuestion =
            `${questionHindi}\n\n${questionEnglish}`;
        } else {
          combinedQuestion =
            questionHindi ||
            questionEnglish ||
            "";
        }

        // --------------------------------------------
        // COMBINED EXPLANATION
        // --------------------------------------------

        let combinedExplanation =
          "";

        if (
          explanationHindi &&
          explanationEnglish &&
          explanationHindi !==
            explanationEnglish
        ) {
          combinedExplanation =
            `${explanationHindi}\n\n${explanationEnglish}`;
        } else {
          combinedExplanation =
            explanationHindi ||
            explanationEnglish ||
            "";
        }

        // --------------------------------------------
        // VALIDATION
        // --------------------------------------------

        if (
          !combinedQuestion
        ) {
          throw new Error(
            `Question ${
              i + 1
            }: Question text is missing`
          );
        }

        if (
          combinedOptions.length !==
          4
        ) {
          throw new Error(
            `Question ${
              i + 1
            }: Exactly 4 options are required`
          );
        }

        if (
          combinedOptions.some(
            option =>
              !clean(option)
          )
        ) {
          throw new Error(
            `Question ${
              i + 1
            }: All 4 options are required`
          );
        }

        if (
          !Number.isInteger(
            correctAnswer
          ) ||
          correctAnswer < 0 ||
          correctAnswer > 3
        ) {
          throw new Error(
            `Question ${
              i + 1
            }: Correct answer must be A, B, C or D`
          );
        }

        // --------------------------------------------
        // FINAL DOCUMENT
        // --------------------------------------------

        const questionData = {
          testId:
            test._id,

          questionNumber:
            Number(
              q.questionNumber
            ) ||
            i + 1,

          subject:
            clean(q.subject) ||
            clean(subject) ||
            "General",

          chapter:
            clean(q.chapter) ||
            clean(chapter) ||
            "General",

          language:
            selectedLanguage,

          // ⬇️ ये नई line है - questionText के लिए
          questionText:
            combinedQuestion,

          // ⬇️ ये भी नई line है - optionsText के लिए (अगर model में है)
          optionsText:
            combinedOptions,

          questionHindi,

          questionEnglish,

          question:
            combinedQuestion,

          optionsHindi:
            hindiOptions,

          optionsEnglish:
            englishOptions,

          options:
            combinedOptions,

          correctAnswer,

          explanationHindi,

          explanationEnglish,

          explanation:
            combinedExplanation,

          type:
            "single"
        };
        docs.push(
          questionData
        );
      }

      // ----------------------------------------------
      // INSERT
      //
      // IMPORTANT:
      // Existing questions are NOT deleted.
      // ----------------------------------------------

      const inserted =
        await Question.insertMany(
          docs,
          {
            ordered: true
          }
        );

      // ----------------------------------------------
      // SUCCESS
      // ----------------------------------------------

      return res.json({
        success: true,

        message:
          `${inserted.length} questions imported successfully.`,

        imported:
          inserted.length,

        total:
          questions.length
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

// ======================================================
// ADMIN: GET QUESTIONS FOR TEST
// ======================================================

router.get(
  "/admin/test/:testId",
  adminOnly,

  async (req, res) => {
    try {
      const questions =
        await Question.find({
          testId:
            req.params.testId
        }).sort({
          questionNumber: 1,
          createdAt: 1
        });

      return res.json({
        success: true,
        questions
      });
    } catch (error) {
      console.error(
        "Admin Questions Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load questions"
      });
    }
  }
);

// ======================================================
// STUDENT: GET QUESTIONS
// ======================================================

router.get(
  "/test/:testId",

  async (req, res) => {
    try {
      const test =
        await Test.findById(
          req.params.testId
        );

      if (!test) {
        return res.status(404).json({
          success: false,
          message:
            "Test not found"
        });
      }

      if (
        test.visible === false
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Test is not available"
        });
      }

      const questions =
        await Question.find({
          testId:
            req.params.testId
        })
          .select(
            "-answer -explanation"
          )
          .sort({
            questionNumber: 1,
            createdAt: 1
          });

      return res.json({
        success: true,
        questions
      });
    } catch (error) {
      console.error(
        "Student Questions Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load test questions"
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
      const question =
        await Question.create(
          req.body
        );

      return res.json({
        success: true,
        message:
          "Question added successfully",
        question
      });
    } catch (error) {
      console.error(
        "Manual Question Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message
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
          message:
            "Question not found"
        });
      }

      return res.json({
        success: true,
        message:
          "Question updated successfully",
        question
      });
    } catch (error) {
      console.error(
        "Update Question Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message
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
          message:
            "Question not found"
        });
      }

      return res.json({
        success: true,
        message:
          "Question deleted successfully"
      });
    } catch (error) {
      console.error(
        "Delete Question Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Delete failed"
      });
    }
  }
);

// ======================================================
// MULTER ERROR HANDLER
// ======================================================

router.use(
  (err, req, res, next) => {
    if (
      err instanceof multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        message:
          err.message
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message:
          err.message
      });
    }

    next();
  }
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;