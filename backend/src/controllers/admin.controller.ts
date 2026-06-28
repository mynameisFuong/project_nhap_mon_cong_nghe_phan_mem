import readXlsxFile from "read-excel-file/node";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { asyncHandler, AppError, ok } from "../utils/http.js";
import { hashPassword } from "../utils/password.js";

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).default("123456"),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role),
  studentCode: z.string().optional(),
  teacherCode: z.string().optional(),
  classId: z.string().uuid().optional()
});

const facultySchema = z.object({ name: z.string().min(2), code: z.string().min(2) });
const classSchema = facultySchema.extend({ facultyId: z.string().uuid() });
const subjectSchema = classSchema.extend({ credits: z.number().int().min(1).max(10).default(3) });
const semesterSchema = z.object({ name: z.string().min(2), startDate: z.coerce.date(), endDate: z.coerce.date() });
const sectionSchema = z.object({
  code: z.string().min(2),
  subjectId: z.string().uuid(),
  semesterId: z.string().uuid(),
  teacherId: z.string().uuid(),
  absenceThresholdPercent: z.number().min(0).max(100).default(20)
});

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

const importErrorMessage = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String(error.meta?.target ?? "");
    if (target.includes("student_code") || target.includes("studentCode")) return "MSSV đã tồn tại trong hệ thống.";
    if (target.includes("email")) return "Email đã tồn tại trong hệ thống.";
    return "Dữ liệu bị trùng với bản ghi đã có trong hệ thống.";
  }
  return error instanceof Error ? error.message : "Import lỗi.";
};

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, fullName: true, role: true, status: true, studentCode: true, teacherCode: true, classId: true }
  });
  ok(res, users);
});

export const createUser = asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  const { password, ...userInput } = input;
  const user = await prisma.user.create({
    data: { ...userInput, passwordHash: await hashPassword(password) }
  });
  ok(res, { id: user.id, email: user.email, role: user.role }, 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const input = userSchema.partial().omit({ password: true }).parse(req.body);
  const user = await prisma.user.update({ where: { id: req.params.id }, data: input });
  ok(res, { id: user.id, email: user.email, role: user.role, status: user.status });
});

export const lockUser = asyncHandler(async (req, res) => {
  const { locked } = z.object({ locked: z.boolean() }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: locked ? "LOCKED" : "ACTIVE", currentSessionId: locked ? null : undefined }
  });
  ok(res, { id: user.id, status: user.status });
});

export const deleteUser = asyncHandler(async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  ok(res, { message: "Đã xóa người dùng." });
});

export const listFaculties = asyncHandler(async (_req, res) => ok(res, await prisma.faculty.findMany({ orderBy: { name: "asc" } })));
export const createFaculty = asyncHandler(async (req, res) => ok(res, await prisma.faculty.create({ data: facultySchema.parse(req.body) }), 201));
export const updateFaculty = asyncHandler(async (req, res) => ok(res, await prisma.faculty.update({ where: { id: req.params.id }, data: facultySchema.partial().parse(req.body) })));
export const deleteFaculty = asyncHandler(async (req, res) => { await prisma.faculty.delete({ where: { id: req.params.id } }); ok(res, { message: "Đã xóa khoa." }); });

export const listClasses = asyncHandler(async (_req, res) => ok(res, await prisma.class.findMany({ include: { faculty: true }, orderBy: { name: "asc" } })));
export const listClassStudents = asyncHandler(async (req, res) => {
  ok(res, await prisma.user.findMany({
    where: { role: "STUDENT", classId: req.params.id },
    select: { id: true, email: true, fullName: true, role: true, status: true, studentCode: true, classId: true, class: true },
    orderBy: [{ studentCode: "asc" }, { fullName: "asc" }]
  }));
});
export const createClass = asyncHandler(async (req, res) => ok(res, await prisma.class.create({ data: classSchema.parse(req.body) }), 201));
export const updateClass = asyncHandler(async (req, res) => ok(res, await prisma.class.update({ where: { id: req.params.id }, data: classSchema.partial().parse(req.body) })));
export const deleteClass = asyncHandler(async (req, res) => { await prisma.class.delete({ where: { id: req.params.id } }); ok(res, { message: "Đã xóa lớp." }); });

