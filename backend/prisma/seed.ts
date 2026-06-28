import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

type CsvRow = Record<string, string>;

const parseCsv = (content: string) => {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((item) => item.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(",").map((item) => item.trim());
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
};

const readSeedScheduleRows = () => {
  const filePath = path.resolve(process.cwd(), "..", "frontend", "public", "templates", "import-lich-hoc-mau.csv");
  return parseCsv(fs.readFileSync(filePath, "utf8"));
};

async function main() {
  const passwordHash = await hashPassword("123456");

  const admin = await prisma.user.upsert({
    where: { email: "admin@school.test" },
    update: {},
    create: { email: "admin@school.test", fullName: "Quản trị viên", role: "ADMIN", passwordHash }
  });

  const fit = await prisma.faculty.upsert({
    where: { code: "FIT" },
    update: {},
    create: { code: "FIT", name: "Công nghệ thông tin" }
  });
  const fba = await prisma.faculty.upsert({
    where: { code: "FBA" },
    update: {},
    create: { code: "FBA", name: "Quản trị kinh doanh" }
  });

  const class1 = await prisma.class.upsert({
    where: { code: "DCT1221" },
    update: {},
    create: { code: "DCT1221", name: "DCT1221", facultyId: fit.id }
  });
  const class2 = await prisma.class.upsert({
    where: { code: "DCT1222" },
    update: {},
    create: { code: "DCT1222", name: "DCT1222", facultyId: fit.id }
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: "gv1@school.test" },
    update: {},
    create: { email: "gv1@school.test", fullName: "Nguyễn Văn Giảng", role: "TEACHER", teacherCode: "GV001", passwordHash }
  });
  const teacher2 = await prisma.user.upsert({
    where: { email: "gv2@school.test" },
    update: {},
    create: { email: "gv2@school.test", fullName: "Trần Thị Dạy", role: "TEACHER", teacherCode: "GV002", passwordHash }
  });

  const subject1 = await prisma.subject.upsert({
    where: { code: "SE101" },
    update: {},
    create: { code: "SE101", name: "Nhập môn Công nghệ phần mềm", credits: 3, facultyId: fit.id }
  });
  const subject2 = await prisma.subject.upsert({
    where: { code: "DB101" },
    update: {},
    create: { code: "DB101", name: "Cơ sở dữ liệu", credits: 3, facultyId: fit.id }
  });
  const subject3 = await prisma.subject.upsert({
    where: { code: "MKT101" },
    update: {},
    create: { code: "MKT101", name: "Marketing căn bản", credits: 2, facultyId: fba.id }
  });

  const semester = await prisma.semester.upsert({
    where: { name: "HK1 2026-2027" },
    update: {},
    create: { name: "HK1 2026-2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-01-15") }
  });

  const section1 = await prisma.courseSection.upsert({
    where: { code: "SE101-01" },
    update: {},
    create: { code: "SE101-01", subjectId: subject1.id, semesterId: semester.id, teacherId: teacher1.id }
  });
  await prisma.courseSection.upsert({
    where: { code: "DB101-01" },
    update: {},
    create: { code: "DB101-01", subjectId: subject2.id, semesterId: semester.id, teacherId: teacher2.id }
  });
  await prisma.courseSection.upsert({
    where: { code: "MKT101-01" },
    update: {},
    create: { code: "MKT101-01", subjectId: subject3.id, semesterId: semester.id, teacherId: teacher2.id }
  });

  const students = [];
  for (let i = 1; i <= 8; i += 1) {
    const code = `SV${String(i).padStart(3, "0")}`;
    const student = await prisma.user.upsert({
      where: { email: `${code.toLowerCase()}@school.test` },
      update: {},
      create: {
        email: `${code.toLowerCase()}@school.test`,
        fullName: `Sinh viên ${i}`,
        role: "STUDENT",
        studentCode: code,
        classId: i <= 4 ? class1.id : class2.id,
        passwordHash
      }
    });
    students.push(student);
    await prisma.enrollment.upsert({
      where: { courseSectionId_studentId: { courseSectionId: section1.id, studentId: student.id } },
      update: {},
      create: { courseSectionId: section1.id, studentId: student.id }
    });
  }

  const sectionByCode = new Map([[section1.code, section1]]);
  for (const row of readSeedScheduleRows()) {
    const section = sectionByCode.get(row["Lop hoc phan"] || section1.code);
    if (!section || !row["Ngay hoc"] || !row["Bat dau"] || !row["Ket thuc"]) continue;
    const lessonDate = new Date(row["Ngay hoc"]);
    const startTime = row["Bat dau"];
    const endTime = row["Ket thuc"];
    await prisma.lesson.upsert({
      where: { courseSectionId_lessonDate_startTime: { courseSectionId: section.id, lessonDate, startTime } },
      update: {
        endTime,
        room: row["Phong"] || null,
        topic: row["Noi dung"] || null
      },
      create: {
        courseSectionId: section.id,
        lessonDate,
        startTime,
        endTime,
        room: row["Phong"] || undefined,
        topic: row["Noi dung"] || undefined
      }
    });
  }

  const lesson1 = await prisma.lesson.upsert({
    where: { courseSectionId_lessonDate_startTime: { courseSectionId: section1.id, lessonDate: new Date("2026-09-10"), startTime: "07:30" } },
    update: {},
    create: { courseSectionId: section1.id, lessonDate: new Date("2026-09-10"), startTime: "07:30", endTime: "10:00", room: "A101", topic: "Giới thiệu môn học" }
  });
  await prisma.lesson.upsert({
    where: { courseSectionId_lessonDate_startTime: { courseSectionId: section1.id, lessonDate: new Date("2026-09-17"), startTime: "07:30" } },
    update: {},
    create: { courseSectionId: section1.id, lessonDate: new Date("2026-09-17"), startTime: "07:30", endTime: "10:00", room: "A101", topic: "Yêu cầu phần mềm" }
  });

  const session = await prisma.attendanceSession.findFirst({
    where: { lessonId: lesson1.id, nonce: "seed-session-nonce" }
  }) ?? await prisma.attendanceSession.create({
    data: { courseSectionId: section1.id, lessonId: lesson1.id, nonce: "seed-session-nonce", status: "CLOSED", createdById: teacher1.id, closedAt: new Date("2026-09-10T03:00:00Z") }
  });

  for (const [index, student] of students.entries()) {
    await prisma.attendanceRecord.upsert({
      where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId: student.id } },
      update: {},
      create: {
        attendanceSessionId: session.id,
        studentId: student.id,
        status: index < 5 ? "PRESENT" : "ABSENT_UNEXCUSED",
        method: index < 5 ? "QR_OTP" : "SYSTEM",
        reason: index < 5 ? null : "Seed: vắng mẫu"
      }
    });
  }

  const absentRecord = await prisma.attendanceRecord.findFirstOrThrow({
    where: { attendanceSessionId: session.id, studentId: students[6].id }
  });
  await prisma.leaveRequest.upsert({
    where: { attendanceRecordId: absentRecord.id },
    update: {},
    create: {
      lessonId: lesson1.id,
      attendanceSessionId: session.id,
      attendanceRecordId: absentRecord.id,
      studentId: students[6].id,
      reason: "Bị ốm, có giấy xác nhận.",
      evidencePath: "uploads/leave-evidence/sample.pdf",
      status: "PENDING"
    }
  });

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "SEED", entity: "database", metadata: { note: "Seed dữ liệu mẫu" } }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
