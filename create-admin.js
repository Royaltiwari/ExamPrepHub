const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
    console.log("📂 Database:", mongoose.connection.name);

    const email = "admin@examprephub.com";
    const mobile = "9999999999";
    const plainPassword = "Admin@123";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let admin = await User.findOne({ email });

    if (admin) {
      admin.password = hashedPassword;
      admin.role = "admin";
      admin.mobile = mobile;
      await admin.save();
      console.log("✅ Admin password updated");
    } else {
      admin = await User.create({
        name: "Admin",
        email,
        mobile,
        password: hashedPassword,
        role: "admin"
      });
      console.log("✅ New admin created");
    }

    console.log("\n========== LOGIN DETAILS ==========");
    console.log("Email:    " + email);
    console.log("Mobile:   " + mobile);
    console.log("Password: " + plainPassword);
    console.log("===================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();