import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import readXlsxFile from "read-excel-file/node";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { buildQrOtp, closeExpiredSession, closeExpiredSessions, closeSessionAndMarkAbsent, ensureStudentEnrolled, ensureTeacherOwnsSection, isLessonEnded, isLessonStarted, newSessionNonce } from "../services/attendance.service.js";
import { asyncHandler, AppError, ok } from "../utils/http.js";

type ExcelCell = string | number | boolean | Date | null;
type ExcelTable = ExcelCell[][];
type ExcelSheet = { sheet: string; data: ExcelTable };

const firstSheetRows = (workbook: unknown): ExcelTable => {
  if (!Array.isArray(workbook)) return [];
  if (Array.isArray(workbook[0])) return workbook as ExcelTable;
  const firstSheet = workbook[0] as Partial<ExcelSheet> | undefined;
  return Array.isArray(firstSheet?.data) ? firstSheet.data : [];
};

const parseCsv = (content: string): ExcelTable => {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const readTableFile = async (filePath: string): Promise<ExcelTable> => {
  if (path.extname(filePath).toLowerCase() === ".csv") {
    return parseCsv(await fs.readFile(filePath, "utf8"));
  }
  return firstSheetRows(await readXlsxFile(filePath));
};

const rowValue = (row: Record<string, ExcelCell>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return "";
};

const cellToDateInput = (value: ExcelCell) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return text;
};

const cellToTimeInput = (value: ExcelCell) => {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : text;
};

const attachLatestSession = <T extends { sessions?: unknown[] }>(lesson: T) => ({
  ...lesson,
  session: lesson.sessions?.[0] ?? null
});

export const mySections = asyncHandler(async (req, res) => {
  ok(res, await prisma.courseSection.findMany({
    where: { teacherId: req.user!.id },
    include: { subject: true, semester: true, _count: { select: { enrollments: true, sessions: true } } }
  }));
});

export const sectionStudents = asyncHandler(async (req, res) => {
  await ensureTeacherOwnsSection(req.user!.id, req.params.sectionId);
  ok(res, await prisma.enrollment.findMany({
    where: { courseSectionId: req.params.sectionId },
    include: { student: { select: { id: true, studentCode: true, fullName: true, email: true, class: true } } }
  }));
});

export const sectionLessons = asyncHandler(async (req, res) => {
  await ensureTeacherOwnsSection(req.user!.id, req.params.sectionId);
  await closeExpiredSessions(req.params.sectionId);
  const lessons = await prisma.lesson.findMany({
    where: { courseSectionId: req.params.sectionId },
    include: {
      courseSection: {
        include: {
          subject: true,
          teacher: { select: { id: true, fullName: true, email: true } }
        }
      },
      sessions: { orderBy: { openedAt: "desc" } }
    },
    orderBy: { lessonDate: "asc" }
  });
  ok(res, lessons.map(attachLatestSession));
});

export const createSectionLesson = asyncHandler(async (req, res) => {
  await ensureTeacherOwnsSection(req.user!.id, req.params.sectionId);
  const input = z.object({
    lessonDate: z.coerce.date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    room: z.string().trim().optional(),
    topic: z.string().trim().optional()
  }).parse(req.body);

  if (input.endTime <= input.startTime) {
    throw new AppError(422, "INVALID_TIME_RANGE", "Giờ kết thúc phải sau giờ bắt đầu.");
  }

  const lesson = await prisma.lesson.create({
    data: {
      courseSectionId: req.params.sectionId,
      lessonDate: input.lessonDate,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room,
      topic: input.topic
    },
    include: { sessions: true }
  });

  ok(res, attachLatestSession(lesson), 201);
});

