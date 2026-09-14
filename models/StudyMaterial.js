const mongoose = require("mongoose");

const studyMaterialSchema = new mongoose.Schema(
  {
    // Basic Info
    title: { type: String, required: true, trim: true },
    title_hi: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    
    // 3-Level Structure: Exam → Subject → Chapter
    exam: { type: String, default: "", trim: true },        // "SSC GD", "Class 12"
    examCategory: { type: String, default: "", trim: true }, // "Competitive", "School"
    subject: { type: String, default: "", trim: true },      // "General Knowledge"
    chapter: { type: String, default: "", trim: true },      // "History"
    
    // PDF File
    file_url: { type: String, required: true },
    file_name: { type: String, default: "" },
    file_size: { type: Number, default: 0 },
    thumbnail: { type: String, default: "" },
    pages: { type: Number, default: 0 },
    
    // Tags & Meta
    tags: [{ type: String }],           // ["Important", "New", "PYQ"]
    language: { type: String, default: "Hindi" },  // Hindi, English, Bilingual
    publishDate: { type: Date, default: Date.now },
    
    // Status
    status: { 
      type: String, 
      enum: ["Active", "Draft", "Archived"], 
      default: "Active" 
    },
    visible: { type: Boolean, default: true },
    
    // Stats
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudyMaterial", studyMaterialSchema);