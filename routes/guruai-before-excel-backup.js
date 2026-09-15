const express = require("express");
const OpenAI = require("openai");
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =====================================================
// FILE UPLOAD
// =====================================================

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

    const ext = file.originalname.toLowerCase();

    if (
      allowed.includes(file.mimetype) ||
      ext.endsWith(".pdf") ||
      ext.endsWith(".docx") ||
      ext.endsWith(".doc")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC and DOCX files are allowed."));
    }
  }
});

// =====================================================
// TEMP DOCUMENT STORAGE
// =====================================================

const documents = new Map();

// Remove old documents after 1 hour
setInterval(() => {

  const now = Date.now();

  for (const [id, document] of documents.entries()) {

    if (now - document.createdAt > 60 * 60 * 1000) {
      documents.delete(id);
    }

  }

}, 10 * 60 * 1000);

// =====================================================
// CREATE DOCUMENT ID
// =====================================================

function createDocumentId() {

  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );

}

// =====================================================
// EXTRACT TEXT
// =====================================================

async function extractDocumentText(file) {

  const filename = file.originalname.toLowerCase();

  // ---------------- PDF ----------------

  if (filename.endsWith(".pdf")) {

    const result = await pdfParse(file.buffer);

    return result.text || "";
  }

  // ---------------- DOCX ----------------

  if (filename.endsWith(".docx")) {

    const result = await mammoth.extractRawText({
      buffer: file.buffer
    });

    return result.value || "";
  }

  // ---------------- DOC ----------------

  if (filename.endsWith(".doc")) {

    throw new Error(
      "Old .DOC files are not supported in this version. Please save the file as .DOCX and upload again."
    );

  }

  throw new Error("Unsupported document format.");

}

// =====================================================
// UPLOAD DOCUMENT
// POST /api/guruai/upload
// =====================================================

router.post("/upload", upload.single("document"), async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({
        success: false,
        message: "Please select a PDF or DOCX file."
      });

    }

    const text = await extractDocumentText(req.file);

    if (!text || !text.trim()) {

      return res.status(400).json({
        success: false,
        message: "No readable text was found in this document."
      });

    }

    const documentId = createDocumentId();

    // Keep a reasonable amount of text for the first version.
    const MAX_DOCUMENT_CHARS = 120000;

    const cleanedText = text
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    documents.set(documentId, {
      id: documentId,
      filename: req.file.originalname,
      text: cleanedText.substring(0, MAX_DOCUMENT_CHARS),
      originalLength: cleanedText.length,
      createdAt: Date.now()
    });

    return res.json({
      success: true,
      documentId,
      filename: req.file.originalname,
      characters: cleanedText.length,
      storedCharacters: Math.min(
        cleanedText.length,
        MAX_DOCUMENT_CHARS
      ),
      message: "Document uploaded successfully."
    });

  } catch (error) {

    console.error("GuruAI document upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Document processing failed."
    });

  }

});

// =====================================================
// ASK ABOUT DOCUMENT
// POST /api/guruai/document-chat
// =====================================================

router.post("/document-chat", async (req, res) => {

  try {

    const { documentId, message } = req.body;

    if (!documentId) {

      return res.status(400).json({
        success: false,
        message: "Document ID is required."
      });

    }

    if (!message || !message.trim()) {

      return res.status(400).json({
        success: false,
        message: "Question is required."
      });

    }

    if (!process.env.OPENAI_API_KEY) {

      return res.status(500).json({
        success: false,
        message: "OPENAI_API_KEY is not configured."
      });

    }

    const document = documents.get(documentId);

    if (!document) {

      return res.status(404).json({
        success: false,
        message: "Document expired or not found. Please upload it again."
      });

    }

    const response = await client.responses.create({

      model: "gpt-5-mini",

      instructions: `
You are ExamPrepHub Assistant — GuruAI.

The user has uploaded a document.

IMPORTANT:
- Answer primarily from the uploaded document.
- Do not invent information that is not supported by the document.
- If the answer cannot be found in the document, clearly say:
  "इस document में इसका स्पष्ट उत्तर नहीं मिला।"
- You may explain the document's content in simple Hindi, English or Hinglish.
- Preserve important terminology, names, dates and facts from the document.
- If the user asks for a summary, summarize the uploaded document.
- If the user asks for MCQs, create questions only from information supported by the document.
- If the user asks for an explanation, explain the relevant portion clearly.
`,

      input: `
UPLOADED DOCUMENT:
------------------
Filename: ${document.filename}

Document content:
------------------
${document.text}

USER QUESTION:
------------------
${message.trim()}
`
    });

    return res.json({
      success: true,
      reply: response.output_text
    });

  } catch (error) {

    console.error("GuruAI document chat error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Document question failed."
    });

  }

});

// =====================================================
// NORMAL GURUAI CHAT
// POST /api/guruai/chat
// =====================================================

router.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    if (!message || !message.trim()) {

      return res.status(400).json({
        success: false,
        message: "Message is required"
      });

    }

    if (!process.env.OPENAI_API_KEY) {

      return res.status(500).json({
        success: false,
        message: "OPENAI_API_KEY is not configured on server"
      });

    }

    const response = await client.responses.create({

      model: "gpt-5-mini",

      instructions: `
You are ExamPrepHub Assistant, also called GuruAI.

You are an educational AI assistant for ExamPrepHub.

You can communicate in:
- Hindi
- English
- Hinglish

Answer students clearly and helpfully.
For competitive-exam questions, explain the answer in an easy way.
Do not claim that you can access ExamPrepHub's private database unless it is actually connected.
`,

      input: message.trim()

    });

    return res.json({
      success: true,
      reply: response.output_text
    });

  } catch (error) {

    console.error("GuruAI Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "GuruAI request failed"
    });

  }

});

// =====================================================
// ERROR HANDLER FOR UPLOAD
// =====================================================

router.use((error, req, res, next) => {

  console.error("GuruAI Route Error:", error);

  if (error instanceof multer.MulterError) {

    if (error.code === "LIMIT_FILE_SIZE") {

      return res.status(400).json({
        success: false,
        message: "File size must be 10 MB or less."
      });

    }

  }

  return res.status(400).json({
    success: false,
    message: error.message || "GuruAI request failed."
  });

});

module.exports = router;
