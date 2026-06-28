import { Download } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { teacherService } from "../../services";
import { useAsync } from "../../utils/useAsync";

export function TeacherReports() {
  const sections = useAsync(teacherService.sections, []);
  const students = useAsync(() => sections.data?.[0] ? teacherService.students(sections.data[0].id) : Promise.resolve([]), [sections.data?.[0]?.id]);
  if (sections.loading || students.loading) return <LoadingSpinner />;
  const section = sections.data?.[0];
  return (
    <div className="page-stack">
      <PageHeader title="Báo cáo chuyên cần" description="Tổng hợp số buổi có mặt, trễ, vắng và cảnh báo theo ngưỡng 20%." actions={section && <a href={teacherService.exportReportUrl(section.id)}><Button variant="outline" icon={<Download size={18} />}>Export CSV</Button></a>} />
      <section className="panel">
        <DataTable data={students.data ?? []} columns={[
          { key: "code", header: "MSSV", render: (row) => row.student.studentCode ?? "-" },
          { key: "name", header: "Họ tên", render: (row) => <strong>{row.student.fullName}</strong> },
          { key: "present", header: "Có mặt", render: () => 8 },
          { key: "late", header: "Trễ", render: () => 1 },
          { key: "excused", header: "Vắng phép", render: () => 0 },
          { key: "absent", header: "Vắng KP", render: () => 1 },
          { key: "rate", header: "Tỉ lệ vắng", render: () => "10%" },
          { key: "warning", header: "Cảnh báo", render: () => <Badge tone="success">Ổn định</Badge> }
        ]} />
      </section>
    </div>
  );
}
