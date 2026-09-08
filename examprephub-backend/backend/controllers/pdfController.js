const parsePDF = require('../utils/pdfParser');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

exports.uploadPDF = async (req, res) => {
  try {
    const pdfFile = req.file;
    const { subject, examType, batchId } = req.body;
    
    if (!pdfFile) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    const extractedQuestions = await parsePDF(pdfFile.path);
    
    req.session.tempQuestions = extractedQuestions;
    req.session.pdfMeta = { 
      subject, 
      examType, 
      batchId, 
      fileName: pdfFile.originalname,
      filePath: pdfFile.path
    };
    
    res.status(200).json({
      success: true,
      message: 'PDF uploaded and parsed successfully',
      totalQuestions: extractedQuestions.length,
      questions: extractedQuestions,
      meta: req.session.pdfMeta
    });
    
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.upload = upload.single('pdfFile');