const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const GuruAIActivity = require("../models/GuruAIActivity");
const User = require("../models/User");

const EXCEL_DIR = path.join(__dirname, "..", "storage", "guruai");
const EXCEL_FILE = path.join(EXCEL_DIR, "GuruAI_Activity.xlsx");

const MAX_DATA_ROWS = Number(process.env.GURUAI_EXCEL_MAX_ROWS || 5000);

let workbook = null;
let excelQueue = Promise.resolve();

function ensureDirectory() {
  fs.mkdirSync(EXCEL_DIR, { recursive: true });
}

function createSheet(sheetNumber) {
  const name = `GuruAI_${String(sheetNumber).padStart(3, "0")}`;

  const worksheet = workbook.addWorksheet(name);

  worksheet.columns = [
    {
      header: "Date/Time",
      key: "createdAt",
      width: 22
    },
    {
      header: "Student ID",
      key: "userId",
      width: 28
    },
    {
      header: "Student Name",
      key: "studentName",
      width: 24
    },
    {
      header: "Question",
      key: "question",
      width: 55
    },
    {
      header: "Answer",
      key: "answer",
      width: 70
    },
    {
      header: "Type",
      key: "type",
      width: 22
    },
    {
      header: "Document",
      key: "documentName",
      width: 35
    },
    {
      header: "Document ID",
      key: "documentId",
      width: 35
    },
    {
      header: "Status",
      key: "status",
      width: 14
    }
  ];

  const header = worksheet.getRow(1);

  header.font = {
    bold: true
  };

  header.alignment = {
    vertical: "middle",
    horizontal: "center"
  };

  worksheet.freezePanes = {
    xSplit: 0,
    ySplit: 1
  };

  return worksheet;
}

async function loadWorkbook() {
  if (workbook) {
    return workbook;
  }

  ensureDirectory();

  workbook = new ExcelJS.Workbook();

  if (fs.existsSync(EXCEL_FILE)) {
    try {
      await workbook.xlsx.readFile(EXCEL_FILE);
    } catch (error) {
      console.error(
        "Existing Excel file could not be loaded:",
        error.message
      );

      workbook = new ExcelJS.Workbook();
    }
  }

  if (workbook.worksheets.length === 0) {
    createSheet(1);
  }

  return workbook;
}

function getNextSheetNumber() {
  if (!workbook || workbook.worksheets.length === 0) {
    return 1;
  }

  const lastSheet =
    workbook.worksheets[workbook.worksheets.length - 1];

  const match = lastSheet.name.match(/GuruAI_(\d+)/);

  if (!match) {
    return workbook.worksheets.length + 1;
  }

  return Number(match[1]) + 1;
}

async function appendToExcel(data) {
  await loadWorkbook();

  let worksheet =
    workbook.worksheets[workbook.worksheets.length - 1];

  let dataRows = Math.max(0, worksheet.rowCount - 1);

  /*
    Maximum rows means DATA rows.
    Header row is not counted.
  */

  if (dataRows >= MAX_DATA_ROWS) {
    const nextNumber = getNextSheetNumber();
    worksheet = createSheet(nextNumber);

    console.log(
      `Excel sheet full. Created ${worksheet.name}`
    );
  }

  worksheet.addRow({
    createdAt: data.createdAt || new Date(),
    userId: data.userId ? String(data.userId) : "",
    studentName: data.studentName || "Guest",
    question: data.question || "",
    answer: data.answer || "",
    type: data.type || "AI Chat",
    documentName: data.documentName || "",
    documentId: data.documentId || "",
    status: data.status || "SUCCESS"
  });

  ensureDirectory();

  await workbook.xlsx.writeFile(EXCEL_FILE);

  console.log(
    `GuruAI Excel updated: ${worksheet.name}`
  );
}

function queueExcelWrite(data) {
  excelQueue = excelQueue
    .then(() => appendToExcel(data))
    .catch((error) => {
      console.error(
        "GuruAI Excel write error:",
        error.message
      );
    });

  return excelQueue;
}

async function getStudentInfo(req) {
  let userId =
    req.session?.userId ||
    req.session?.user?._id ||
    req.session?.user?.id ||
    null;

  let studentName =
    req.session?.user?.name ||
    req.session?.name ||
    "Guest";

  if (userId) {
    try {
      const user = await User.findById(userId)
        .select("_id name")
        .lean();

      if (user) {
        userId = user._id;
        studentName = user.name || studentName;
      }
    } catch (error) {
      console.error(
        "Student information lookup failed:",
        error.message
      );
    }
  }

  return {
    userId,
    studentName
  };
}

async function logGuruAIActivity({
  req,
  question = "",
  answer = "",
  type = "AI Chat",
  documentName = "",
  documentId = "",
  status = "SUCCESS"
}) {
  const student = await getStudentInfo(req);

  const activity = await GuruAIActivity.create({
    userId: student.userId,
    studentName: student.studentName,
    question,
    answer,
    type,
    documentName,
    documentId,
    status,
    createdAt: new Date()
  });

  await queueExcelWrite({
    createdAt: activity.createdAt,
    userId: activity.userId,
    studentName: activity.studentName,
    question: activity.question,
    answer: activity.answer,
    type: activity.type,
    documentName: activity.documentName,
    documentId: activity.documentId,
    status: activity.status
  });

  return activity;
}

module.exports = {
  logGuruAIActivity,
  EXCEL_FILE,
  MAX_DATA_ROWS
};
