const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// ROUTES
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
const settingsRoutes = require("./routes/settings");
const paymentRoutes = require("./routes/payments");
const purchaseRoutes = require("./routes/purchases");
// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

// =====================================================
// SESSION
// =====================================================

app.use(
  session({
    secret: process.env.SESSION_SECRET || "exam-prep-hub-secret",
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// =====================================================
// FRONTEND
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
app.use("/api/settings", settingsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/purchases", purchaseRoutes);
// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// =====================================================
// API 404 - सबसे अंत में
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});
  // =====================================================
// GENERAL ERROR
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

app.listen(PORT, () => {
  console.log("ExamPrepHub running on port " + PORT);
});