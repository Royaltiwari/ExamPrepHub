const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();

// ===============================
// REGISTER STUDENT
// ===============================

router.post("/register", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile ? mobile.trim() : "",
      password: hashedPassword,
      role: "student",
      isActive: true
    });

    // Session
    req.session.userId = user._id.toString();

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    };

    res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Register Error:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

// ===============================
// LOGIN
// ===============================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    });
console.log("LOGIN USER FROM DATABASE:", {
  id: user?._id?.toString(),
  email: user?.email,
  role: user?.role
});

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Undefined होने पर भी inactive न माना जाए
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // ===============================
    // SAVE LOGIN SESSION
    // ===============================

    req.session.userId = user._id.toString();

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    };

    // Session save होने के बाद response
    req.session.save((sessionError) => {
      if (sessionError) {
        console.error("Session Save Error:", sessionError);

        return res.status(500).json({
          success: false,
          message: "Login session could not be saved"
        });
      }

      return res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role
        }
      });
    });

  } catch (error) {
    console.error("Login Error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

// ===============================
// CURRENT USER
// ===============================

router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const user = await User.findById(req.session.userId)
      .select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Session को भी update रखें
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    };

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error("Current User Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to get user"
    });
  }
});

// ===============================
// LOGOUT
// ===============================

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout Error:", error);

      return res.status(500).json({
        success: false,
        message: "Logout failed"
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      success: true,
      message: "Logout successful"
    });
  });
});

module.exports = router;