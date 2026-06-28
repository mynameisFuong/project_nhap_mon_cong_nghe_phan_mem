import { Eye, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/Button";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { teacherService } from "../../services";
import { useAsync } from "../../utils/useAsync";

export function TeacherSections() {
  const { data, loading } = useAsync(teacherService.sections, []);
  if (loading) return <LoadingSpinner />;
  return (
    <div className="page-stack">
      <PageHeader title="Lớp học phần phụ trách" description="Xem sĩ số, lịch học và mở chi tiết để tạo phiên điểm danh." />
      <section className="panel">
        <DataTable data={data ?? []} columns={[
          { key: "code", header: "Mã lớp", render: (row) => <strong>{row.code}</strong> },
          { key: "subject", header: "Học phần", render: (row) => row.subject?.name ?? "-" },
          { key: "semester", header: "Học kỳ", render: (row) => row.semester?.name ?? "-" },
          { key: "students", header: "Sinh viên", render: (row) => row._count?.enrollments ?? 0 },
          { key: "actions", header: "Thao tác", render: (row) => <div className="row-actions"><Link to={`/teacher/sections/${row.id}`}><Button variant="outline" icon={<Eye size={16} />}>Chi tiết</Button></Link><Link to="/teacher/attendance"><Button icon={<QrCode size={16} />}>Tạo phiên</Button></Link></div> }
        ]} />
      </section>
    </div>
  );
}