export const importClasses = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cần upload file Excel hoặc CSV.");
  const table = await readTableFile(req.file.path);
  if (table.length < 2) throw new AppError(422, "EMPTY_FILE", "File không có dữ liệu lớp.");

  const headers = table[0].map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const rows = table.slice(1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = String(values[index] ?? "").trim();
    });
    return item;
  });

  let successRows = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (const [index, row] of rows.entries()) {
    const code = String(row["Mã lớp"] || row["Ma lop"] || row.Code || row.code || "").trim();
    const name = String(row["Tên lớp"] || row["Ten lop"] || row.Name || row.name || "").trim();
    const facultyKey = String(row["Mã khoa"] || row["Ma khoa"] || row.Khoa || row.Faculty || row.faculty || "").trim();

    try {
      if (!code || !name || !facultyKey) throw new Error("Thiếu Mã lớp, Tên lớp hoặc Mã khoa.");

      const faculty = await prisma.faculty.findFirst({
        where: { OR: [{ code: facultyKey }, { name: facultyKey }] }
      });
      if (!faculty) throw new Error(`Không tìm thấy khoa ${facultyKey}.`);

      await prisma.class.upsert({
        where: { code },
        update: { name, facultyId: faculty.id },
        create: { code, name, facultyId: faculty.id }
      });
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: importErrorMessage(error) });
    }
  }

  ok(res, { totalRows: rows.length, successRows, failedRows: errors.length, errors });
});

export const listSubjects = asyncHandler(async (_req, res) => ok(res, await prisma.subject.findMany({ include: { faculty: true }, orderBy: { name: "asc" } })));
export const createSubject = asyncHandler(async (req, res) => ok(res, await prisma.subject.create({ data: subjectSchema.parse(req.body) }), 201));
export const updateSubject = asyncHandler(async (req, res) => ok(res, await prisma.subject.update({ where: { id: req.params.id }, data: subjectSchema.partial().parse(req.body) })));
export const deleteSubject = asyncHandler(async (req, res) => { await prisma.subject.delete({ where: { id: req.params.id } }); ok(res, { message: "Đã xóa học phần." }); });

export const listSemesters = asyncHandler(async (_req, res) => ok(res, await prisma.semester.findMany({ orderBy: { startDate: "desc" } })));
export const createSemester = asyncHandler(async (req, res) => ok(res, await prisma.semester.create({ data: semesterSchema.parse(req.body) }), 201));
export const updateSemester = asyncHandler(async (req, res) => ok(res, await prisma.semester.update({ where: { id: req.params.id }, data: semesterSchema.partial().parse(req.body) })));
export const deleteSemester = asyncHandler(async (req, res) => { await prisma.semester.delete({ where: { id: req.params.id } }); ok(res, { message: "Đã xóa học kỳ." }); });

export const listSections = asyncHandler(async (_req, res) => {
  ok(res, await prisma.courseSection.findMany({
    include: { subject: true, semester: true, teacher: { select: { id: true, fullName: true, email: true } }, _count: { select: { enrollments: true, sessions: true } } },
    orderBy: { createdAt: "desc" }
  }));
});

export const listSectionStudents = asyncHandler(async (req, res) => {
  ok(res, await prisma.enrollment.findMany({
    where: { courseSectionId: req.params.sectionId },
    include: { student: { select: { id: true, studentCode: true, fullName: true, email: true, class: true } } },
    orderBy: { student: { fullName: "asc" } }
  }));
});

