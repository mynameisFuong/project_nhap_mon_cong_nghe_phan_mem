import type { AttendanceRecord, AttendanceSession, AttendanceSessionSummary, CourseSection, LeaveRequest, Lesson, NotificationItem, StudentInSection, TeacherSectionReport } from "../types";
import { apiClient, unwrap, USE_MOCK } from "./apiClient";
import { mockLessons, mockLeaves, mockNotifications, mockRecords, mockSections, mockUsers } from "./mockData";

export const teacherService = {
  sections: () => USE_MOCK ? Promise.resolve(mockSections) : unwrap<CourseSection[]>(apiClient.get("/teacher/sections")),
  students: (sectionId: string) =>
    USE_MOCK
      ? Promise.resolve(mockUsers.filter((u) => u.role === "STUDENT").map((student) => ({ student } as StudentInSection)))
      : unwrap<StudentInSection[]>(apiClient.get(`/teacher/sections/${sectionId}/students`)),
  lessons: (sectionId: string) => USE_MOCK ? Promise.resolve(mockLessons) : unwrap<Lesson[]>(apiClient.get(`/teacher/sections/${sectionId}/lessons`)),
  createLesson: (sectionId: string, payload: { lessonDate: string; startTime: string; endTime: string; room?: string; topic?: string }) =>
    USE_MOCK ? Promise.resolve({ ...payload, id: `lesson-${Date.now()}`, session: null } as Lesson) : unwrap<Lesson>(apiClient.post(`/teacher/sections/${sectionId}/lessons`, payload)),
  importLessons: (sectionId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return unwrap<{ totalRows: number; successRows: number; failedRows: number; errors: Array<{ row: number; message: string }> }>(
      apiClient.post(`/teacher/sections/${sectionId}/lessons/import`, form, { headers: { "Content-Type": "multipart/form-data" } })
    );
  },
  createSession: (lessonId: string) => USE_MOCK ? Promise.resolve({ id: "mock-session", status: "OPEN", lessonId }) : unwrap(apiClient.post("/teacher/sessions", { lessonId })),
  openSession: () => USE_MOCK ? Promise.resolve(null) : unwrap<(AttendanceSession & { lesson: Lesson; courseSection: CourseSection }) | null>(apiClient.get("/teacher/sessions/open")),
  qrOtp: (sessionId: string) =>
    USE_MOCK
      ? Promise.resolve({ sessionId, qrToken: "mock-qr-token", qrDataUrl: "", otp: "483921", validSeconds: 30 })
      : unwrap<{ sessionId: string; qrToken: string; qrUrl?: string; qrDataUrl: string; otp: string; validSeconds: number }>(apiClient.get(`/teacher/sessions/${sessionId}/qr-otp`)),
  records: (sessionId: string) => USE_MOCK ? Promise.resolve(mockRecords) : unwrap<AttendanceRecord[]>(apiClient.get(`/teacher/sessions/${sessionId}/records`)),
  sessionSummary: (sessionId: string) => USE_MOCK ? Promise.resolve({ session: { id: sessionId, courseSectionId: "", lessonId: "", status: "OPEN", openedAt: "" }, attended: mockRecords, notAttended: [] } as AttendanceSessionSummary) : unwrap<AttendanceSessionSummary>(apiClient.get(`/teacher/sessions/${sessionId}/summary`)),
  reports: () => USE_MOCK ? Promise.resolve([] as TeacherSectionReport[]) : unwrap<TeacherSectionReport[]>(apiClient.get("/teacher/reports")),
  exportSessionAttended: async (sessionId: string) => {
    const response = await apiClient.get(`/teacher/sessions/${sessionId}/attended.xlsx`, { responseType: "blob" });
    return response.data as Blob;
  },
  manualMark: (sessionId: string, studentId: string, reason: string) => unwrap(apiClient.post(`/teacher/sessions/${sessionId}/manual-mark`, { studentId, reason, status: "PRESENT" })),
  closeSession: (sessionId: string) => unwrap(apiClient.patch(`/teacher/sessions/${sessionId}/close`)),
  notifications: () => USE_MOCK ? Promise.resolve(mockNotifications) : unwrap<NotificationItem[]>(apiClient.get("/teacher/notifications")),
  markNotificationRead: (id: string) => USE_MOCK ? Promise.resolve({ updated: 0 }) : unwrap<{ updated: number }>(apiClient.patch(`/teacher/notifications/${id}/read`)),
  markNotificationsRead: () => USE_MOCK ? Promise.resolve({ updated: 0 }) : unwrap<{ updated: number }>(apiClient.patch("/teacher/notifications/read-all")),
  leaveRequests: () => USE_MOCK ? Promise.resolve(mockLeaves) : unwrap<LeaveRequest[]>(apiClient.get("/teacher/leave-requests")),
  reviewLeave: (id: string, status: "APPROVED" | "REJECTED", reviewNote?: string) => unwrap(apiClient.patch(`/teacher/leave-requests/${id}/review`, { status, reviewNote })),
  exportReportUrl: (sectionId: string) => `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"}/teacher/sections/${sectionId}/report.csv`
};
