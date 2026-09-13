const mongoose = require("mongoose");
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: "📚" },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true }
  },
  { timestamps: true }
);
module.exports = mongoose.model("Subject", subjectSchema);
