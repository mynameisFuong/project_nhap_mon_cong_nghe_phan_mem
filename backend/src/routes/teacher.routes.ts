import { Router } from "express";
import { authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  closeSession,
  createSectionLesson,
  createSession,
  currentOpenSession,
  currentQrOtp,
  exportSessionAttendedExcel,
  exportSectionReport,
  importSectionLessons,
  listLeaveRequests,
  manualMark,
  markNotificationRead,
  markNotificationsRead,
  myAttendanceReport,
  myNotifications,
  mySections,
  sectionLessons,
  reviewLeaveRequest,
  sectionStudents,
  sessionRecords,
  sessionSummary,
  updateRecordStatus
} from "../controllers/teacher.controller.js";

export const teacherRoutes = Router();
teacherRoutes.use(authorize("TEACHER", "ADMIN"));

teacherRoutes.get("/sections", mySections);
teacherRoutes.get("/reports", myAttendanceReport);
teacherRoutes.get("/notifications", myNotifications);
teacherRoutes.patch("/notifications/:id/read", markNotificationRead);
teacherRoutes.patch("/notifications/read-all", markNotificationsRead);
teacherRoutes.get("/sections/:sectionId/students", sectionStudents);
teacherRoutes.get("/sections/:sectionId/lessons", sectionLessons);
teacherRoutes.post("/sections/:sectionId/lessons", createSectionLesson);
teacherRoutes.post("/sections/:sectionId/lessons/import", upload.single("file"), importSectionLessons);
teacherRoutes.post("/sessions", createSession);
teacherRoutes.get("/sessions/open", currentOpenSession);
teacherRoutes.get("/sessions/:sessionId/qr-otp", currentQrOtp);
teacherRoutes.get("/sessions/:sessionId/records", sessionRecords);
teacherRoutes.get("/sessions/:sessionId/summary", sessionSummary);
teacherRoutes.get("/sessions/:sessionId/attended.xlsx", exportSessionAttendedExcel);
teacherRoutes.post("/sessions/:sessionId/manual-mark", manualMark);
teacherRoutes.patch("/sessions/:sessionId/close", closeSession);
teacherRoutes.patch("/records/:recordId", updateRecordStatus);
teacherRoutes.get("/leave-requests", listLeaveRequests);
teacherRoutes.patch("/leave-requests/:id/review", reviewLeaveRequest);
teacherRoutes.get("/sections/:sectionId/report.csv", exportSectionReport);
