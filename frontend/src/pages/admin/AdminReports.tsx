import { AlertTriangle, BarChart3, BellRing, ChevronLeft, ChevronRight, Download, FileSpreadsheet, TrendingUp } from "lucide-react";
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

const warningExportHeaders = ["MSSV", "Họ tên", "Lớp", "Lớp học phần", "Học phần", "Số buổi vắng", "Tổng số buổi", "Tỷ lệ vắng", "Ngưỡng vắng"];

const getWarningExportRows = (warnings: WarningRow[]) => warnings.map((row) => [
  row.student.studentCode ?? "",
  row.student.fullName,
  row.student.class?.code ?? "",
  row.sectionCode,
  row.subjectName,
  row.absentCount,
  row.totalSessions,
  `${row.absencePercent}%`,
  `${row.thresholdPercent}%`
]);

const downloadBlob = (content: BlobPart, fileName: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const escapeCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const escapeHtmlValue = (value: string | number) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export function AdminReports() {
  const report = useAsync(() => adminService.overview() as Promise<ReportData>, []);
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [warningPage, setWarningPage] = useState(1);
  const [warningPageSize, setWarningPageSize] = useState(10);

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
  const warningPageCount = Math.max(1, Math.ceil(data.warnings.length / warningPageSize));
  const currentWarningPage = Math.min(warningPage, warningPageCount);
  const warningPageStart = (currentWarningPage - 1) * warningPageSize;
  const paginatedWarnings = data.warnings.slice(warningPageStart, warningPageStart + warningPageSize);

  const exportWarningsCsv = () => {
    if (!data.warnings.length) return showToast("Không có dữ liệu sinh viên cảnh báo vắng để xuất.", "info");
    const exportRows = getWarningExportRows(data.warnings);
    const csv = [
      warningExportHeaders.map(escapeCsvValue).join(","),
      ...exportRows.map((row) => row.map(escapeCsvValue).join(","))
    ].join("\r\n");
    downloadBlob(`\ufeff${csv}`, "sinh-vien-canh-bao-vang.csv", "text/csv;charset=utf-8");
    showToast("Đã xuất file CSV danh sách sinh viên cảnh báo vắng.", "success");
  };

  const exportWarningsExcel = () => {
    if (!data.warnings.length) return showToast("Không có dữ liệu sinh viên cảnh báo vắng để xuất.", "info");
    const exportRows = getWarningExportRows(data.warnings);
    const headerCells = warningExportHeaders.map((header) => `<th>${escapeHtmlValue(header)}</th>`).join("");
    const rows = exportRows.map((row) => (
      `<tr>${row.map((value) => `<td>${escapeHtmlValue(value)}</td>`).join("")}</tr>`
    )).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadBlob(html, "sinh-vien-canh-bao-vang.xls", "application/vnd.ms-excel;charset=utf-8");
    showToast("Đã xuất file Excel danh sách sinh viên cảnh báo vắng.", "success");
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
        <div className="toolbar">
          <div className="page-indicator">{data.warnings.length} sinh viên cảnh báo</div>
          <div className="row-actions">
            <Button type="button" variant="outline" icon={<Download size={16} />} onClick={exportWarningsCsv} disabled={!data.warnings.length}>
              CSV
            </Button>
            <Button type="button" variant="outline" icon={<FileSpreadsheet size={16} />} onClick={exportWarningsExcel} disabled={!data.warnings.length}>
              Excel
            </Button>
          </div>
        </div>
        <DataTable
          data={paginatedWarnings}
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
        {data.warnings.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-summary">
              Hiển thị {warningPageStart + 1}-{Math.min(warningPageStart + warningPageSize, data.warnings.length)} / {data.warnings.length} sinh viên
            </div>
            <div className="pagination-controls">
              <select value={warningPageSize} onChange={(event) => { setWarningPageSize(Number(event.target.value)); setWarningPage(1); }} aria-label="So sinh vien canh bao moi trang">
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
              <Button variant="outline" icon={<ChevronLeft size={16} />} onClick={() => setWarningPage((value) => Math.max(1, value - 1))} disabled={currentWarningPage === 1}>Trước</Button>
              <span className="page-indicator">Trang {currentWarningPage} / {warningPageCount}</span>
              <Button variant="outline" icon={<ChevronRight size={16} />} onClick={() => setWarningPage((value) => Math.min(warningPageCount, value + 1))} disabled={currentWarningPage === warningPageCount}>Sau</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
