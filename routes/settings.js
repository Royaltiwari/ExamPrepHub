const express = require("express");
const router = express.Router();
const Setting = require("../models/Setting");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// DEFAULT PAYMENT SETTINGS
// =====================================================
const DEFAULT_PAYMENT_SETTINGS = {
  qrCodeUrl: "",
  upiId: "",
  accountHolder: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  branch: "",
  instructions: "Payment karne ke baad UTR/Transaction ID aur screenshot upload karein. Admin 24 ghante me verify karega."
};

// =====================================================
// DEFAULT INSTRUCTIONS (for tests)
// =====================================================
const DEFAULT_INSTRUCTIONS = {
  title: "📋 Important Instructions / महत्वपूर्ण निर्देश",
  content: `📌 सामान्य निर्देश / General Instructions:

1. कुल प्रश्न: [Total Questions] | समय: [Duration] मिनट
2. यह टेस्ट [Type] है
3. भाषा: हिंदी + English (Bilingual)

📊 अंकन प्रणाली / Marking Scheme:

• सही उत्तर / Correct Answer: +1 mark
• गलत उत्तर / Wrong Answer: -0.25 mark
• अनुत्तरित / Unattempted: 0 marks

⚠️ नियम / Rules:

• टेस्ट के दौरान टैब न बदलें
• समय समाप्त होते ही टेस्ट स्वतः सबमिट हो जाएगा
• बिना किसी अनुचित साधन के टेस्ट दें

🇮🇳 All the Best! शुभकामनाएँ! 🇮🇳`
};

// =====================================================
// PUBLIC: Get payment settings (QR, bank details)
// =====================================================
router.get("/payment", async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: "payment" });

    if (!setting) {
      setting = { key: "payment", value: DEFAULT_PAYMENT_SETTINGS };
    }

    res.json({
      success: true,
      data: setting.value
    });
  } catch (e) {
    console.error("Get payment settings error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to load settings"
    });
  }
});

// =====================================================
// ADMIN: Save payment settings
// =====================================================
router.post("/payment", requireLogin, requireAdmin, async (req, res) => {
  try {
    const {
      qrCodeUrl,
      upiId,
      accountHolder,
      accountNumber,
      ifscCode,
      bankName,
      branch,
      instructions
    } = req.body;

    const value = {
      qrCodeUrl: qrCodeUrl || "",
      upiId: upiId || "",
      accountHolder: accountHolder || "",
      accountNumber: accountNumber || "",
      ifscCode: ifscCode || "",
      bankName: bankName || "",
      branch: branch || "",
      instructions: instructions || DEFAULT_PAYMENT_SETTINGS.instructions
    };

    await Setting.findOneAndUpdate(
      { key: "payment" },
      { key: "payment", value },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Payment settings saved",
      data: value
    });
  } catch (e) {
    console.error("Save payment settings error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to save settings"
    });
  }
});

// =====================================================
// PUBLIC: Get test instructions
// =====================================================
router.get("/instructions", async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: "instructions" });

    if (!setting) {
      setting = { key: "instructions", value: DEFAULT_INSTRUCTIONS };
    }

    res.json({
      success: true,
      data: setting.value
    });
  } catch (e) {
    console.error("Get instructions error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to load instructions"
    });
  }
});

// =====================================================
// ADMIN: Save test instructions
// =====================================================
router.post("/instructions", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Content required"
      });
    }

    const value = {
      title: title || DEFAULT_INSTRUCTIONS.title,
      content: content
    };

    await Setting.findOneAndUpdate(
      { key: "instructions" },
      { key: "instructions", value },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Instructions saved",
      data: value
    });
  } catch (e) {
    console.error("Save instructions error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to save instructions"
    });
  }
});

module.exports = router;