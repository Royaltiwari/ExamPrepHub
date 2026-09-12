const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Payment = require("../models/Payment");
const Purchase = require("../models/Purchase");
const Class = require("../models/Class");
const Test = require("../models/Test");
const requireLogin = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// =====================================================
// MULTER - Payment Screenshot Upload
// =====================================================
const proofDir = path.join(__dirname, "..", "public", "uploads", "payments");
if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  }
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Sirf image files allowed (jpg, png, webp, gif)"));
  }
});

// =====================================================
// STUDENT: Upload payment screenshot
// POST /api/payments/upload-screenshot
// =====================================================
router.post(
  "/upload-screenshot",
  requireLogin,
  uploadProof.single("screenshot"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Koi file nahi mili"
        });
      }

      const url = `/uploads/payments/${req.file.filename}`;

      res.json({
        success: true,
        message: "Uploaded",
        url,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (e) {
      console.error("Upload error:", e);
      res.status(500).json({
        success: false,
        message: e.message || "Upload failed"
      });
    }
  }
);

// =====================================================
// STUDENT: Submit payment proof
// POST /api/payments/submit
// Body: { itemType, itemId, utrNumber, screenshotUrl }
// =====================================================
router.post("/submit", requireLogin, async (req, res) => {
  try {
    const { itemType, itemId, utrNumber, screenshotUrl } = req.body;

    if (!itemType || !itemId || !utrNumber) {
      return res.status(400).json({
        success: false,
        message: "Item type, item ID, and UTR required"
      });
    }

    if (!["class", "test", "bundle"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item type"
      });
    }

    // Fetch the item
    let item;
    if (itemType === "class") {
      item = await Class.findById(itemId);
    } else if (itemType === "test") {
      item = await Test.findById(itemId);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    if (!item.isPaid) {
      return res.status(400).json({
        success: false,
        message: "Ye item free hai, payment ki zaroorat nahi"
      });
    }

    // Check koi pending payment already hai?
    const existing = await Payment.findOne({
      userId: req.user._id,
      itemType,
      itemId,
      status: "pending"
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Aapka ek payment already pending hai is item ke liye"
      });
    }

    // Check already purchased?
    const purchased = await Purchase.findOne({
      userId: req.user._id,
      itemType,
      itemId,
      isActive: true
    });

    if (purchased) {
      return res.status(400).json({
        success: false,
        message: "Ye item aapne already kharida hua hai"
      });
    }

    const payment = await Payment.create({
      userId: req.user._id,
      itemType,
      itemId,
      itemTitle: item.title || item.name || "Untitled",
      amount: item.price || 0,
      utrNumber: utrNumber.trim(),
      screenshotUrl: screenshotUrl || "",
      status: "pending"
    });

    res.status(201).json({
      success: true,
      message: "Payment submit ho gaya. Admin verify karega aur aapko access mil jayega.",
      data: payment
    });

  } catch (e) {
    console.error("Payment submit error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to submit payment"
    });
  }
});

// =====================================================
// STUDENT: Get my payments
// GET /api/payments/my
// =====================================================
router.get("/my", requireLogin, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments"
    });
  }
});

// =====================================================
// ADMIN: Get all payments
// GET /api/payments/admin/all?status=pending
// =====================================================
router.get("/admin/all", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate("userId", "name email mobile")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments"
    });
  }
});

// =====================================================
// ADMIN: Approve payment
// POST /api/payments/:id/approve
// =====================================================
router.post("/:id/approve", requireLogin, requireAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    if (payment.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Already approved"
      });
    }

    // Update payment
    payment.status = "approved";
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();
    await payment.save();

    // Create purchase (access)
    await Purchase.findOneAndUpdate(
      {
        userId: payment.userId,
        itemType: payment.itemType,
        itemId: payment.itemId
      },
      {
        userId: payment.userId,
        itemType: payment.itemType,
        itemId: payment.itemId,
        itemTitle: payment.itemTitle,
        amount: payment.amount,
        paymentId: payment._id,
        isActive: true
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Payment approved aur access unlock ho gaya"
    });

  } catch (e) {
    console.error("Approve error:", e);
    res.status(500).json({
      success: false,
      message: "Failed to approve"
    });
  }
});

// =====================================================
// ADMIN: Reject payment
// POST /api/payments/:id/reject
// Body: { reason }
// =====================================================
router.post("/:id/reject", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    payment.status = "rejected";
    payment.rejectionReason = reason || "Invalid payment proof";
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();
    await payment.save();

    res.json({
      success: true,
      message: "Payment rejected"
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to reject"
    });
  }
});

module.exports = router;