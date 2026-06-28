import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { closeExpiredSessions, createAttendanceForStudent } from "../services/attendance.service.js";
import { asyncHandler, AppError, ok } from "../utils/http.js";

export const myEnrollments = asyncHandler(async (req, res) => {
  ok(res, await prisma.enrollment.findMany({
    where: { studentId: req.user!.id },
    include: { courseSection: { include: { subject: true, semester: true, teacher: { select: { fullName: true, email: true } } } } }
  }));
});

export const mySchedule = asyncHandler(async (req, res) => {
  await closeExpiredSessions();
  const lessons = await prisma.lesson.findMany({
    where: { courseSection: { enrollments: { some: { studentId: req.user!.id } } } },
    include: { courseSection: { include: { subject: true, teacher: { select: { fullName: true } } } }, sessions: { orderBy: { openedAt: "desc" } } },
    orderBy: { lessonDate: "asc" }
  });
  ok(res, lessons.map((lesson) => ({ ...lesson, session: lesson.sessions[0] ?? null })));
});

export const submitAttendance = asyncHandler(async (req, res) => {
  const input = z.object({ qrToken: z.string().min(20), otp: z.string().regex(/^\d{4,6}$/) }).parse(req.body);
  ok(res, await createAttendanceForStudent(req.user!.id, input.qrToken, input.otp), 201);
});

export const myAttendanceHistory = asyncHandler(async (req, res) => {
  ok(res, await prisma.attendanceRecord.findMany({
    where: { studentId: req.user!.id },
    include: { attendanceSession: { include: { lesson: true, courseSection: { include: { subject: true, semester: true } } } } },
    orderBy: { markedAt: "desc" }
  }));
});

export const createLeaveRequest = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "EVIDENCE_REQUIRED", "Đơn xin phép cần file minh chứng.");
  const evidencePath = req.file.path;
  const input = z.object({
    attendanceRecordId: z.string().uuid().optional(),
    attendanceSessionId: z.string().uuid().optional(),
    reason: z.string().trim().min(2, "Lý do cần có ít nhất 2 ký tự.")
  }).refine((data) => data.attendanceRecordId || data.attendanceSessionId, {
    message: "Vui lòng chọn buổi vắng.",
    path: ["attendanceRecordId"]
  }).parse(req.body);
  const record = input.attendanceRecordId
    ? await prisma.attendanceRecord.findFirst({
      where: { id: input.attendanceRecordId, studentId: req.user!.id },
      include: { attendanceSession: { include: { lesson: true, courseSection: { include: { subject: true } } } } }
    })
    : await prisma.attendanceRecord.findUnique({
      where: { attendanceSessionId_studentId: { attendanceSessionId: input.attendanceSessionId!, studentId: req.user!.id } },
      include: { attendanceSession: { include: { lesson: true, courseSection: { include: { subject: true } } } } }
    });
  if (!record || !["ABSENT_UNEXCUSED", "ABSENT_EXCUSED"].includes(record.status)) {
    throw new AppError(400, "NOT_ABSENT", "Chỉ gửi đơn cho buổi đã bị đánh dấu vắng.");
  }
  const existingLeave = await prisma.leaveRequest.findUnique({ where: { attendanceRecordId: record.id } });
  if (existingLeave) {
    throw new AppError(409, "LEAVE_ALREADY_EXISTS", "Bạn đã gửi đơn cho buổi vắng này.");
  }
  const session = record.attendanceSession;
  const student = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const leave = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        attendanceSessionId: record.attendanceSessionId,
        attendanceRecordId: record.id,
        studentId: req.user!.id,
        reason: input.reason,
        evidencePath
      }
    });
    await tx.notification.create({
      data: {
        userId: session.courseSection.teacherId,
        title: "Đơn xin phép mới",
        message: `${student.fullName} (${student.studentCode ?? student.email}) đã gửi đơn xin phép cho lớp ${session.courseSection.code} - ${session.courseSection.subject.name}, ngày ${session.lesson.lessonDate.toISOString().slice(0, 10)}.`
      }
    });
    return created;
  });
  ok(res, leave, 201);
});

export const myLeaveRequests = asyncHandler(async (req, res) => {
  ok(res, await prisma.leaveRequest.findMany({
    where: { studentId: req.user!.id },
    include: { attendanceSession: { include: { lesson: true, courseSection: { include: { subject: true } } } } },
    orderBy: { createdAt: "desc" }
  }));
});

export const myNotifications = asyncHandler(async (req, res) => {
  ok(res, await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } }));
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date() }
  });
  ok(res, { updated: result.count });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id, readAt: null },
    data: { readAt: new Date() }
  });
  ok(res, { updated: notification.count });
});
