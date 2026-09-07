require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function makeAdmin() {
  try {
    if (!process.env.MONGODB_URI) {
      console.log("❌ MONGODB_URI .env में मौजूद नहीं है");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const email = process.argv[2];

    if (!email) {
      console.log("❌ Email दें:");
      console.log("node make-admin.js your-email@example.com");
      process.exit(1);
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      console.log("❌ इस email से कोई user नहीं मिला।");
      process.exit(1);
    }

    user.role = "admin";

    await user.save();

    console.log("✅ Admin successfully created!");
    console.log("👤 Name:", user.name);
    console.log("📧 Email:", user.email);
    console.log("🔐 Role:", user.role);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

makeAdmin();