const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// =====================================================
// REGISTER MODELS
// =====================================================
require("./models/User");
require("./models/Exam");
require("./models/Subject");
require("./models/Chapter");
require("./models/Question");
require("./models/Test");
require("./models/Batch");
require("./models/Comment");
// =====================================================
// ROUTES IMPORTS
// =====================================================
const authRoutes = require("./routes/auth");
const questionRoutes = require("./routes/questions");
const adminRoutes = require("./routes/admin");
const testRoutes = require("./routes/test");
const resultRoutes = require("./routes/results");
const noteRoutes = require("./routes/notes");
const announcementRoutes = require("./routes/announcements");
const liveRoutes = require("./routes/live");
const examLinkRoutes = require("./routes/exam-links");
const classRoutes = require("./routes/classes");
const chatRoutes = require("./routes/chat");
const guruaiRoutes = require("./routes/guruai");
const settingsRoutes = require("./routes/settings");
const paymentRoutes = require("./routes/payments");
const purchaseRoutes = require("./routes/purchases");
const progressRoutes = require("./routes/progress");
const savedRoutes = require("./routes/saved");
const notificationRoutes = require("./routes/notifications");
const subjectRoutes = require("./routes/subjects");
const examRoutes = require("./routes/exams");
const chapterRoutes = require("./routes/chapters");
const studyMaterialRoutes = require("./routes/study-material");

// =====================================================
// CORS
// =====================================================
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// =====================================================
// BODY PARSER
// =====================================================
app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

// =====================================================
// TRUST PROXY (Render à¤•à¥‡ à¤²à¤¿à¤ à¤œà¤¼à¤°à¥‚à¤°à¥€)
// =====================================================
app.set("trust proxy", 1);

// =====================================================
// SESSION
// =====================================================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "exam-prep-hub-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// =====================================================
// FRONTEND STATIC
// =====================================================
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// MONGODB
// =====================================================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("MongoDB Connected Successfully");
    console.log("DATABASE:", mongoose.connection.name);

    const User = require("./models/User");
    const users = await User.find({})
      .select("_id name email role")
      .lean();

    console.log("ALL USERS:");
    console.log(users);
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error.message);
  });

// =====================================================
// API ROUTES
// =====================================================
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/exam-links", examLinkRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/guruai", guruaiRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/study-material", studyMaterialRoutes);

// =====================================================
// HOME
// =====================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================================================
// API 404
// =====================================================
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// =====================================================
// ERROR HANDLER
// =====================================================
app.use((error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("ExamPrepHub running on port " + PORT);
});
