const User = require("../models/User");

async function requireLogin(req, res, next) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const user = await User.findById(req.session.userId).select(
      "-password"
    );

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: "User session is invalid"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication Error:", error);

    res.status(500).json({
      success: false,
      message: "Authentication failed"
    });
  }
}

module.exports = requireLogin;