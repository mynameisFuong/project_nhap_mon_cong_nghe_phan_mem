import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap, Home, Layers, LogOut, Menu, QrCode, School, Shield, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import type { NotificationItem, Role } from "../types";
import { Button } from "../components/Button";
import { studentService, teacherService } from "../services";

const navByRole: Record<Role, Array<{ to: string; label: string; icon: ReactNode }>> = {
  ADMIN: [
    { to: "/admin", label: "Tổng quan", icon: <Home size={18} /> },
    { to: "/admin/users", label: "Người dùng", icon: <Users size={18} /> },
    { to: "/admin/catalogs", label: "Danh mục", icon: <Layers size={18} /> },
    { to: "/admin/sections", label: "Lớp học phần", icon: <School size={18} /> },
    { to: "/admin/import", label: "Import sinh viên", icon: <FileText size={18} /> },
    { to: "/admin/reports", label: "Báo cáo", icon: <ClipboardCheck size={18} /> }
  ],
  TEACHER: [
    { to: "/teacher", label: "Tổng quan", icon: <Home size={18} /> },
    { to: "/teacher/sections", label: "Lớp phụ trách", icon: <BookOpen size={18} /> },
    { to: "/teacher/attendance", label: "Phiên điểm danh", icon: <QrCode size={18} /> },
    { to: "/teacher/leaves", label: "Đơn xin phép", icon: <FileText size={18} /> },
    { to: "/teacher/notifications", label: "Thông báo", icon: <Bell size={18} /> },
    { to: "/teacher/reports", label: "Báo cáo", icon: <ClipboardCheck size={18} /> }
  ],
  STUDENT: [
    { to: "/student", label: "Tổng quan", icon: <Home size={18} /> },
    { to: "/student/courses", label: "Học phần", icon: <GraduationCap size={18} /> },
    { to: "/student/attendance", label: "Điểm danh", icon: <QrCode size={18} /> },
    { to: "/student/history", label: "Lịch sử", icon: <CalendarDays size={18} /> },
    { to: "/student/leaves", label: "Đơn xin phép", icon: <FileText size={18} /> },
    { to: "/student/notifications", label: "Thông báo", icon: <Bell size={18} /> }
  ]
};

const roleLabel: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giảng viên",
  STUDENT: "Sinh viên"
};

const notificationPath: Record<Role, string> = {
  ADMIN: "/admin/reports",
  TEACHER: "/teacher/notifications",
  STUDENT: "/student/notifications"
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;
  const nav = navByRole[user.role];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  useEffect(() => {
    let mounted = true;
    const loadUnread = async () => {
      try {
        let notifications: NotificationItem[] = [];
        if (user.role === "STUDENT") notifications = await studentService.notifications();
        if (user.role === "TEACHER") notifications = await teacherService.notifications();
        if (mounted) setUnreadCount(notifications.filter((item) => !item.readAt).length);
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };
    void loadUnread();
    window.addEventListener("notifications:changed", loadUnread);
    return () => {
      mounted = false;
      window.removeEventListener("notifications:changed", loadUnread);
    };
  }, [user.role, location.pathname]);

  return (
    <div className="dashboard-shell">
      <aside className={clsx("sidebar", open && "sidebar-open")}>
        <div className="brand">
          <div className="brand-mark"><Shield size={22} /></div>
          <div>
            <strong>Attendly</strong>
            <span>Student Attendance</span>
          </div>
          <Button className="sidebar-close" variant="ghost" icon={<X size={18} />} onClick={() => setOpen(false)} aria-label="Đóng menu" />
        </div>

        <nav className="nav-list">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to.split("/").length === 2} onClick={() => setOpen(false)}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.fullName}</strong>
              <span>{roleLabel[user.role]}</span>
            </div>
          </div>
          <Button className="full-width" variant="outline" icon={<LogOut size={17} />} onClick={handleLogout}>Đăng xuất</Button>
        </div>
      </aside>

      <div className={clsx("sidebar-scrim", open && "show")} onClick={() => setOpen(false)} />

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <Button className="menu-btn" variant="ghost" icon={<Menu size={20} />} onClick={() => setOpen(true)} aria-label="Mở menu" />
            <div>
              <span className="breadcrumb">{location.pathname.replaceAll("/", " / ").replace(" / ", "") || "dashboard"}</span>
            </div>
          </div>
          <div className="top-actions">
            <button className="icon-button notification-button" aria-label="Thông báo" onClick={() => navigate(notificationPath[user.role])}>
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </header>
        <section className="content-area">
          {children}
        </section>
      </main>
    </div>
  );
}
