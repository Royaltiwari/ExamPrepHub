const express = require("express");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const OTP = require("../models/OTP");

const router = express.Router();

// =====================================================
// EMAIL TRANSPORTER
// =====================================================
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

// =====================================================
// REGISTER STUDENT
// =====================================================
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

    // Check duplicate email
    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already registered"
        });
      }
    }

    // Check duplicate mobile
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

// =====================================================
// LOGIN (Email OR Mobile)
// =====================================================
router.post("/login", async (req, res) => {
  try {
    const { email, mobile, password } = req.body;

    if ((!email && !mobile) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/mobile and password are required"
      });
    }

    // Email ya mobile se user dhundo
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

    // Session save
    req.session.userId = user._id.toString();
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    };

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

// =====================================================
// CURRENT USER
// =====================================================
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

// =====================================================
// LOGOUT
// =====================================================
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

// =====================================================
// FORGOT PASSWORD - STEP 1: Send OTP
// POST /api/auth/forgot-password
// Body: { email } ya { mobile }
// =====================================================
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

    // OTP generate
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Purane OTP delete
    await OTP.deleteMany({ identifier });

    // Naya OTP save
    await OTP.create({
      identifier,
      identifierType,
      otp,
      expiresAt
    });

    // Email bhejo
    if (identifierType === "email") {
      try {
        await transporter.sendMail({
          from: `"ExamPrepHub" <${process.env.EMAIL_USER}>`,
          to: identifier,
          subject: "Password Reset OTP - ExamPrepHub",
          html: `
            <div style="font-family: Arial; max-width: 500px; margin: auto; padding: 20px; background: #f4f7fb; border-radius: 12px;">
              <h2 style="color: #2563eb;">🔐 Password Reset</h2>
              <p>Namaste <strong>${user.name}</strong>,</p>
              <p>Aapka password reset karne ke liye ye OTP use karo:</p>
              <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="color: #2563eb; letter-spacing: 8px; font-size: 36px; margin: 0;">${otp}</h1>
              </div>
              <p style="color: #64748b; font-size: 13px;">Ye OTP 10 minute me expire ho jayega.</p>
              <p style="color: #64748b; font-size: 13px;">Agar aapne ye request nahi ki, to ignore karo.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #64748b; font-size: 12px; text-align: center;">© ExamPrepHub</p>
            </div>
          `
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
          message: "Email bhejne me problem aayi. Please try again."
        });
      }
    } else {
      // Mobile OTP - abhi console me print (SMS service baad me)
      console.log(`📱 OTP for ${identifier}: ${otp}`);
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
      message: "Server error. Please try again."
    });
  }
});

// =====================================================
// FORGOT PASSWORD - STEP 2: Verify OTP
// POST /api/auth/verify-otp
// =====================================================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, mobile, otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP required"
      });
    }

    const identifier = email ? email.trim().toLowerCase() : mobile.trim();

    const otpRecord = await OTP.findOne({
      identifier,
      otp,
      verified: false
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expire ho gaya. Dobara request karo."
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.json({
      success: true,
      message: "OTP verified successfully"
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// =====================================================
// FORGOT PASSWORD - STEP 3: Reset Password
// POST /api/auth/reset-password
// =====================================================
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

    const otpRecord = await OTP.findOne({
      identifier,
      otp,
      verified: true
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP verify nahi hua. Pehle OTP verify karo."
      });
    }

    // User dhundo
    let user;
    if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
    } else {
      user = await User.findOne({ mobile: mobile.trim() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila"
      });
    }

    // Naya password hash
    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    await user.save();

    // OTP delete
    await OTP.deleteMany({ identifier });

    res.json({
      success: true,
      message: "Password successfully reset ho gaya! Ab login karo."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;