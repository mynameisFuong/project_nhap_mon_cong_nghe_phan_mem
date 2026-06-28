import type { ClassRoom, CourseSection, Faculty, Semester, StudentInSection, Subject, User } from "../types";
import { apiClient, unwrap, USE_MOCK } from "./apiClient";
import { mockClasses, mockFaculties, mockSections, mockSemesters, mockSubjects, mockUsers } from "./mockData";

export const adminService = {
  users: () => USE_MOCK ? Promise.resolve(mockUsers) : unwrap<User[]>(apiClient.get("/admin/users")),
  createUser: (payload: Partial<User> & { password?: string }) => unwrap<User>(apiClient.post("/admin/users", payload)),
  updateUser: (id: string, payload: Partial<User>) => unwrap<User>(apiClient.patch(`/admin/users/${id}`, payload)),
  lockUser: (id: string, locked: boolean) => unwrap<User>(apiClient.patch(`/admin/users/${id}/lock`, { locked })),
  deleteUser: (id: string) => unwrap(apiClient.delete(`/admin/users/${id}`)),
  faculties: () => USE_MOCK ? Promise.resolve(mockFaculties) : unwrap<Faculty[]>(apiClient.get("/admin/faculties")),
  createFaculty: (payload: Pick<Faculty, "code" | "name">) => USE_MOCK ? Promise.resolve({ id: crypto.randomUUID(), ...payload }) : unwrap<Faculty>(apiClient.post("/admin/faculties", payload)),
  deleteFaculty: (id: string) => USE_MOCK ? Promise.resolve({}) : unwrap(apiClient.delete(`/admin/faculties/${id}`)),
  classes: () => USE_MOCK ? Promise.resolve(mockClasses) : unwrap<ClassRoom[]>(apiClient.get("/admin/classes")),
  classStudents: (classId: string) => USE_MOCK ? Promise.resolve(mockUsers.filter((user) => user.role === "STUDENT" && user.classId === classId)) : unwrap<User[]>(apiClient.get(`/admin/classes/${classId}/students`)),
  importClassStudents: (classId: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ totalRows: number; successRows: number; failedRows: number; errors: Array<{ row: number; message: string }> }>(
      apiClient.post(`/admin/classes/${classId}/import-students`, data)
    );
  },
  importStudentsByClass: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ totalRows: number; successRows: number; failedRows: number; errors: Array<{ row: number; message: string }> }>(
      apiClient.post("/admin/classes/import-students", data)
    );
  },
  createClass: (payload: Pick<ClassRoom, "code" | "name" | "facultyId">) => USE_MOCK ? Promise.resolve({ id: crypto.randomUUID(), ...payload }) : unwrap<ClassRoom>(apiClient.post("/admin/classes", payload)),
  deleteClass: (id: string) => USE_MOCK ? Promise.resolve({}) : unwrap(apiClient.delete(`/admin/classes/${id}`)),
  importClasses: (file: File) => {
    if (USE_MOCK) return Promise.resolve({ totalRows: 0, successRows: 0, failedRows: 0, errors: [] });
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ totalRows: number; successRows: number; failedRows: number; errors: Array<{ row: number; message: string }> }>(
      apiClient.post("/admin/classes/import", data)
    );
  },
  subjects: () => USE_MOCK ? Promise.resolve(mockSubjects) : unwrap<Subject[]>(apiClient.get("/admin/subjects")),
  createSubject: (payload: Pick<Subject, "code" | "name" | "credits" | "facultyId">) => USE_MOCK ? Promise.resolve({ id: crypto.randomUUID(), ...payload }) : unwrap<Subject>(apiClient.post("/admin/subjects", payload)),
  deleteSubject: (id: string) => USE_MOCK ? Promise.resolve({}) : unwrap(apiClient.delete(`/admin/subjects/${id}`)),
  semesters: () => USE_MOCK ? Promise.resolve(mockSemesters) : unwrap<Semester[]>(apiClient.get("/admin/semesters")),
  createSemester: (payload: Pick<Semester, "name" | "startDate" | "endDate">) => USE_MOCK ? Promise.resolve({ id: crypto.randomUUID(), ...payload }) : unwrap<Semester>(apiClient.post("/admin/semesters", payload)),
  deleteSemester: (id: string) => USE_MOCK ? Promise.resolve({}) : unwrap(apiClient.delete(`/admin/semesters/${id}`)),
  sections: () => USE_MOCK ? Promise.resolve(mockSections) : unwrap<CourseSection[]>(apiClient.get("/admin/sections")),
  createSection: (payload: { code: string; subjectId: string; semesterId: string; teacherId: string; absenceThresholdPercent?: number }) =>
    USE_MOCK ? Promise.resolve({ id: crypto.randomUUID(), code: payload.code }) : unwrap<CourseSection>(apiClient.post("/admin/sections", payload)),
  deleteSection: (id: string) => USE_MOCK ? Promise.resolve({}) : unwrap(apiClient.delete(`/admin/sections/${id}`)),
  importSections: (file: File) => {
    if (USE_MOCK) return Promise.resolve({ totalRows: 0, successRows: 0, failedRows: 0, errors: [] });
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ totalRows: number; successRows: number; failedRows: number; errors: Array<{ row: number; message: string }> }>(
      apiClient.post("/admin/sections/import", data)
    );
  },
  sectionStudents: (sectionId: string) =>
    USE_MOCK
      ? Promise.resolve(
        sectionId === "sec1"
          ? mockUsers
            .filter((user) => user.role === "STUDENT")
            .map((student, index) => ({ student: { ...student, class: mockClasses[index < 4 ? 0 : 1] } }))
          : []
      )
      : unwrap<StudentInSection[]>(apiClient.get(`/admin/sections/${sectionId}/students`)),
  overview: () => USE_MOCK ? Promise.resolve({
    summary: { attendancePercent: 91, sessionCount: 3, warningCount: 0 },
    sections: mockSections.map((section) => ({
      id: section.id,
      code: section.code,
      subject: section.subject,
      teacher: section.teacher,
      totalStudents: section._count?.enrollments ?? 0,
      totalSessions: section._count?.sessions ?? 0,
      attendancePercent: 91,
      warningCount: 0,
      thresholdPercent: 20
    })),
    warnings: []
  }) : unwrap(apiClient.get("/admin/reports/overview")),
  sendAttendanceWarnings: () => USE_MOCK
    ? Promise.resolve({ studentNotifications: 0, teacherNotifications: 0, totalNotifications: 0 })
    : unwrap<{ studentNotifications: number; teacherNotifications: number; totalNotifications: number }>(
      apiClient.post("/admin/reports/send-attendance-warnings")
    ),
  importStudents: (sectionId: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return unwrap(apiClient.post(`/admin/sections/${sectionId}/import-students`, data));
  }
};
