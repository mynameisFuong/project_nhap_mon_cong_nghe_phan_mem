import { BookOpen, ClipboardCheck, GraduationCap, TrendingUp, UserCheck } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { adminService } from "../../services";
import { useAsync } from "../../utils/useAsync";

export function AdminDashboard() {
  const users = useAsync(adminService.users, []);
  const sections = useAsync(adminService.sections, []);

  if (users.loading || sections.loading) return <LoadingSpinner />;

  const userList = users.data ?? [];
  const sectionList = sections.data ?? [];
  const students = userList.filter((user) => user.role === "STUDENT").length;
  const teachers = userList.filter((user) => user.role === "TEACHER").length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Tổng quan hệ thống"
        description="Theo dõi quy mô người dùng, lớp học phần và tình trạng chuyên cần toàn trường."
      />
      <div className="stat-grid">
        <StatCard title="Tổng sinh viên" value={students} icon={<GraduationCap />} />
        <StatCard title="Tổng giảng viên" value={teachers} icon={<UserCheck />} tone="blue" />
        <StatCard title="Lớp học phần" value={sectionList.length} icon={<BookOpen />} tone="green" />
        <StatCard title="Chuyên cần TB" value="91%" icon={<TrendingUp />} tone="amber" />
        <StatCard title="Vắng vượt ngưỡng" value="3" icon={<ClipboardCheck />} tone="red" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Lớp học phần gần đây</h2>
            <p>Các lớp đang hoạt động và số lượng sinh viên đã ghi danh.</p>
          </div>
        </div>
        <DataTable
          data={sectionList}
          columns={[
            { key: "code", header: "Mã lớp", render: (row) => row.code },
            { key: "subject", header: "Học phần", render: (row) => row.subject?.name ?? "-" },
            { key: "teacher", header: "Giảng viên", render: (row) => row.teacher?.fullName ?? "-" },
            { key: "students", header: "Sinh viên", render: (row) => row._count?.enrollments ?? 0 }
          ]}
        />
      </section>
    </div>
  );
}
