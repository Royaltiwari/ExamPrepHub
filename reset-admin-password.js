const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
    console.log("📂 Database:", mongoose.connection.name);

    // सभी admins देखें
    const admins = await User.find({ role: "admin" }).select("name email role");
    console.log("\n📋 All Admin Users:");
    if (admins.length === 0) {
      console.log("  ⚠️ No admin user found!");
    } else {
      admins.forEach(a => console.log("  - " + a.email + " (" + a.name + ")"));
    }

    // सभी users भी देखें
    console.log("\n📋 All Users:");
    const all = await User.find({}).select("name email role");
    all.forEach(u => console.log("  - " + u.email + " [" + u.role + "]"));

    // अब specific email का password reset करें
    const email = "tiwariamresh180@gmail.com";
    const newPassword = "Admin@123";
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log("\n❌ User not found: " + email);
      console.log("💡 ऊपर available emails देखें और सही email use करें");
    } else {
      user.password = hashedPassword;
      user.role = "admin";
      await user.save();
      console.log("\n✅ Password reset successful!");
      console.log("📧 Email:    " + email);
      console.log("🔒 Password: " + newPassword);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();