export const createSection = asyncHandler(async (req, res) => ok(res, await prisma.courseSection.create({ data: sectionSchema.parse(req.body) }), 201));
export const updateSection = asyncHandler(async (req, res) => ok(res, await prisma.courseSection.update({ where: { id: req.params.id }, data: sectionSchema.partial().parse(req.body) })));
export const deleteSection = asyncHandler(async (req, res) => { await prisma.courseSection.delete({ where: { id: req.params.id } }); ok(res, { message: "Đã xóa lớp học phần." }); });

export const importSections = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cần upload file Excel hoặc CSV.");
  const table = await readTableFile(req.file.path);
  if (table.length < 2) throw new AppError(422, "EMPTY_FILE", "File không có dữ liệu lớp học phần.");

  const headers = table[0].map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const rows = table.slice(1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = String(values[index] ?? "").trim();
    });
    return item;
  });

  let successRows = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (const [index, row] of rows.entries()) {
    const code = String(row["Mã lớp HP"] || row["Ma lop HP"] || row["Mã lớp học phần"] || row.Code || row.code || "").trim();
    const subjectKey = String(row["Mã học phần"] || row["Ma hoc phan"] || row["Mã HP"] || row["Ma HP"] || row["Học phần"] || row["Hoc phan"] || "").trim();
    const semesterName = String(row["Học kỳ"] || row["Hoc ky"] || row.Semester || row.semester || "").trim();
    const teacherKey = String(row["Email giảng viên"] || row["Email GV"] || row["Giảng viên"] || row["Giang vien"] || row.teacher || "").trim();
    const thresholdValue = String(row["Ngưỡng vắng (%)"] || row["Nguong vang (%)"] || row["Ngưỡng vắng"] || row.threshold || "").trim();

    try {
      if (!code || !subjectKey || !semesterName || !teacherKey) {
        throw new Error("Thiếu Mã lớp HP, Mã học phần, Học kỳ hoặc Email giảng viên.");
      }

      const [subject, semester, teacher] = await Promise.all([
        prisma.subject.findFirst({ where: { OR: [{ code: subjectKey }, { name: subjectKey }] } }),
        prisma.semester.findFirst({ where: { name: semesterName } }),
        prisma.user.findFirst({
          where: {
            role: "TEACHER",
            OR: [{ email: teacherKey.toLowerCase() }, { teacherCode: teacherKey }, { fullName: teacherKey }]
          }
        })
      ]);

      if (!subject) throw new Error(`Không tìm thấy học phần ${subjectKey}.`);
      if (!semester) throw new Error(`Không tìm thấy học kỳ ${semesterName}.`);
      if (!teacher) throw new Error(`Không tìm thấy giảng viên ${teacherKey}.`);

      const absenceThresholdPercent = thresholdValue ? Number(thresholdValue) : 20;
      if (!Number.isFinite(absenceThresholdPercent) || absenceThresholdPercent < 0 || absenceThresholdPercent > 100) {
        throw new Error("Ngưỡng vắng phải là số từ 0 đến 100.");
      }

      await prisma.courseSection.upsert({
        where: { code },
        update: {
          subjectId: subject.id,
          semesterId: semester.id,
          teacherId: teacher.id,
          absenceThresholdPercent
        },
        create: {
          code,
          subjectId: subject.id,
          semesterId: semester.id,
          teacherId: teacher.id,
          absenceThresholdPercent
        }
      });
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: importErrorMessage(error) });
    }
  }

  ok(res, { totalRows: rows.length, successRows, failedRows: errors.length, errors });
});

export const listLessons = asyncHandler(async (req, res) => {
  const lessons = await prisma.lesson.findMany({
    where: { courseSectionId: req.params.sectionId },
    include: { sessions: { orderBy: { openedAt: "desc" } } },
    orderBy: { lessonDate: "asc" }
  });
  ok(res, lessons.map((lesson) => ({ ...lesson, session: lesson.sessions[0] ?? null })));
});

