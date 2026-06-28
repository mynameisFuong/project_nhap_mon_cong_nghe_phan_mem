import type { AttendanceStatus, Role } from "../types";

export const roleText: Record<Role, string> = {
  ADMIN: "Admin",
  TEACHER: "Giảng viên",
  STUDENT: "Sinh viên"
};

export const attendanceText: Record<AttendanceStatus, string> = {
  PRESENT: "Có mặt",
  LATE: "Trễ",
  ABSENT_EXCUSED: "Vắng có phép",
  ABSENT_UNEXCUSED: "Vắng không phép"
};

export const attendanceTone = (status: AttendanceStatus) => {
  if (status === "PRESENT") return "success";
  if (status === "LATE") return "warning";
  if (status === "ABSENT_EXCUSED") return "info";
  return "danger";
};

export const shortDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
};

export const shortTime = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
};
