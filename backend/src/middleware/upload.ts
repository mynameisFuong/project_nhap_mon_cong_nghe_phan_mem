import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { AppError } from "../utils/http.js";

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const isExcel = [".xlsx", ".xls", ".csv"].includes(path.extname(file.originalname).toLowerCase());
    const destination = isExcel ? "uploads/imports" : "uploads/leave-evidence";
    fs.mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".pdf"];
    if (!allowed.includes(ext)) return cb(new AppError(422, "INVALID_FILE", "Chỉ hỗ trợ Excel, ảnh hoặc PDF."));
    cb(null, true);
  }
});