export const createLesson = asyncHandler(async (req, res) => {
  const input = z.object({
    lessonDate: z.coerce.date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    room: z.string().optional(),
    topic: z.string().optional()
  }).parse(req.body);
  ok(res, await prisma.lesson.create({ data: { ...input, courseSectionId: req.params.sectionId } }), 201);
});

export const importLessons = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cần upload file Excel hoặc CSV.");
  const selectedSection = await prisma.courseSection.findUnique({
    where: { id: req.params.sectionId },
    include: { subject: true, teacher: { select: { fullName: true, email: true, teacherCode: true } } }
  });
  if (!selectedSection) throw new AppError(404, "SECTION_NOT_FOUND", "Không tìm thấy lớp học phần.");

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
    const sectionKey = String(rowValue(row, ["Lớp học phần", "Lop hoc phan", "Mã lớp HP", "Ma lop HP", "Ma lop hoc phan", "Course section", "courseSection"]) ?? "").trim();
    const lessonDate = cellToDateInput(rowValue(row, ["Ngày học", "Ngay hoc", "Ngày", "Ngay", "Date", "date"]));
    const startTime = cellToTimeInput(rowValue(row, ["Bắt đầu", "Bat dau", "Giờ bắt đầu", "Gio bat dau", "Start", "startTime"]));
    const endTime = cellToTimeInput(rowValue(row, ["Kết thúc", "Ket thuc", "Giờ kết thúc", "Gio ket thuc", "End", "endTime"]));
    const room = String(rowValue(row, ["Phòng", "Phong", "Room", "room"]) ?? "").trim();
    const topic = String(rowValue(row, ["Nội dung", "Noi dung", "Chủ đề", "Chu de", "Topic", "topic"]) ?? "").trim();

    try {
      const section = sectionKey
        ? await prisma.courseSection.findFirst({
          where: { OR: [{ code: sectionKey }, { id: sectionKey }] },
          include: { subject: true, teacher: { select: { fullName: true, email: true, teacherCode: true } } }
        })
        : selectedSection;
      if (!section) throw new Error(`Không tìm thấy lớp học phần ${sectionKey}.`);
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
            courseSectionId: section.id,
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
          courseSectionId: section.id,
          lessonDate: input.lessonDate,
          startTime: input.startTime,
          endTime: input.endTime,
          room: room || undefined,
          topic: topic || undefined
        }
      });
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: importErrorMessage(error) });
    }
  }

  const log = await prisma.importLog.create({
    data: {
      courseSectionId: selectedSection.id,
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

export const importStudents = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cáº§n upload file Excel.");
  const table = await readTableFile(req.file.path);
  if (table.length < 2) throw new AppError(422, "EMPTY_FILE", "File Excel không có dữ liệu sinh viên.");
  const headers = table[0].map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const rows = table.slice(1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = String(values[index] ?? "").trim();
    });
    return item;
  });

  let successRows = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const seenStudentCodes = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    const studentCode = String(row.MSSV || "").trim();
    const fullName = String(row["Họ tên"] || row["Ho ten"] || "").trim();
    const className = String(row["Lớp"] || row.Lop || "").trim();
    const email = String(row.Email || "").trim().toLowerCase();
    const duplicateRow = studentCode ? seenStudentCodes.get(studentCode) : undefined;

    try {
      if (duplicateRow) throw new Error(`MSSV ${studentCode} bị trùng với dòng ${duplicateRow} trong file.`);
      if (studentCode) seenStudentCodes.set(studentCode, index + 2);
      if (!studentCode || !fullName || !className || !email) throw new Error("Thiếu MSSV, Họ tên, Lớp hoặc Email.");
      const klass = await prisma.class.findFirst({ where: { OR: [{ name: className }, { code: className }] } });
      if (!klass) throw new Error(`Không tìm thấy lớp ${className}.`);

      const existingUsers = await prisma.user.findMany({
        where: { OR: [{ email }, { studentCode }] }
      });
      const userByEmail = existingUsers.find((user) => user.email === email);
      const userByCode = existingUsers.find((user) => user.studentCode === studentCode);

      if (userByCode && userByEmail && userByCode.id !== userByEmail.id) {
        throw new Error(`Email ${email} và MSSV ${studentCode} đang thuộc hai sinh viên khác nhau.`);
      }
      if (userByCode && userByCode.email !== email) {
        throw new Error(`MSSV ${studentCode} đã tồn tại với email ${userByCode.email}.`);
      }

      const student = userByEmail
        ? await prisma.user.update({
          where: { id: userByEmail.id },
          data: { fullName, studentCode, classId: klass.id, role: "STUDENT" }
        })
        : await prisma.user.create({
          data: {
            email,
            fullName,
            studentCode,
            classId: klass.id,
            role: "STUDENT",
            passwordHash: await hashPassword("123456")
          }
        });

      await prisma.enrollment.upsert({
        where: { courseSectionId_studentId: { courseSectionId: req.params.sectionId, studentId: student.id } },
        update: {},
        create: { courseSectionId: req.params.sectionId, studentId: student.id }
      });
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: importErrorMessage(error) });
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
  ok(res, { log, errors });
});

