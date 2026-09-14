const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
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
    default: "User"
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  isQuestion: {
    type: Boolean,
    default: false
  },
  likes: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("Comment", commentSchema);
