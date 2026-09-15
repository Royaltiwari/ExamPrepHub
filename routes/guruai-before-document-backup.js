const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// POST /api/guruai/chat
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

module.exports = router;
