import { Router } from "express";
import { authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createLeaveRequest,
  markNotificationRead,
  markNotificationsRead,
  myAttendanceHistory,
  myEnrollments,
  myLeaveRequests,
  myNotifications,
  mySchedule,
  submitAttendance
} from "../controllers/student.controller.js";

export const studentRoutes = Router();
studentRoutes.use(authorize("STUDENT"));

studentRoutes.get("/sections", myEnrollments);
studentRoutes.get("/schedule", mySchedule);
studentRoutes.post("/attendance", submitAttendance);
studentRoutes.get("/attendance/history", myAttendanceHistory);
studentRoutes.post("/leave-requests", upload.single("evidence"), createLeaveRequest);
studentRoutes.get("/leave-requests", myLeaveRequests);
studentRoutes.get("/notifications", myNotifications);
studentRoutes.patch("/notifications/:id/read", markNotificationRead);
studentRoutes.patch("/notifications/read-all", markNotificationsRead);
