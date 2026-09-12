const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    userName: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

chatSchema.index({ classId: 1, createdAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
