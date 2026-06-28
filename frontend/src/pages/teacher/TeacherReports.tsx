import { Download, Eye } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { teacherService } from "../../services";
import { useAsync } from "../../utils/useAsync";
import type { TeacherSectionReport } from "../../types";

export function TeacherReports() {
  const reports = useAsync(teacherService.reports, []);
  const [selected, setSelected] = useState<TeacherSectionReport | null>(null);

  if (reports.loading) return <LoadingSpinner />;

  const data = reports.data ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        title="Báo cáo chuyên cần"
        description="Tổng hợp tỷ lệ chuyên cần theo các lớp học phần giảng viên đang phụ trách."
      />
      <section className="panel">
        <DataTable
          data={data}
          emptyTitle="Chưa có lớp học phần phụ trách"
          columns={[
            { key: "code", header: "Lớp học phần", render: (row) => <strong>{row.code}</strong> },
            { key: "subject", header: "Học phần", render: (row) => row.subject?.name ?? "-" },
            { key: "semester", header: "Học kỳ", render: (row) => row.semester?.name ?? "-" },
            { key: "students", header: "Sinh viên", render: (row) => row.totalStudents },
            { key: "sessions", header: "Phiên đã đóng", render: (row) => row.totalSessions },
            { key: "attendance", header: "Tỷ lệ chuyên cần", render: (row) => `${row.attendancePercent}%` },
            { key: "absence", header: "Tỷ lệ vắng", render: (row) => `${row.absencePercent}%` },
            {
              key: "warning",
              header: "Cảnh báo",
              render: (row) => row.warningCount
                ? <Badge tone="danger">{row.warningCount} sinh viên</Badge>
                : <Badge tone="success">Ổn định</Badge>
            },
            {
              key: "actions",
              header: "Thao tác",
              render: (row) => (
                <div className="row-actions">
                  <Button variant="outline" icon={<Eye size={16} />} onClick={() => setSelected(row)}>Chi tiết</Button>
                  <a className="btn btn-outline" href={teacherService.exportReportUrl(row.id)}>
                    <Download size={16} />
                    <span>CSV</span>
                  </a>
                </div>
              )
            }
          ]}
        />
      </section>

      <Modal
        open={Boolean(selected)}
        title={`Chi tiết cảnh báo ${selected?.code ?? ""}`}
        onClose={() => setSelected(null)}
        className="modal-wide"
      >
        {selected && (
          <div className="page-stack">
            <div className="summary-metrics compact-metrics">
              <div><strong>{selected.totalSessions}</strong><span>Phiên đã đóng</span></div>
              <div><strong>{selected.thresholdAbsences}</strong><span>Ngưỡng vắng</span></div>
              <div><strong>{selected.warningCount}</strong><span>SV cảnh báo</span></div>
            </div>
            <DataTable
              data={selected.students}
              emptyTitle="Chưa có sinh viên trong lớp này"
              columns={[
                { key: "code", header: "MSSV", render: (row) => row.student.studentCode ?? "-" },
                { key: "name", header: "Họ tên", render: (row) => <strong>{row.student.fullName}</strong> },
                { key: "class", header: "Lớp", render: (row) => row.student.class?.code ?? "-" },
                { key: "present", header: "Có mặt", render: (row) => row.presentCount },
                { key: "late", header: "Trễ", render: (row) => row.lateCount },
                { key: "excused", header: "Vắng phép", render: (row) => row.absentExcusedCount },
                { key: "unexcused", header: "Vắng KP", render: (row) => row.absentUnexcusedCount },
                { key: "absent", header: "Vắng/ngưỡng", render: (row) => `${row.absentCount}/${row.thresholdAbsences}` },
                { key: "rate", header: "Tỷ lệ vắng", render: (row) => `${row.absencePercent}%` },
                {
                  key: "warning",
                  header: "Cảnh báo",
                  render: (row) => row.warning
                    ? <Badge tone="danger">Vượt ngưỡng</Badge>
                    : <Badge tone="success">Ổn định</Badge>
                }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