export const importClassStudents = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cần upload file Excel hoặc CSV.");
  const klass = await prisma.class.findUnique({ where: { id: req.params.id } });
  if (!klass) throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");

  const table = await readTableFile(req.file.path);
  if (table.length < 2) throw new AppError(422, "EMPTY_FILE", "File không có dữ liệu sinh viên.");
  const headers = table[0].map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const rows = table.slice(1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = String(values[index] ?? "").trim();
    });
    return item;
  });

  let successRows = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const seenStudentCodes = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    const studentCode = String(row.MSSV || row["Mã sinh viên"] || row["Ma sinh vien"] || "").trim();
    const fullName = String(row["Họ tên"] || row["Ho ten"] || row["Họ và tên"] || row["Ho va ten"] || row.Name || row.name || "").trim();
    const email = String(row.Email || row.email || "").trim().toLowerCase();
    const duplicateCodeRow = studentCode ? seenStudentCodes.get(studentCode) : undefined;
    const duplicateEmailRow = email ? seenEmails.get(email) : undefined;

    try {
      if (duplicateCodeRow) throw new Error(`MSSV ${studentCode} bị trùng với dòng ${duplicateCodeRow} trong file.`);
      if (duplicateEmailRow) throw new Error(`Email ${email} bị trùng với dòng ${duplicateEmailRow} trong file.`);
      if (studentCode) seenStudentCodes.set(studentCode, index + 2);
      if (email) seenEmails.set(email, index + 2);
      if (!studentCode || !fullName || !email) throw new Error("Thiếu MSSV, Họ tên hoặc Email.");

      const existingUsers = await prisma.user.findMany({
        where: { OR: [{ email }, { studentCode }] }
      });
      const userByEmail = existingUsers.find((user) => user.email === email);
      const userByCode = existingUsers.find((user) => user.studentCode === studentCode);

      if (userByCode && userByEmail && userByCode.id !== userByEmail.id) {
        throw new Error(`Email ${email} và MSSV ${studentCode} đang thuộc hai sinh viên khác nhau.`);
      }
      if (userByCode && userByCode.email !== email) {
        throw new Error(`MSSV ${studentCode} đã tồn tại với email ${userByCode.email}.`);
      }

      if (userByEmail) {
        await prisma.user.update({
          where: { id: userByEmail.id },
          data: { fullName, studentCode, classId: klass.id, role: "STUDENT" }
        });
      } else {
        await prisma.user.create({
          data: {
            email,
            fullName,
            studentCode,
            classId: klass.id,
            role: "STUDENT",
            passwordHash: await hashPassword("123456")
          }
        });
      }
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: importErrorMessage(error) });
    }
  }

  const log = await prisma.importLog.create({
    data: {
      importedById: req.user!.id,
      fileName: req.file.originalname,
      totalRows: rows.length,
      successRows,
      failedRows: errors.length,
      errorDetails: errors
    }
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: "IMPORT_CLASS_STUDENTS",
      entity: "class",
      entityId: klass.id,
      metadata: { classCode: klass.code, importLogId: log.id, totalRows: rows.length, successRows, failedRows: errors.length }
    }
  });

  ok(res, { log, errors, totalRows: rows.length, successRows, failedRows: errors.length });
});

