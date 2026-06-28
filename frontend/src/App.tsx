import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ProtectedRoute, RequireRole } from "./layouts/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { NotFound } from "./pages/NotFound";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { UserManagement } from "./pages/admin/UserManagement";
import { CatalogManagement } from "./pages/admin/CatalogManagement";
import { SectionManagement } from "./pages/admin/SectionManagement";
import { ImportStudents } from "./pages/admin/ImportStudents";
import { AdminReports } from "./pages/admin/AdminReports";
import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { TeacherSections } from "./pages/teacher/TeacherSections";
import { SectionDetail } from "./pages/teacher/SectionDetail";
import { AttendanceSessionPage } from "./pages/teacher/AttendanceSessionPage";
import { TeacherLeaveRequests } from "./pages/teacher/TeacherLeaveRequests";
import { TeacherNotifications } from "./pages/teacher/TeacherNotifications";
import { TeacherReports } from "./pages/teacher/TeacherReports";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentCourses } from "./pages/student/StudentCourses";
import { StudentAttendance } from "./pages/student/StudentAttendance";
import { StudentHistory } from "./pages/student/StudentHistory";
import { StudentLeaves } from "./pages/student/StudentLeaves";
import { StudentNotifications } from "./pages/student/StudentNotifications";

export default function App() {
  const protectedPage = (roles: Parameters<typeof RequireRole>[0]["roles"], page: ReactNode) => (
    <RequireRole roles={roles}>
      <DashboardLayout>{page}</DashboardLayout>
    </RequireRole>
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Route>
      <Route path="/admin" element={protectedPage(["ADMIN"], <AdminDashboard />)} />
      <Route path="/admin/users" element={protectedPage(["ADMIN"], <UserManagement />)} />
      <Route path="/admin/catalogs" element={protectedPage(["ADMIN"], <CatalogManagement />)} />
      <Route path="/admin/sections" element={protectedPage(["ADMIN"], <SectionManagement />)} />
      <Route path="/admin/import" element={protectedPage(["ADMIN"], <ImportStudents />)} />
      <Route path="/admin/reports" element={protectedPage(["ADMIN"], <AdminReports />)} />
      <Route path="/teacher" element={protectedPage(["TEACHER"], <TeacherDashboard />)} />
      <Route path="/teacher/sections" element={protectedPage(["TEACHER"], <TeacherSections />)} />
      <Route path="/teacher/sections/:id" element={protectedPage(["TEACHER"], <SectionDetail />)} />
      <Route path="/teacher/attendance" element={protectedPage(["TEACHER"], <AttendanceSessionPage />)} />
      <Route path="/teacher/leaves" element={protectedPage(["TEACHER"], <TeacherLeaveRequests />)} />
      <Route path="/teacher/notifications" element={protectedPage(["TEACHER"], <TeacherNotifications />)} />
      <Route path="/teacher/reports" element={protectedPage(["TEACHER"], <TeacherReports />)} />
      <Route path="/student" element={protectedPage(["STUDENT"], <StudentDashboard />)} />
      <Route path="/student/courses" element={protectedPage(["STUDENT"], <StudentCourses />)} />
      <Route path="/student/attendance" element={protectedPage(["STUDENT"], <StudentAttendance />)} />
      <Route path="/student/history" element={protectedPage(["STUDENT"], <StudentHistory />)} />
      <Route path="/student/leaves" element={protectedPage(["STUDENT"], <StudentLeaves />)} />
      <Route path="/student/notifications" element={protectedPage(["STUDENT"], <StudentNotifications />)} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