export const importSectionLessons = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cần upload file Excel hoặc CSV.");
  await ensureTeacherOwnsSection(req.user!.id, req.params.sectionId);

  const table = await readTableFile(req.file.path);
  if (table.length < 2) throw new AppError(422, "EMPTY_FILE", "File không có dữ liệu lịch học.");

  const headers = table[0].map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const rows = table.slice(1).map((values) => {
    const item: Record<string, ExcelCell> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = values[index] ?? "";
    });
    return item;
  });

  let successRows = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (const [index, row] of rows.entries()) {
    const lessonDate = cellToDateInput(rowValue(row, ["Ngày học", "Ngay hoc", "Ngày", "Ngay", "Date", "date"]));
    const startTime = cellToTimeInput(rowValue(row, ["Bắt đầu", "Bat dau", "Giờ bắt đầu", "Gio bat dau", "Start", "startTime"]));
    const endTime = cellToTimeInput(rowValue(row, ["Kết thúc", "Ket thuc", "Giờ kết thúc", "Gio ket thuc", "End", "endTime"]));
    const room = String(rowValue(row, ["Phòng", "Phong", "Room", "room"]) ?? "").trim();
    const topic = String(rowValue(row, ["Nội dung", "Noi dung", "Chủ đề", "Chu de", "Topic", "topic"]) ?? "").trim();

    try {
      if (!lessonDate || !startTime || !endTime) throw new Error("Thiếu Ngày học, Bắt đầu hoặc Kết thúc.");
      const input = z.object({
        lessonDate: z.coerce.date(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/)
      }).parse({ lessonDate, startTime, endTime });

      if (input.endTime <= input.startTime) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");

      await prisma.lesson.upsert({
        where: {
          courseSectionId_lessonDate_startTime: {
            courseSectionId: req.params.sectionId,
            lessonDate: input.lessonDate,
            startTime: input.startTime
          }
        },
        update: {
          endTime: input.endTime,
          room: room || null,
          topic: topic || null
        },
        create: {
          courseSectionId: req.params.sectionId,
          lessonDate: input.lessonDate,
          startTime: input.startTime,
          endTime: input.endTime,
          room: room || undefined,
          topic: topic || undefined
        }
      });
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Import lỗi." });
    }
  }

  const log = await prisma.importLog.create({
    data: {
      courseSectionId: req.params.sectionId,
      importedById: req.user!.id,
      fileName: req.file.originalname,
      totalRows: rows.length,
      successRows,
      failedRows: errors.length,
      errorDetails: errors
    }
  });

  ok(res, { log, totalRows: rows.length, successRows, failedRows: errors.length, errors });
});

export const createSession = asyncHandler(async (req, res) => {
  const input = z.object({ lessonId: z.string().uuid() }).parse(req.body);
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: input.lessonId },
    include: { sessions: true }
  });
  await ensureTeacherOwnsSection(req.user!.id, lesson.courseSectionId);
  await closeExpiredSessions();

  const openSession = await prisma.attendanceSession.findFirst({
    where: {
      status: "OPEN",
      courseSection: { teacherId: req.user!.id }
    },
    include: { lesson: true, courseSection: true },
    orderBy: { openedAt: "desc" }
  });
  if (openSession) {
    throw new AppError(409, "OPEN_SESSION_EXISTS", `Bạn đang có phiên điểm danh đang mở ở lớp ${openSession.courseSection.code}, ngày ${openSession.lesson.lessonDate.toISOString().slice(0, 10)} lúc ${openSession.lesson.startTime}. Vui lòng kết thúc phiên đó trước.`);
  }

  if (!isLessonStarted(lesson)) {
    throw new AppError(422, "LESSON_NOT_STARTED", "Chưa đến giờ bắt đầu buổi học, không thể tạo phiên điểm danh.");
  }

  if (isLessonEnded(lesson)) {
    throw new AppError(422, "LESSON_ENDED", "Buổi học đã kết thúc, không thể tạo phiên điểm danh.");
  }

  const session = await prisma.attendanceSession.create({
    data: {
      courseSectionId: lesson.courseSectionId,
      lessonId: lesson.id,
      nonce: newSessionNonce(),
      createdById: req.user!.id
    }
  });
  ok(res, session, 201);
});

