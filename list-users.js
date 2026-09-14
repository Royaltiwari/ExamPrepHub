const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to:", mongoose.connection.name);

    const users = await User.find({}).select("name email mobile role");
    console.log("\n=== All Users ===");
    users.forEach(u => {
      console.log(u.role.padEnd(10), u.email || u.mobile, "(" + u.name + ")");
    });
    console.log("\nTotal users:", users.length);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
