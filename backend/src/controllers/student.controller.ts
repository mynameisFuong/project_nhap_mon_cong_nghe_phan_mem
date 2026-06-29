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
  if (!req.file) throw new AppError(422, "EVIDENCE_REQUIRED", "Don xin phep can file minh chung.");
  const evidencePath = req.file.path;
  const input = z.object({
    attendanceRecordId: z.string().uuid().optional(),
    attendanceSessionId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional(),
    reason: z.string().trim().min(2, "Ly do can co it nhat 2 ky tu.")
  }).refine((data) => data.attendanceRecordId || data.attendanceSessionId || data.lessonId, {
    message: "Vui long chon buoi hoc hoac buoi vang.",
    path: ["attendanceRecordId"]
  }).parse(req.body);

  const student = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const record = input.attendanceRecordId || input.attendanceSessionId
    ? input.attendanceRecordId
      ? await prisma.attendanceRecord.findFirst({
        where: { id: input.attendanceRecordId, studentId: req.user!.id },
        include: { attendanceSession: { include: { lesson: { include: { courseSection: { include: { subject: true } } } }, courseSection: { include: { subject: true } } } } }
      })
      : await prisma.attendanceRecord.findUnique({
        where: { attendanceSessionId_studentId: { attendanceSessionId: input.attendanceSessionId!, studentId: req.user!.id } },
        include: { attendanceSession: { include: { lesson: { include: { courseSection: { include: { subject: true } } } }, courseSection: { include: { subject: true } } } } }
      })
    : null;

  if ((input.attendanceRecordId || input.attendanceSessionId) && (!record || record.status !== "ABSENT_UNEXCUSED")) {
    throw new AppError(400, "NOT_ABSENT", "Chi gui don cho buoi vang khong phep.");
  }

  const lesson = record?.attendanceSession.lesson ?? await prisma.lesson.findFirst({
    where: {
      id: input.lessonId,
      courseSection: { enrollments: { some: { studentId: req.user!.id } } }
    },
    include: { courseSection: { include: { subject: true } } }
  });
  if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Khong tim thay buoi hoc trong lich cua sinh vien.");

  const existingLeave = await prisma.leaveRequest.findUnique({
    where: { lessonId_studentId: { lessonId: lesson.id, studentId: req.user!.id } }
  });
  if (existingLeave && existingLeave.status !== "REJECTED") {
    throw new AppError(409, "LEAVE_ALREADY_EXISTS", "Ban da gui don cho buoi hoc nay.");
  }

  const session = record?.attendanceSession;
  const leave = await prisma.$transaction(async (tx) => {
    const created = existingLeave
      ? await tx.leaveRequest.update({
        where: { id: existingLeave.id },
        data: {
          status: "PENDING",
          reason: input.reason,
          evidencePath,
          attendanceSessionId: session?.id ?? null,
          attendanceRecordId: record?.id ?? null,
          reviewNote: null,
          reviewedById: null,
          reviewedAt: null
        }
      })
      : await tx.leaveRequest.create({
        data: {
          lessonId: lesson.id,
          attendanceSessionId: session?.id,
          attendanceRecordId: record?.id,
          studentId: req.user!.id,
          reason: input.reason,
          evidencePath
        }
      });
    await tx.notification.create({
      data: {
        userId: lesson.courseSection.teacherId,
        title: "Don xin phep moi",
        message: `${student.fullName} (${student.studentCode ?? student.email}) da gui don xin phep cho lop ${lesson.courseSection.code} - ${lesson.courseSection.subject.name}, ngay ${lesson.lessonDate.toISOString().slice(0, 10)}.`
      }
    });
    return created;
  });
  ok(res, leave, 201);
});

export const myLeaveRequests = asyncHandler(async (req, res) => {
  ok(res, await prisma.leaveRequest.findMany({
    where: { studentId: req.user!.id },
    include: {
      lesson: { include: { courseSection: { include: { subject: true } } } },
      attendanceSession: { include: { lesson: true, courseSection: { include: { subject: true } } } }
    },
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
