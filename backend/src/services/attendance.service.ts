import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/http.js";
import { createQrToken, currentWindow, generateOtp, verifyOtpAndQr } from "../utils/qrOtp.js";

const lessonEndAt = (lessonDate: Date, endTime: string) =>
  new Date(`${lessonDate.toISOString().slice(0, 10)}T${endTime}:00+07:00`);

const lessonStartAt = (lessonDate: Date, startTime: string) =>
  new Date(`${lessonDate.toISOString().slice(0, 10)}T${startTime}:00+07:00`);

export const isLessonEnded = (lesson: { lessonDate: Date; endTime: string }, now = new Date()) =>
  lessonEndAt(lesson.lessonDate, lesson.endTime).getTime() <= now.getTime();

export const isLessonStarted = (lesson: { lessonDate: Date; startTime: string }, now = new Date()) =>
  lessonStartAt(lesson.lessonDate, lesson.startTime).getTime() <= now.getTime();

export const ensureTeacherOwnsSection = async (teacherId: string, sectionId: string) => {
  const section = await prisma.courseSection.findFirst({ where: { id: sectionId, teacherId } });
  if (!section) throw new AppError(403, "SECTION_FORBIDDEN", "Giảng viên không phụ trách lớp học phần này.");
  return section;
};

export const ensureStudentEnrolled = async (studentId: string, sectionId: string) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseSectionId_studentId: { courseSectionId: sectionId, studentId } }
  });
  if (!enrollment) throw new AppError(403, "NOT_ENROLLED", "Sinh viên không thuộc lớp học phần này.");
};

export const buildQrOtp = async (sessionId: string) => {
  await closeExpiredSession(sessionId);
  const session = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.status !== "OPEN") throw new AppError(400, "SESSION_CLOSED", "Phiên điểm danh đã đóng.");
  const window = currentWindow();
  const qrToken = createQrToken({ sessionId: session.id, courseSectionId: session.courseSectionId, window, nonce: session.nonce });
  const appUrl = env.PUBLIC_APP_URL ?? env.FRONTEND_ORIGIN.split(",")[0]?.trim() ?? "http://localhost:5173";
  const attendanceUrl = new URL("/student/attendance", appUrl);
  attendanceUrl.searchParams.set("qrToken", qrToken);
  const qrDataUrl = await QRCode.toDataURL(attendanceUrl.toString());
  return {
    sessionId,
    qrToken,
    qrUrl: attendanceUrl.toString(),
    qrDataUrl,
    otp: generateOtp(session.id, session.nonce, window),
    validSeconds: 30 - (Math.floor(Date.now() / 1000) % 30)
  };
};

export const createAttendanceForStudent = async (studentId: string, qrToken: string, otp: string) => {
  let token = qrToken.trim();
  try {
    token = new URL(token).searchParams.get("qrToken") ?? token;
  } catch {
    // Raw QR token, nothing to normalize.
  }
  let payloadSession: { sessionId?: string };
  try {
    payloadSession = JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8")) as { sessionId?: string };
  } catch {
    throw new AppError(400, "INVALID_QR", "QR token khong hop le.");
  }
  if (!payloadSession.sessionId) throw new AppError(400, "INVALID_QR", "QR token khong hop le.");

  await closeExpiredSession(payloadSession.sessionId);
  const session = await prisma.attendanceSession.findUnique({ where: { id: payloadSession.sessionId } });
  if (!session || session.status !== "OPEN") throw new AppError(400, "SESSION_NOT_OPEN", "Phiên điểm danh không mở.");

  await ensureStudentEnrolled(studentId, session.courseSectionId);
  verifyOtpAndQr(token, otp, session);

  try {
    return await prisma.attendanceRecord.create({
      data: {
        attendanceSessionId: session.id,
        studentId,
        status: "PRESENT",
        method: "QR_OTP"
      }
    });
  } catch {
    throw new AppError(409, "ALREADY_ATTENDED", "Sinh viên đã điểm danh trong phiên này.");
  }
};

export const closeSessionAndMarkAbsent = async (sessionId: string) => {
  const session = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sessionId } });
  const enrollments = await prisma.enrollment.findMany({ where: { courseSectionId: session.courseSectionId } });

  await prisma.$transaction(async (tx) => {
    for (const enrollment of enrollments) {
      await tx.attendanceRecord.upsert({
        where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId: enrollment.studentId } },
        update: {},
        create: {
          attendanceSessionId: session.id,
          studentId: enrollment.studentId,
          status: "ABSENT_UNEXCUSED",
          method: "SYSTEM",
          reason: "Tự động đánh vắng khi kết thúc phiên."
        }
      });
    }
    await tx.attendanceSession.update({ where: { id: session.id }, data: { status: "CLOSED", closedAt: new Date() } });
  });
};

export const closeExpiredSession = async (sessionId: string) => {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { lesson: true }
  });
  if (!session || session.status !== "OPEN" || !isLessonEnded(session.lesson)) return false;
  await closeSessionAndMarkAbsent(session.id);
  return true;
};

export const closeExpiredSessions = async (courseSectionId?: string) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { status: "OPEN", ...(courseSectionId ? { courseSectionId } : {}) },
    include: { lesson: true }
  });
  let closed = 0;
  for (const session of sessions) {
    if (!isLessonEnded(session.lesson)) continue;
    await closeSessionAndMarkAbsent(session.id);
    closed += 1;
  }
  return closed;
};

export const newSessionNonce = () => nanoid(24);
