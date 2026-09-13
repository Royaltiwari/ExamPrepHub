const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: ["live", "pdf", "test", "result", "announcement"], default: "announcement" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    link: { type: String, default: "" },
    icon: { type: String, default: "🔔" },
    isRead: { type: Boolean, default: false },
    forExams: { type: [String], default: [] }
  },
  { timestamps: true }
);
module.exports = mongoose.model("Notification", notificationSchema);
