const express = require("express");
const router = express.Router();
const Purchase = require("../models/Purchase");
const requireLogin = require("../middleware/auth");

// =====================================================
// STUDENT: Check if I have access to item
// GET /api/purchases/check?itemType=class&itemId=xxx
// =====================================================
router.get("/check", requireLogin, async (req, res) => {
  try {
    const { itemType, itemId } = req.query;

    if (!itemType || !itemId) {
      return res.status(400).json({
        success: false,
        message: "itemType and itemId required"
      });
    }

    const purchase = await Purchase.findOne({
      userId: req.user._id,
      itemType,
      itemId,
      isActive: true
    });

    res.json({
      success: true,
      hasAccess: !!purchase,
      purchase: purchase || null
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to check access"
    });
  }
});

// =====================================================
// STUDENT: Get my purchases
// GET /api/purchases/my
// =====================================================
router.get("/my", requireLogin, async (req, res) => {
  try {
    const purchases = await Purchase.find({
      userId: req.user._id,
      isActive: true
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: purchases.length,
      data: purchases
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchases"
    });
  }
});

// =====================================================
// STUDENT: Get my purchased item IDs (for lock UI)
// GET /api/purchases/my-ids
// =====================================================
router.get("/my-ids", requireLogin, async (req, res) => {
  try {
    const purchases = await Purchase.find({
      userId: req.user._id,
      isActive: true
    }).select("itemType itemId");

    const classIds = purchases
      .filter(p => p.itemType === "class")
      .map(p => String(p.itemId));

    const testIds = purchases
      .filter(p => p.itemType === "test")
      .map(p => String(p.itemId));

    res.json({
      success: true,
      data: {
        classes: classIds,
        tests: testIds
      }
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch"
    });
  }
});

module.exports = router;
