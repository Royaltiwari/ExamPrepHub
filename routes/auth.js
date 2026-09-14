const express = require("express");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const OTP = require("../models/OTP");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || (!email && !mobile) || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email/mobile, and password are required"
      });
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already registered"
        });
      }
    }

    if (mobile) {
      const existingMobile = await User.findOne({ mobile: mobile.trim() });
      if (existingMobile) {
        return res.status(409).json({
          success: false,
          message: "Mobile already registered"
        });
      }
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

    req.session.userId = user._id.toString();
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    };

    req.session.save(function(sessionError) {
      if (sessionError) {
        console.error("Session Save Error:", sessionError);
        return res.status(500).json({
          success: false,
          message: "Session could not be saved"
        });
      }

      return res.status(201).json({
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
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, mobile, password } = req.body;

    if ((!email && !mobile) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/mobile and password are required"
      });
    }

    let user;
    if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
    } else if (mobile) {
      user = await User.findOne({ mobile: mobile.trim() });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive"
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    req.session.userId = user._id.toString();
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    };

    req.session.save(function(sessionError) {
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

// CURRENT USER
router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const user = await User.findById(req.session.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

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

// LOGOUT
router.post("/logout", function(req, res) {
  req.session.destroy(function(error) {
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

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, mobile } = req.body;

    if (!email && !mobile) {
      return res.status(400).json({
        success: false,
        message: "Email ya mobile required"
      });
    }

    let user, identifier, identifierType;

    if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
      identifier = email.trim().toLowerCase();
      identifierType = "email";
    } else {
      user = await User.findOne({ mobile: mobile.trim() });
      identifier = mobile.trim();
      identifierType = "mobile";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Ye email/mobile registered nahi hai"
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.deleteMany({ identifier });
    await OTP.create({ identifier, identifierType, otp, expiresAt });

    if (identifierType === "email") {
      try {
        await transporter.sendMail({
          from: '"ExamPrepHub" <' + process.env.EMAIL_USER + '>',
          to: identifier,
          subject: "Password Reset OTP - ExamPrepHub",
          html: "<h2>Password Reset</h2><p>Aapka OTP: <b>" + otp + "</b></p><p>Ye 10 minute me expire ho jayega.</p>"
        });

        res.json({
          success: true,
          message: "OTP aapke email pe bhej diya gaya hai",
          identifierType: "email"
        });
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
        return res.status(500).json({
          success: false,
          message: "Email bhejne me problem aayi"
        });
      }
    } else {
      console.log("OTP for " + identifier + ": " + otp);
      res.json({
        success: true,
        message: "OTP aapke mobile pe bhej diya gaya hai",
        identifierType: "mobile"
      });
    }

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// VERIFY OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, mobile, otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, message: "OTP required" });
    }

    const identifier = email ? email.trim().toLowerCase() : mobile.trim();

    const otpRecord = await OTP.findOne({ identifier, otp, verified: false });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expire ho gaya"
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ success: true, message: "OTP verified successfully" });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { email, mobile, otp, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password kam se kam 6 characters ka hona chahiye"
      });
    }

    const identifier = email ? email.trim().toLowerCase() : mobile.trim();

    const otpRecord = await OTP.findOne({ identifier, otp, verified: true });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP verify nahi hua"
      });
    }

    let user;
    if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
    } else {
      user = await User.findOne({ mobile: mobile.trim() });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User nahi mila" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    await user.save();

    await OTP.deleteMany({ identifier });

    res.json({
      success: true,
      message: "Password successfully reset ho gaya!"
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
