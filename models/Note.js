const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    class: { type: String, required: true, enum: ["10", "11", "12", "competitive"] },
    subject: { type: String, required: true, trim: true },
    chapter: { type: String, trim: true, default: "" },
    pdfUrl: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    visible: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

noteSchema.index({ class: 1, subject: 1, visible: 1 });

module.exports = mongoose.model("Note", noteSchema);