export const currentOpenSession = asyncHandler(async (req, res) => {
  await closeExpiredSessions();
  const session = await prisma.attendanceSession.findFirst({
    where: {
      status: "OPEN",
      courseSection: { teacherId: req.user!.id }
    },
    include: {
      lesson: true,
      courseSection: { include: { subject: true } }
    },
    orderBy: { openedAt: "desc" }
  });
  ok(res, session);
});

export const currentQrOtp = asyncHandler(async (req, res) => {
  const session = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });
  await ensureTeacherOwnsSection(req.user!.id, session.courseSectionId);
  ok(res, await buildQrOtp(session.id));
});

export const sessionRecords = asyncHandler(async (req, res) => {
  const session = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });
  await ensureTeacherOwnsSection(req.user!.id, session.courseSectionId);
  await closeExpiredSession(session.id);
  ok(res, await prisma.attendanceRecord.findMany({
    where: { attendanceSessionId: session.id },
    include: { student: { select: { id: true, studentCode: true, fullName: true, email: true } } },
    orderBy: { markedAt: "desc" }
  }));
});

export const sessionSummary = asyncHandler(async (req, res) => {
  await closeExpiredSession(req.params.sessionId);
  const session = await prisma.attendanceSession.findUniqueOrThrow({
    where: { id: req.params.sessionId },
    include: { lesson: true, courseSection: { include: { subject: true } } }
  });
  await ensureTeacherOwnsSection(req.user!.id, session.courseSectionId);

  const [records, enrollments] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: session.id },
      include: { student: { select: { id: true, studentCode: true, fullName: true, email: true, class: true } } },
      orderBy: { markedAt: "desc" }
    }),
    prisma.enrollment.findMany({
      where: { courseSectionId: session.courseSectionId },
      include: { student: { select: { id: true, studentCode: true, fullName: true, email: true, class: true } } },
      orderBy: { student: { fullName: "asc" } }
    })
  ]);

  const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
  const sectionRecords = records.filter((record) => enrolledIds.has(record.studentId));
  const attended = sectionRecords.filter((record) => ["PRESENT", "LATE"].includes(record.status));
  const attendedIds = new Set(attended.map((record) => record.studentId));
  const absentByStudentId = new Map(
    sectionRecords
      .filter((record) => record.status.startsWith("ABSENT"))
      .map((record) => [record.studentId, record])
  );
  const notAttended = enrollments
    .filter((enrollment) => !attendedIds.has(enrollment.studentId))
    .map((enrollment) => absentByStudentId.get(enrollment.studentId) ?? enrollment);

  ok(res, { session, attended, notAttended });
});

