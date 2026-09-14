const mongoose = require("mongoose");
const Question = require("./models/Question");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to:", mongoose.connection.name);

    const total = await Question.countDocuments();
    const visibleTrue = await Question.countDocuments({ visible: true });

    console.log("");
    console.log("Total questions:   ", total);
    console.log("visible = true:    ", visibleTrue);

    if (visibleTrue < total) {
      console.log("");
      console.log("Fixing questions...");
      const result = await Question.updateMany(
        { visible: { $ne: true } },
        { $set: { visible: true } }
      );
      console.log("Updated:", result.modifiedCount, "questions");
    } else {
      console.log("All questions already visible");
    }

    const finalCount = await Question.countDocuments({ visible: true });
    console.log("");
    console.log("Final visible count:", finalCount);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
