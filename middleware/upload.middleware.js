const multer = require("multer");
const path = require("path");
const fs = require("fs");
const AppError = require("../utils/AppError");

const uploadDirectory = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(
      null,
      `assets-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const allowedExtensions = [".xlsx", ".xls"];

  if (!allowedExtensions.includes(extension)) {
    return cb(new AppError("Only Excel files (.xlsx and .xls) are allowed", 400));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

module.exports = upload;