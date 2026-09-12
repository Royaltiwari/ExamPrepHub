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

module.exports = router;
