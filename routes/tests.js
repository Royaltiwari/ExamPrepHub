const express = require("express");
const Test = require("../models/Test");

const router = express.Router();

// =====================================
// PUBLIC: केवल Visible Tests
// =====================================

router.get("/", async (req, res) => {
  try {
    const tests = await Test.find({ visible: true })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      success: true,
      tests
    });

  } catch (error) {
    console.error("Get Tests Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load tests"
    });
  }
});


// =====================================
// PUBLIC: Exam-wise Visible Tests
// Example:
// /api/tests/exam/SSC%20CGL
// =====================================

router.get("/exam/:examName", async (req, res) => {
  try {

    const examName = decodeURIComponent(req.params.examName).trim();

    const tests = await Test.find({
      visible: true,
      exam: {
        $regex: new RegExp(`^${examName}$`, "i")
      }
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      success: true,
      exam: examName,
      tests
    });

  } catch (error) {

    console.error("Get Exam Tests Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load exam tests"
    });
  }
});


// =====================================
// PUBLIC: एक Visible Test
// =====================================

router.get("/:id", async (req, res) => {
  try {

    const test = await Test.findOne({
      _id: req.params.id,
      visible: true
    }).select("-__v");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found"
      });
    }

    res.json({
      success: true,
      test
    });

  } catch (error) {

    console.error("Get Test Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load test"
    });
  }
});


module.exports = router;