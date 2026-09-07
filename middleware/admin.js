const User = require("../models/User");

async function requireAdmin(req, res, next) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Admin login required"
      });
    }

    const user = await User.findById(req.session.userId).select("-password");

    if (!user || !user.isActive || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access denied"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Admin Authentication Error:", error);

    res.status(500).json({
      success: false,
      message: "Admin authentication failed"
    });
  }
}

module.exports = requireAdmin;