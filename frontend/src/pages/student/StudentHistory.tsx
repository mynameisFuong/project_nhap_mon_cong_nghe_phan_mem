import { Badge } from "../../components/Badge";
import { DataTable } from "../../components/DataTable";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PageHeader } from "../../components/PageHeader";
import { studentService } from "../../services";
import { useAsync } from "../../utils/useAsync";
import { attendanceText, attendanceTone, shortDate, shortTime } from "../../utils/format";

export function StudentHistory() {
  const { data, loading } = useAsync(studentService.history, []);
  if (loading) return <LoadingSpinner />;
  return (
    <div className="page-stack">
      <PageHeader title="Lịch sử điểm danh" description="Tra cứu trạng thái điểm danh theo buổi học, học phần và học kỳ." />
      <section className="panel">
        <DataTable data={data ?? []} columns={[
          { key: "date", header: "Ngày học", render: (row) => shortDate(row.attendanceSession?.lesson?.lessonDate) },
          { key: "subject", header: "Môn học", render: (row) => row.attendanceSession?.courseSection?.subject?.name ?? "-" },
          { key: "status", header: "Trạng thái", render: (row) => <Badge tone={attendanceTone(row.status)}>{attendanceText[row.status]}</Badge> },
          { key: "time", header: "Giờ điểm danh", render: (row) => shortTime(row.markedAt) },
          { key: "note", header: "Ghi chú", render: (row) => row.reason ?? "-" }
        ]} />
      </section>
    </div>
  );
}
