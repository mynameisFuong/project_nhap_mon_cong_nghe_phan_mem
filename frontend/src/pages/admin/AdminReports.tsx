import { AlertTriangle, BarChart3, BellRing, Download, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { adminService } from "../../services";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../services/apiClient";
import { useAsync } from "../../utils/useAsync";
import { LoadingSpinner } from "../../components/LoadingSpinner";

type WarningRow = {
  sectionCode: string;
  subjectName: string;
  teacherName: string;
  student: {
    studentCode?: string | null;
    fullName: string;
    email: string;
    class?: { code: string } | null;
  };
  absentCount: number;
  totalSessions: number;
  absencePercent: number;
  thresholdPercent: number;
};

type SectionReport = {
  id: string;
  code: string;
  subject?: { name: string };
  teacher?: { fullName: string };
  totalStudents: number;
  totalSessions: number;
  attendancePercent: number;
  warningCount: number;
};

type ReportData = {
  summary: {
    attendancePercent: number;
    sessionCount: number;
    warningCount: number;
  };
  sections: SectionReport[];
  warnings: WarningRow[];
};

export function AdminReports() {
  const report = useAsync(() => adminService.overview() as Promise<ReportData>, []);
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);

  const sendWarnings = async () => {
    try {
      setSending(true);
      const result = await adminService.sendAttendanceWarnings();
      showToast(`Đã gửi ${result.totalNotifications} thông báo cảnh báo.`, "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  if (report.loading) return <LoadingSpinner />;

  const data = report.data ?? {
    summary: { attendancePercent: 100, sessionCount: 0, warningCount: 0 },
    sections: [],
    warnings: []
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Báo cáo tổng quan"
        description="Tổng hợp chuyên cần theo lớp học phần, học kỳ và cảnh báo sinh viên vắng cao."
        actions={(
          <>
            <Button variant="outline" icon={<BellRing size={18} />} onClick={sendWarnings} disabled={sending}>
              {sending ? "Đang gửi" : "Gửi cảnh báo"}
            </Button>
            <Button variant="outline" icon={<Download size={18} />}>Export</Button>
          </>
        )}
      />
      <div className="stat-grid">
        <StatCard title="Tỉ lệ chuyên cần" value={`${data.summary.attendancePercent}%`} icon={<TrendingUp />} />
        <StatCard title="Phiên đã đóng" value={data.summary.sessionCount} icon={<BarChart3 />} tone="blue" />
        <StatCard title="Cảnh báo vắng" value={data.summary.warningCount} icon={<AlertTriangle />} tone="red" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Tổng hợp lớp học phần</h2>
          <p>Tính theo các phiên điểm danh đã đóng.</p>
        </div>
        <DataTable
          data={data.sections}
          columns={[
            { key: "section", header: "Lớp học phần", render: (row) => <strong>{row.code}</strong> },
            { key: "subject", header: "Học phần", render: (row) => row.subject?.name ?? "-" },
            { key: "teacher", header: "Giảng viên", render: (row) => row.teacher?.fullName ?? "-" },
            { key: "students", header: "Sinh viên", render: (row) => row.totalStudents },
            { key: "sessions", header: "Phiên đã đóng", render: (row) => row.totalSessions },
            { key: "attendance", header: "Chuyên cần", render: (row) => `${row.attendancePercent}%` },
            {
              key: "warning",
              header: "Cảnh báo",
              render: (row) => row.warningCount
                ? <Badge tone="danger">{row.warningCount} sinh viên</Badge>
                : <Badge tone="success">Ổn định</Badge>
            }
          ]}
        />
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Sinh viên cảnh báo vắng</h2>
          <p>Sinh viên có tỷ lệ vắng đạt hoặc vượt ngưỡng của lớp học phần.</p>
        </div>
        <DataTable
          data={data.warnings}
          emptyTitle="Chưa có sinh viên bị cảnh báo vắng"
          columns={[
            { key: "studentCode", header: "MSSV", render: (row) => row.student.studentCode ?? "-" },
            { key: "name", header: "Họ tên", render: (row) => <strong>{row.student.fullName}</strong> },
            { key: "class", header: "Lớp", render: (row) => row.student.class?.code ?? "-" },
            { key: "section", header: "Lớp học phần", render: (row) => row.sectionCode },
            { key: "subject", header: "Học phần", render: (row) => row.subjectName },
            { key: "absent", header: "Số buổi vắng", render: (row) => `${row.absentCount}/${row.totalSessions}` },
            {
              key: "rate",
              header: "Tỷ lệ vắng",
              render: (row) => <Badge tone="danger">{row.absencePercent}% / ngưỡng {row.thresholdPercent}%</Badge>
            }
          ]}
        />
      </section>
    </div>
  );
}
