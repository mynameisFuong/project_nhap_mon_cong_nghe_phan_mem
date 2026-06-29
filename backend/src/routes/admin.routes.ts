import { Router } from "express";
import { authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createClass,
  createFaculty,
  createLesson,
  createSection,
  createSemester,
  createSubject,
  createUser,
  deleteClass,
  deleteFaculty,
  deleteSection,
  deleteSemester,
  deleteSubject,
  deleteUser,
  importClasses,
  importClassStudents,
  importLessons,
  importSections,
  importStudents,
  importStudentsByClass,
  listClassStudents,
  listClasses,
  listFaculties,
  listLessons,
  listSectionStudents,
  listSections,
  listSemesters,
  listSubjects,
  listUsers,
  lockUser,
  overviewReport,
  removeClassStudent,
  sendAttendanceWarnings,
  updateClass,
  updateFaculty,
  updateSection,
  updateSemester,
  updateSubject,
  updateUser,
  updateUserPassword
} from "../controllers/admin.controller.js";

export const adminRoutes = Router();
adminRoutes.use(authorize("ADMIN"));

adminRoutes.get("/users", listUsers);
adminRoutes.post("/users", createUser);
adminRoutes.patch("/users/:id", updateUser);
adminRoutes.patch("/users/:id/password", updateUserPassword);
adminRoutes.patch("/users/:id/lock", lockUser);
adminRoutes.delete("/users/:id", deleteUser);

adminRoutes.get("/faculties", listFaculties);
adminRoutes.post("/faculties", createFaculty);
adminRoutes.patch("/faculties/:id", updateFaculty);
adminRoutes.delete("/faculties/:id", deleteFaculty);

adminRoutes.get("/classes", listClasses);
adminRoutes.post("/classes", createClass);
adminRoutes.post("/classes/import", upload.single("file"), importClasses);
adminRoutes.post("/classes/import-students", upload.single("file"), importStudentsByClass);
adminRoutes.get("/classes/:id/students", listClassStudents);
adminRoutes.post("/classes/:id/import-students", upload.single("file"), importClassStudents);
adminRoutes.delete("/classes/:id/students/:studentId", removeClassStudent);
adminRoutes.patch("/classes/:id", updateClass);
adminRoutes.delete("/classes/:id", deleteClass);

adminRoutes.get("/subjects", listSubjects);
adminRoutes.post("/subjects", createSubject);
adminRoutes.patch("/subjects/:id", updateSubject);
adminRoutes.delete("/subjects/:id", deleteSubject);

adminRoutes.get("/semesters", listSemesters);
adminRoutes.post("/semesters", createSemester);
adminRoutes.patch("/semesters/:id", updateSemester);
adminRoutes.delete("/semesters/:id", deleteSemester);

adminRoutes.get("/sections", listSections);
adminRoutes.post("/sections", createSection);
adminRoutes.post("/sections/import", upload.single("file"), importSections);
adminRoutes.patch("/sections/:id", updateSection);
adminRoutes.delete("/sections/:id", deleteSection);
adminRoutes.get("/sections/:sectionId/students", listSectionStudents);
adminRoutes.get("/sections/:sectionId/lessons", listLessons);
adminRoutes.post("/sections/:sectionId/lessons", createLesson);
adminRoutes.post("/sections/:sectionId/lessons/import", upload.single("file"), importLessons);
adminRoutes.post("/sections/:sectionId/import-students", upload.single("file"), importStudents);

adminRoutes.get("/reports/overview", overviewReport);
adminRoutes.post("/reports/send-attendance-warnings", sendAttendanceWarnings);