export const exportSessionAttendedExcel = asyncHandler(async (req, res) => {
  const session = await prisma.attendanceSession.findUniqueOrThrow({
    where: { id: req.params.sessionId },
    include: { lesson: true, courseSection: { include: { subject: true } } }
  });
  await ensureTeacherOwnsSection(req.user!.id, session.courseSectionId);

  const records = await prisma.attendanceRecord.findMany({
    where: { attendanceSessionId: session.id, status: { in: ["PRESENT", "LATE"] } },
    include: { student: { include: { class: true } } },
    orderBy: [{ markedAt: "asc" }]
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Da diem danh");
  sheet.columns = [
    { header: "STT", key: "index", width: 8 },
    { header: "MSSV", key: "studentCode", width: 16 },
    { header: "Ho ten", key: "fullName", width: 28 },
    { header: "Email", key: "email", width: 30 },
    { header: "Lop", key: "classCode", width: 14 },
    { header: "Trang thai", key: "status", width: 18 },
    { header: "Hinh thuc", key: "method", width: 16 },
    { header: "Thoi gian diem danh", key: "markedAt", width: 24 },
    { header: "Ghi chu", key: "reason", width: 28 }
  ];
  sheet.getRow(1).font = { bold: true };

  records.forEach((record, index) => {
    sheet.addRow({
      index: index + 1,
      studentCode: record.student.studentCode ?? "",
      fullName: record.student.fullName,
      email: record.student.email,
      classCode: record.student.class?.code ?? "",
      status: record.status,
      method: record.method,
      markedAt: record.markedAt.toISOString(),
      reason: record.reason ?? ""
    });
  });

  res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.attachment(`attended-${session.courseSection.code}-${session.lesson.lessonDate.toISOString().slice(0, 10)}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

export const manualMark = asyncHandler(async (req, res) => {
  const input = z.object({
    studentId: z.string().uuid(),
    status: z.enum(["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED"]).default("PRESENT"),
    reason: z.string().min(3)
  }).parse(req.body);
  await closeExpiredSession(req.params.sessionId);
  const session = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });
  if (session.status !== "OPEN") throw new AppError(400, "SESSION_CLOSED", "Chỉ điểm danh thủ công khi phiên đang mở.");
  await ensureTeacherOwnsSection(req.user!.id, session.courseSectionId);
  await ensureStudentEnrolled(input.studentId, session.courseSectionId);

  const record = await prisma.attendanceRecord.upsert({
    where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId: input.studentId } },
    update: { status: input.status, reason: input.reason, method: "MANUAL", markedById: req.user!.id },
    create: { attendanceSessionId: session.id, studentId: input.studentId, status: input.status, method: "MANUAL", markedById: req.user!.id, reason: input.reason }
  });
  ok(res, record);
});

export const closeSession = asyncHandler(async (req, res) => {
  const session = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });
  await ensureTeacherOwnsSection(req.user!.id, session.courseSectionId);
  await closeSessionAndMarkAbsent(session.id);
  ok(res, { message: "Đã kết thúc phiên và đánh vắng sinh viên chưa điểm danh." });
});

export const updateRecordStatus = asyncHandler(async (req, res) => {
  const input = z.object({
    status: z.enum(["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED"]),
    reason: z.string().min(3)
  }).parse(req.body);
  const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: req.params.recordId }, include: { attendanceSession: true } });
  await ensureTeacherOwnsSection(req.user!.id, record.attendanceSession.courseSectionId);
  ok(res, await prisma.attendanceRecord.update({ where: { id: record.id }, data: { ...input, markedById: req.user!.id, method: "MANUAL" } }));
});

export const listLeaveRequests = asyncHandler(async (req, res) => {
  ok(res, await prisma.leaveRequest.findMany({
    where: { attendanceSession: { courseSection: { teacherId: req.user!.id } } },
    include: { student: { select: { id: true, fullName: true, studentCode: true } }, attendanceSession: { include: { lesson: true, courseSection: true } } },
    orderBy: { createdAt: "desc" }
  }));
});

export const myNotifications = asyncHandler(async (req, res) => {
  ok(res, await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 10
  }));
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date() }
  });
  ok(res, { updated: result.count });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id, readAt: null },
    data: { readAt: new Date() }
  });
  ok(res, { updated: result.count });
});

export const reviewLeaveRequest = asyncHandler(async (req, res) => {
  const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), reviewNote: z.string().optional() }).parse(req.body);
  const leave = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: req.params.id }, include: { attendanceSession: true } });
  await ensureTeacherOwnsSection(req.user!.id, leave.attendanceSession.courseSectionId);
  if (leave.status !== "PENDING") throw new AppError(409, "LEAVE_ALREADY_REVIEWED", "Don xin phep da duoc xu ly.");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.leaveRequest.update({
      where: { id: leave.id },
      data: { status: input.status, reviewNote: input.reviewNote, reviewedById: req.user!.id, reviewedAt: new Date() }
    });
    await tx.attendanceRecord.updateMany({
      where: { attendanceSessionId: leave.attendanceSessionId, studentId: leave.studentId },
      data: input.status === "APPROVED"
        ? { status: "ABSENT_EXCUSED", reason: "Don xin phep da duoc duyet." }
        : { status: "ABSENT_UNEXCUSED", reason: input.reviewNote || "Don xin phep bi tu choi." }
    });
    await tx.notification.create({
      data: {
        userId: leave.studentId,
        title: "Kết quả đơn xin phép",
        message: input.status === "APPROVED" ? "Đơn xin phép đã được duyệt." : "Đơn xin phép đã bị từ chối."
      }
    });
    return result;
  });
  ok(res, updated);
});

export const myAttendanceReport = asyncHandler(async (req, res) => {
  const sections = await prisma.courseSection.findMany({
    where: { teacherId: req.user!.id },
    include: {
      subject: true,
      semester: true,
      enrollments: {
        include: { student: { select: { id: true, studentCode: true, fullName: true, email: true, class: true } } }
      },
      sessions: {
        where: { status: "CLOSED" },
        include: { records: { select: { studentId: true, status: true } } }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const reports = sections.map((section) => {
    const thresholdPercent = Number(section.absenceThresholdPercent ?? 20);
    const totalSessions = section.sessions.length;
    const thresholdAbsences = totalSessions ? Math.ceil((totalSessions * thresholdPercent) / 100) : 0;
    const expected = section.enrollments.length * totalSessions;
    let presentCount = 0;

    const students = section.enrollments.map((enrollment) => {
      let studentPresentCount = 0;
      let lateCount = 0;
      let absentExcusedCount = 0;
      let absentUnexcusedCount = 0;

      for (const session of section.sessions) {
        const record = session.records.find((item) => item.studentId === enrollment.studentId);
        if (record?.status === "PRESENT") {
          studentPresentCount += 1;
        } else if (record?.status === "LATE") {
          studentPresentCount += 1;
          lateCount += 1;
        } else if (record?.status === "ABSENT_EXCUSED") {
          absentExcusedCount += 1;
        } else {
          absentUnexcusedCount += 1;
        }
      }

      presentCount += studentPresentCount;
      const absentCount = absentExcusedCount + absentUnexcusedCount;
      const absencePercent = totalSessions ? Math.round((absentCount / totalSessions) * 100) : 0;

      return {
        student: enrollment.student,
        presentCount: studentPresentCount,
        lateCount,
        absentExcusedCount,
        absentUnexcusedCount,
        absentCount,
        thresholdAbsences,
        totalSessions,
        absencePercent,
        warning: totalSessions > 0 && absencePercent >= thresholdPercent
      };
    });

    const warningCount = students.filter((student) => student.warning).length;

    return {
      id: section.id,
      code: section.code,
      subject: section.subject,
      semester: section.semester,
      totalStudents: section.enrollments.length,
      totalSessions,
      attendancePercent: expected ? Math.round((presentCount / expected) * 100) : 100,
      absencePercent: expected ? Math.round(((expected - presentCount) / expected) * 100) : 0,
      thresholdPercent,
      thresholdAbsences,
      warningCount,
      students
    };
  });

  ok(res, reports);
});

export const exportSectionReport = asyncHandler(async (req, res) => {
  await ensureTeacherOwnsSection(req.user!.id, req.params.sectionId);
  const records = await prisma.attendanceRecord.findMany({
    where: { attendanceSession: { courseSectionId: req.params.sectionId } },
    include: { student: true, attendanceSession: { include: { lesson: true } } },
    orderBy: [{ studentId: "asc" }, { markedAt: "asc" }]
  });
  const csv = stringify(records.map((r) => ({
    MSSV: r.student.studentCode,
    "Họ tên": r.student.fullName,
    "Ngày học": r.attendanceSession.lesson.lessonDate.toISOString().slice(0, 10),
    "Trạng thái": r.status,
    "Hình thức": r.method,
    "Ghi chú": r.reason ?? ""
  })), { header: true });

  res.header("Content-Type", "text/csv; charset=utf-8");
  res.attachment("attendance-report.csv");
  res.send(csv);
});
