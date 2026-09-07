const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// MIDDLEWARE
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ExamPrepHubSecret",
    resave: false,
    saveUninitialized: false,
    store: process.env.MONGODB_URI
      ? MongoStore.create({
          mongoUrl: process.env.MONGODB_URI
        })
      : undefined,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false
    }
  })
);

// =========================
// STATIC FILES
// =========================

app.use(express.static(path.join(__dirname, "public")));
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.sendFile(path.join(__dirname, "public", "robots.txt"));
});
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
const testRoutes = require("./routes/tests");
app.use("/api/tests", testRoutes);

const adminRoutes = require("./routes/admin");

const questionRoutes = require("./routes/questions");

app.use("/api/admin", adminRoutes);

app.use("/api/questions", questionRoutes);
const resultRoutes = require("./routes/results");

app.use("/api/results", resultRoutes);
// =========================
// WEBSITE PAGES
// =========================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/tests", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tests.html"));
});

app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test.html"));
});

app.get("/result", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "result.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

// =========================
// ADMIN PAGES
// =========================

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin/tests", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-tests.html"));
});

app.get("/admin/questions", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "admin-questions.html")
  );
});

app.get("/admin/results", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "admin-results.html")
  );
});

// =========================
// HEALTH CHECK
// =========================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ExamPrepHub Server Working",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Not Connected"
  });
});

// =========================
// MONGODB
// =========================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.log("⚠️ MONGODB_URI is not set in .env");

      app.listen(PORT, () => {
        console.log(
          `🚀 ExamPrepHub running at http://localhost:${PORT}`
        );
      });

      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ MongoDB Connected");

    app.listen(PORT, () => {
      console.log(
        `🚀 ExamPrepHub running at http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error("❌ MongoDB Connection Error:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();