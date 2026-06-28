import { AlertTriangle, BookOpen, ClipboardCheck, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/Button";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { studentService } from "../../services";
import { useAsync } from "../../utils/useAsync";
import { shortDate } from "../../utils/format";

export function StudentDashboard() {
  const sections = useAsync(studentService.sections, []);
  const history = useAsync(studentService.history, []);
  const leaves = useAsync(studentService.leaveRequests, []);
  const schedule = useAsync(studentService.schedule, []);
  if (sections.loading || history.loading || leaves.loading || schedule.loading) return <LoadingSpinner />;
  const records = history.data ?? [];
  const absent = records.filter((r) => r.status.includes("ABSENT")).length;
  return (
    <div className="page-stack">
      <PageHeader title="Dashboard sinh viên" description="Theo dõi học phần, lịch học, lịch sử điểm danh và cảnh báo chuyên cần." actions={<Link to="/student/attendance"><Button>Điểm danh ngay</Button></Link>} />
      <div className="stat-grid">
        <StatCard title="Học phần đang học" value={(sections.data ?? []).length} icon={<BookOpen />} />
        <StatCard title="Đã điểm danh" value={records.filter((r) => r.status === "PRESENT").length} icon={<ClipboardCheck />} tone="green" />
        <StatCard title="Buổi vắng" value={absent} icon={<AlertTriangle />} tone={absent > 2 ? "red" : "amber"} />
        <StatCard title="Đơn xin phép" value={(leaves.data ?? []).length} icon={<FileText />} tone="blue" />
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Lịch học sắp tới</h2><p>Các buổi học gần nhất theo lớp học phần đã đăng ký.</p></div>
        <DataTable data={schedule.data ?? []} columns={[
          { key: "date", header: "Ngày", render: (row) => shortDate(row.lessonDate) },
          { key: "course", header: "Học phần", render: (row) => row.courseSection?.subject?.name ?? "-" },
          { key: "time", header: "Thời gian", render: (row) => `${row.startTime} - ${row.endTime}` },
          { key: "room", header: "Phòng", render: (row) => row.room ?? "-" }
        ]} />
      </section>
    </div>
  );
}
