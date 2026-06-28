import { CalendarDays } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/Badge";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { studentService } from "../../services";
import { useAsync } from "../../utils/useAsync";

export function StudentCourses() {
  const { data, loading } = useAsync(studentService.sections, []);
  if (loading) return <LoadingSpinner />;
  return (
    <div className="page-stack">
      <PageHeader title="Học phần của tôi" description="Danh sách lớp học phần bạn đã đăng ký trong học kỳ hiện tại." />
      <section className="panel">
        <DataTable data={data ?? []} columns={[
          { key: "code", header: "Mã lớp", render: (row) => <strong>{row.courseSection.code}</strong> },
          { key: "subject", header: "Học phần", render: (row) => row.courseSection.subject?.name ?? "-" },
          { key: "teacher", header: "Giảng viên", render: (row) => row.courseSection.teacher?.fullName ?? "-" },
          { key: "semester", header: "Học kỳ", render: (row) => row.courseSection.semester?.name ?? "-" },
          { key: "status", header: "Trạng thái", render: () => <Badge tone="success"><CalendarDays size={13} /> Đang học</Badge> }
        ]} />
      </section>
    </div>
  );
}
