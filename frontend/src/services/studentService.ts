import type { AttendanceRecord, CourseSection, LeaveRequest, Lesson, NotificationItem } from "../types";
import { apiClient, unwrap, USE_MOCK } from "./apiClient";
import { mockLessons, mockLeaves, mockNotifications, mockRecords, mockSections } from "./mockData";

export const studentService = {
  sections: () => USE_MOCK ? Promise.resolve(mockSections.map((courseSection) => ({ courseSection }))) : unwrap<Array<{ courseSection: CourseSection }>>(apiClient.get("/student/sections")),
  schedule: () => USE_MOCK ? Promise.resolve(mockLessons.map((lesson) => ({ ...lesson, courseSection: mockSections[0] }))) : unwrap<Array<Lesson & { courseSection?: CourseSection }>>(apiClient.get("/student/schedule")),
  submitAttendance: (qrToken: string, otp: string) => unwrap(apiClient.post("/student/attendance", { qrToken, otp })),
  history: () => USE_MOCK ? Promise.resolve(mockRecords) : unwrap<AttendanceRecord[]>(apiClient.get("/student/attendance/history")),
  leaveRequests: () => USE_MOCK ? Promise.resolve(mockLeaves) : unwrap<LeaveRequest[]>(apiClient.get("/student/leave-requests")),
  createLeave: (payload: { attendanceRecordId?: string; lessonId?: string }, reason: string, evidence: File) => {
    const data = new FormData();
    if (payload.attendanceRecordId) data.append("attendanceRecordId", payload.attendanceRecordId);
    if (payload.lessonId) data.append("lessonId", payload.lessonId);
    data.append("reason", reason);
    data.append("evidence", evidence);
    return unwrap(apiClient.post("/student/leave-requests", data));
  },
  notifications: () => USE_MOCK ? Promise.resolve(mockNotifications) : unwrap<NotificationItem[]>(apiClient.get("/student/notifications")),
  markNotificationRead: (id: string) => USE_MOCK ? Promise.resolve({ updated: 0 }) : unwrap<{ updated: number }>(apiClient.patch(`/student/notifications/${id}/read`)),
  markNotificationsRead: () => USE_MOCK ? Promise.resolve({ updated: 0 }) : unwrap<{ updated: number }>(apiClient.patch("/student/notifications/read-all"))
};