export const importStudentsByClass = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "Cần upload file Excel hoặc CSV.");
  const table = await readTableFile(req.file.path);
  if (table.length < 2) throw new AppError(422, "EMPTY_FILE", "File không có dữ liệu sinh viên.");
  const headers = table[0].map((value) => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const rows = table.slice(1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = String(values[index] ?? "").trim();
    });
    return item;
  });

  let successRows = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const seenStudentCodes = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    const studentCode = String(row.MSSV || row["Mã số sinh viên"] || row["Ma so sinh vien"] || row["Mã sinh viên"] || row["Ma sinh vien"] || "").trim();
    const fullName = String(row["Họ tên"] || row["Ho ten"] || row["Họ và tên"] || row["Ho va ten"] || row.Name || row.name || "").trim();
    const className = String(row["Lớp học"] || row["Lop hoc"] || row["Lớp"] || row.Lop || row.Class || row.class || "").trim();
    const email = String(row.Email || row.email || "").trim().toLowerCase();
    const duplicateCodeRow = studentCode ? seenStudentCodes.get(studentCode) : undefined;
    const duplicateEmailRow = email ? seenEmails.get(email) : undefined;

    try {
      if (duplicateCodeRow) throw new Error(`MSSV ${studentCode} bị trùng với dòng ${duplicateCodeRow} trong file.`);
      if (duplicateEmailRow) throw new Error(`Email ${email} bị trùng với dòng ${duplicateEmailRow} trong file.`);
      if (studentCode) seenStudentCodes.set(studentCode, index + 2);
      if (email) seenEmails.set(email, index + 2);
      if (!studentCode || !fullName || !className || !email) throw new Error("Thiếu Họ tên, Mã số sinh viên, Lớp học hoặc Email.");

      const klass = await prisma.class.findFirst({ where: { OR: [{ code: className }, { name: className }] } });
      if (!klass) throw new Error(`Không tìm thấy lớp ${className}.`);

      const existingUsers = await prisma.user.findMany({
        where: { OR: [{ email }, { studentCode }] }
      });
      const userByEmail = existingUsers.find((user) => user.email === email);
      const userByCode = existingUsers.find((user) => user.studentCode === studentCode);

      if (userByCode && userByEmail && userByCode.id !== userByEmail.id) {
        throw new Error(`Email ${email} và MSSV ${studentCode} đang thuộc hai sinh viên khác nhau.`);
      }
      if (userByCode && userByCode.email !== email) {
        throw new Error(`MSSV ${studentCode} đã tồn tại với email ${userByCode.email}.`);
      }

      if (userByEmail) {
        await prisma.user.update({
          where: { id: userByEmail.id },
          data: { fullName, studentCode, classId: klass.id, role: "STUDENT" }
        });
      } else {
        await prisma.user.create({
          data: {
            email,
            fullName,
            studentCode,
            classId: klass.id,
            role: "STUDENT",
            passwordHash: await hashPassword("123456")
          }
        });
      }
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: importErrorMessage(error) });
    }
  }

  const log = await prisma.importLog.create({
    data: {
      importedById: req.user!.id,
      fileName: req.file.originalname,
      totalRows: rows.length,
      successRows,
      failedRows: errors.length,
      errorDetails: errors
    }
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: "IMPORT_STUDENTS_BY_CLASS",
      entity: "student",
      metadata: { importLogId: log.id, totalRows: rows.length, successRows, failedRows: errors.length }
    }
  });

  ok(res, { log, errors, totalRows: rows.length, successRows, failedRows: errors.length });
});

