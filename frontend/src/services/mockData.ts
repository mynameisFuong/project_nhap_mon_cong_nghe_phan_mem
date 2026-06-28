import type { AttendanceRecord, ClassRoom, CourseSection, Faculty, LeaveRequest, Lesson, NotificationItem, Semester, Subject, User } from "../types";

export const mockUsers: User[] = [
  { id: "u1", email: "admin@school.test", fullName: "Quản trị viên", role: "ADMIN", status: "ACTIVE", createdAt: "2026-06-26" },
  { id: "u2", email: "gv1@school.test", fullName: "Nguyễn Văn Giảng", role: "TEACHER", status: "ACTIVE", teacherCode: "GV001", createdAt: "2026-06-26" },
  { id: "u3", email: "gv2@school.test", fullName: "Trần Thị Dạy", role: "TEACHER", status: "ACTIVE", teacherCode: "GV002", createdAt: "2026-06-26" },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `s${index + 1}`,
    email: `sv${String(index + 1).padStart(3, "0")}@school.test`,
    fullName: `Sinh viên ${index + 1}`,
    role: "STUDENT" as const,
    status: "ACTIVE" as const,
    studentCode: `SV${String(index + 1).padStart(3, "0")}`,
    createdAt: "2026-06-26"
  }))
];

export const mockFaculties: Faculty[] = [
  { id: "f1", code: "FIT", name: "Công nghệ thông tin" },
  { id: "f2", code: "FBA", name: "Quản trị kinh doanh" }
];

export const mockClasses: ClassRoom[] = [
  { id: "c1", code: "DCT1221", name: "DCT1221", faculty: mockFaculties[0] },
  { id: "c2", code: "DCT1222", name: "DCT1222", faculty: mockFaculties[0] }
];

export const mockSubjects: Subject[] = [
  { id: "sub1", code: "SE101", name: "Nhập môn Công nghệ phần mềm", credits: 3, faculty: mockFaculties[0] },
  { id: "sub2", code: "DB101", name: "Cơ sở dữ liệu", credits: 3, faculty: mockFaculties[0] },
  { id: "sub3", code: "MKT101", name: "Marketing căn bản", credits: 2, faculty: mockFaculties[1] }
];

export const mockSemesters: Semester[] = [
  { id: "sem1", name: "HK1 2026-2027", startDate: "2026-09-01", endDate: "2027-01-15" }
];

export const mockSections: CourseSection[] = [
  { id: "sec1", code: "SE101-01", subject: mockSubjects[0], semester: mockSemesters[0], teacher: mockUsers[1], status: "ACTIVE", _count: { enrollments: 8, sessions: 2 } },
  { id: "sec2", code: "DB101-01", subject: mockSubjects[1], semester: mockSemesters[0], teacher: mockUsers[2], status: "ACTIVE", _count: { enrollments: 6, sessions: 1 } },
  { id: "sec3", code: "MKT101-01", subject: mockSubjects[2], semester: mockSemesters[0], teacher: mockUsers[2], status: "ACTIVE", _count: { enrollments: 0, sessions: 0 } }
];

export const mockLessons: Lesson[] = [
  { id: "l1", lessonDate: "2026-09-10", startTime: "07:30", endTime: "10:00", room: "A101", topic: "Giới thiệu môn học" },
  { id: "l2", lessonDate: "2026-09-17", startTime: "07:30", endTime: "10:00", room: "A101", topic: "Yêu cầu phần mềm" }
];

export const mockRecords: AttendanceRecord[] = mockUsers
  .filter((user) => user.role === "STUDENT")
  .map((student, index) => ({
    id: `r${index}`,
    status: index < 5 ? "PRESENT" : index === 5 ? "LATE" : "ABSENT_UNEXCUSED",
    method: index < 5 ? "QR_OTP" : "SYSTEM",
    markedAt: "2026-09-10T08:00:00",
    reason: index > 5 ? "Chưa điểm danh" : null,
    student,
    attendanceSession: {
      id: "sess1",
      courseSectionId: "sec1",
      lessonId: "l1",
      status: "CLOSED",
      openedAt: "2026-09-10T07:30:00",
      courseSection: mockSections[0],
      lesson: mockLessons[0]
    }
  }));

export const mockLeaves: LeaveRequest[] = [
  { id: "lv1", reason: "Bị ốm, có giấy xác nhận.", evidencePath: "sample.pdf", status: "PENDING", createdAt: "2026-09-11", student: mockUsers[8] },
  { id: "lv2", reason: "Việc gia đình.", evidencePath: "family.pdf", status: "APPROVED", createdAt: "2026-09-12", student: mockUsers[9], reviewNote: "Đã duyệt" }
];

export const mockNotifications: NotificationItem[] = [
  { id: "n1", title: "Đơn xin phép", message: "Đơn xin phép của bạn đang chờ duyệt.", createdAt: "2026-09-12", readAt: null },
  { id: "n2", title: "Cảnh báo chuyên cần", message: "Tỉ lệ vắng của bạn đang gần ngưỡng 20%.", createdAt: "2026-09-13", readAt: null }
];
