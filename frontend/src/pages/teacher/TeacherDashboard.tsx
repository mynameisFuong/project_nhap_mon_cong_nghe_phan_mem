import { AlertTriangle, BookOpen, ClipboardList, FileClock } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Badge } from "../../components/Badge";
import { teacherService } from "../../services";
import { useAsync } from "../../utils/useAsync";

export function TeacherDashboard() {
  const sections = useAsync(teacherService.sections, []);
  const leaves = useAsync(teacherService.leaveRequests, []);
  if (sections.loading || leaves.loading) return <LoadingSpinner />;
  const pending = (leaves.data ?? []).filter((leave) => leave.status === "PENDING").length;
  return (
    <div className="page-stack">
      <PageHeader title="Dashboard giảng viên" description="Theo dõi lớp phụ trách, phiên điểm danh và đơn xin phép cần xử lý." />
      <div className="stat-grid">
        <StatCard title="Lớp phụ trách" value={(sections.data ?? []).length} icon={<BookOpen />} />
        <StatCard title="Phiên đã tạo" value={(sections.data ?? []).reduce((sum, item) => sum + (item._count?.sessions ?? 0), 0)} icon={<ClipboardList />} tone="blue" />
        <StatCard title="Đơn chờ duyệt" value={pending} icon={<FileClock />} tone="amber" />
        <StatCard title="Vắng vượt ngưỡng" value="2" icon={<AlertTriangle />} tone="red" />
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Lớp học phần gần nhất</h2><p>Các lớp đang được phân công cho bạn.</p></div>
        <DataTable data={sections.data ?? []} columns={[
          { key: "code", header: "Mã lớp", render: (row) => <strong>{row.code}</strong> },
          { key: "subject", header: "Học phần", render: (row) => row.subject?.name ?? "-" },
          { key: "semester", header: "Học kỳ", render: (row) => row.semester?.name ?? "-" },
          { key: "students", header: "Sinh viên", render: (row) => row._count?.enrollments ?? 0 },
          { key: "status", header: "Trạng thái", render: () => <Badge tone="success">Đang mở</Badge> }
        ]} />
      </section>
    </div>
  );
}