const buildAttendanceReport = async () => {
  const sections = await prisma.courseSection.findMany({
    include: {
      subject: true,
      teacher: { select: { id: true, fullName: true, email: true } },
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

  let totalExpected = 0;
  let totalPresent = 0;
  const warnings: Array<Record<string, unknown>> = [];
  const sectionReports = sections.map((section) => {
    const thresholdPercent = Number(section.absenceThresholdPercent ?? 20);
    const totalSessions = section.sessions.length;
    const expected = section.enrollments.length * totalSessions;
    let presentCount = 0;
    let warningCount = 0;

    for (const enrollment of section.enrollments) {
      let absentCount = 0;
      let studentPresentCount = 0;

      for (const session of section.sessions) {
        const record = session.records.find((item) => item.studentId === enrollment.studentId);
        if (record?.status === "PRESENT" || record?.status === "LATE") {
          studentPresentCount += 1;
        } else {
          absentCount += 1;
        }
      }

      presentCount += studentPresentCount;
      const absencePercent = totalSessions ? Math.round((absentCount / totalSessions) * 100) : 0;
      if (totalSessions > 0 && absencePercent >= thresholdPercent) {
        warningCount += 1;
        warnings.push({
          sectionId: section.id,
          sectionCode: section.code,
          subjectName: section.subject.name,
          teacherName: section.teacher.fullName,
          student: enrollment.student,
          absentCount,
          totalSessions,
          absencePercent,
          thresholdPercent
        });
      }
    }

    totalExpected += expected;
    totalPresent += presentCount;

    return {
      id: section.id,
      code: section.code,
      subject: section.subject,
      teacher: section.teacher,
      totalStudents: section.enrollments.length,
      totalSessions,
      attendancePercent: expected ? Math.round((presentCount / expected) * 100) : 100,
      warningCount,
      thresholdPercent
    };
  });

  return {
    summary: {
      attendancePercent: totalExpected ? Math.round((totalPresent / totalExpected) * 100) : 100,
      sessionCount: sections.reduce((sum, section) => sum + section.sessions.length, 0),
      warningCount: warnings.length
    },
    sections: sectionReports,
    warnings
  };
};

export const overviewReport = asyncHandler(async (_req, res) => {
  ok(res, await buildAttendanceReport());
});

export const sendAttendanceWarnings = asyncHandler(async (_req, res) => {
  const report = await buildAttendanceReport();
  const lowAttendanceSections = report.sections.filter((section) => section.totalSessions > 0 && section.attendancePercent < 80);

  const studentNotifications = report.warnings.map((warning) => {
    const student = warning.student as { id: string; fullName: string };
    return prisma.notification.create({
      data: {
        userId: student.id,
        title: "Cảnh báo vắng",
        message: `Bạn đang vắng ${warning.absencePercent}% trong lớp ${warning.sectionCode} - ${warning.subjectName}, đã đạt hoặc vượt ngưỡng ${warning.thresholdPercent}%.`
      }
    });
  });

  const teacherNotifications = lowAttendanceSections
    .filter((section) => section.teacher?.id)
    .map((section) => prisma.notification.create({
      data: {
        userId: section.teacher!.id,
        title: "Cảnh báo chuyên cần lớp học phần",
        message: `Lớp ${section.code} - ${section.subject?.name ?? "Học phần"} có tỷ lệ chuyên cần ${section.attendancePercent}%, thấp hơn ngưỡng 80%.`
      }
    }));

  await prisma.$transaction([...studentNotifications, ...teacherNotifications]);

  ok(res, {
    studentNotifications: studentNotifications.length,
    teacherNotifications: teacherNotifications.length,
    totalNotifications: studentNotifications.length + teacherNotifications.length
  });
});
