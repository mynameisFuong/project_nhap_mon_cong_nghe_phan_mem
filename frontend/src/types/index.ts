export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status?: "ACTIVE" | "LOCKED";
  studentCode?: string | null;
  teacherCode?: string | null;
  classId?: string | null;
  createdAt?: string;
};

export type Faculty = { id: string; code: string; name: string };
export type ClassRoom = { id: string; code: string; name: string; faculty?: Faculty; facultyId?: string };
export type Subject = { id: string; code: string; name: string; credits: number; faculty?: Faculty; facultyId?: string };
export type Semester = { id: string; name: string; startDate: string; endDate: string };

export type CourseSection = {
  id: string;
  code: string;
  status?: string;
  absenceThresholdPercent?: string | number;
  subject?: Subject;
  semester?: Semester;
  teacher?: Pick<User, "id" | "fullName" | "email">;
  _count?: { enrollments?: number; sessions?: number };
};

export type StudentInSection = {
  student: User & { class?: ClassRoom };
};

export type Lesson = {
  id: string;
  courseSectionId?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  topic?: string;
  session?: AttendanceSession | null;
  sessions?: AttendanceSession[];
};

export type AttendanceSession = {
  id: string;
  courseSectionId: string;
  lessonId: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
};

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT_EXCUSED" | "ABSENT_UNEXCUSED";

export type AttendanceRecord = {
  id: string;
  status: AttendanceStatus;
  method: string;
  markedAt: string;
  reason?: string | null;
  student?: User;
  attendanceSession?: AttendanceSession & {
    lesson?: Lesson;
    courseSection?: CourseSection;
  };
};

export type AttendanceSessionSummary = {
  session: AttendanceSession & {
    lesson?: Lesson;
    courseSection?: CourseSection;
  };
  attended: AttendanceRecord[];
  notAttended: Array<AttendanceRecord | StudentInSection>;
};

export type LeaveRequest = {
  id: string;
  reason: string;
  evidencePath: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string | null;
  createdAt: string;
  student?: User;
  attendanceSession?: AttendanceSession & {
    lesson?: Lesson;
    courseSection?: CourseSection;
  };
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
};

export type ApiResponse<T> = { success: boolean; data: T };
