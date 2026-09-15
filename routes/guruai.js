const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = "gemini-3.6-flash";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const documents = new Map();

function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function generateAI(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens: 1200
    }
  });

  return String(response.text || "").trim();
}

/* =====================================================
   HEALTH CHECK
===================================================== */

router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "ExamPrepHub GuruAI",
    provider: "Google Gemini",
    model: MODEL
  });
});

/* =====================================================
   NORMAL CHAT
   POST /api/guruai/chat
===================================================== */

router.post("/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Question is required."
      });
    }

    const prompt = `
You are GuruAI, the educational AI assistant for ExamPrepHub.

Your job is to help students with:
- SSC
- Railway
- Banking
- UPSC
- Police
- Defence
- General Knowledge
- General Science
- Reasoning
- Computer
- Mathematics
- Hindi
- English
- school subjects

Rules:
1. Answer primarily in the same language as the student.
2. If the student uses Hinglish, you may answer in simple Hinglish.
3. Be concise and educational.
4. For factual questions, do not invent facts.
5. If you are unsure, clearly say that you are not certain.
6. For MCQs, identify the correct option and explain briefly.
7. Never pretend that an uncertain answer is confirmed.
8. Use simple formatting suitable for a mobile student dashboard.

Student question:
${message}
`;

    const answer = await generateAI(prompt);

    if (!answer) {
      return res.status(500).json({
        success: false,
        message: "AI did not return an answer."
      });
    }

    return res.json({
      success: true,
      reply: answer,
      model: MODEL
    });

  } catch (error) {
    console.error("GuruAI chat error:", error);

    return res.status(500).json({
      success: false,
      message: "AI answer generate nahi ho paya.",
      error: error.message
    });
  }
});

/* =====================================================
   DOCUMENT UPLOAD
   POST /api/guruai/upload
===================================================== */

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "PDF या DOCX file select करें."
        });
      }

      const filename = req.file.originalname;
      const mimetype = req.file.mimetype;

      let text = "";

      if (
        mimetype === "application/pdf" ||
        filename.toLowerCase().endsWith(".pdf")
      ) {
        const result = await pdfParse(req.file.buffer);
        text = result.text || "";
      }

      else if (
        mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        filename.toLowerCase().endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({
          buffer: req.file.buffer
        });

        text = result.value || "";
      }

      else {
        return res.status(400).json({
          success: false,
          message: "Only PDF and DOCX files are supported."
        });
      }

      text = cleanText(text);

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Document से readable text नहीं मिला."
        });
      }

      const documentId =
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 10);

      documents.set(documentId, {
        id: documentId,
        filename,
        text,
        createdAt: new Date()
      });

      return res.json({
        success: true,
        message: "Document uploaded successfully.",
        filename,
        documentId,
        characters: text.length
      });

    } catch (error) {
      console.error("GuruAI upload error:", error);

      return res.status(500).json({
        success: false,
        message: "Document upload/process failed.",
        error: error.message
      });
    }
  }
);

/* =====================================================
   DOCUMENT CHAT
   POST /api/guruai/document-chat
===================================================== */

router.post("/document-chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const documentId = String(req.body?.documentId || "").trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Question is required."
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required."
      });
    }

    const document = documents.get(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message:
          "Document session नहीं मिला. कृपया document फिर से upload करें."
      });
    }

    /*
      बहुत बड़े documents को पूरा prompt में भेजने से बचने के लिए
      अभी 60,000 characters तक context लेते हैं।
    */
    const documentText =
      document.text.length > 60000
        ? document.text.slice(0, 60000)
        : document.text;

    const prompt = `
You are GuruAI, an educational document assistant for ExamPrepHub.

Answer the student's question primarily from the supplied document.

Rules:
1. Use the document as the main source.
2. Do not invent information that is not supported by the document.
3. If the document does not contain the answer, clearly say:
   "इस document में इस प्रश्न का स्पष्ट उत्तर नहीं मिला।"
4. Answer in Hindi when the student asks in Hindi.
5. Answer in English when the student asks in English.
6. Hinglish questions can receive simple Hinglish answers.
7. Keep the answer suitable for exam preparation.
8. If useful, mention the relevant topic or section from the document.
9. Keep the answer concise unless the student asks for detail.

DOCUMENT NAME:
${document.filename}

DOCUMENT CONTENT:
${documentText}

STUDENT QUESTION:
${message}
`;

    const answer = await generateAI(prompt);

    if (!answer) {
      return res.status(500).json({
        success: false,
        message: "AI did not return an answer."
      });
    }

    return res.json({
      success: true,
      reply: answer,
      documentId,
      filename: document.filename,
      model: MODEL
    });

  } catch (error) {
    console.error("GuruAI document chat error:", error);

    return res.status(500).json({
      success: false,
      message: "Document AI answer generate nahi ho paya.",
      error: error.message
    });
  }
});

/* =====================================================
   DELETE DOCUMENT FROM MEMORY
===================================================== */

router.delete("/document/:documentId", (req, res) => {
  const documentId = String(req.params.documentId || "");

  const existed = documents.delete(documentId);

  res.json({
    success: true,
    deleted: existed
  });
});

/* =====================================================
   ROUTE ERROR HANDLER
===================================================== */

router.use((error, req, res, next) => {
  console.error("GuruAI route error:", error);

  res.status(500).json({
    success: false,
    message: "GuruAI server error.",
    error: error.message
  });
});

module.exports = router;