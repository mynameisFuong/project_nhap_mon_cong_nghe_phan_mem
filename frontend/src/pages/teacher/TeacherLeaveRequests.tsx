import { useMemo, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Textarea } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { teacherService } from "../../services";
import { getErrorMessage } from "../../services/apiClient";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../utils/useAsync";
import { shortDate } from "../../utils/format";
import type { LeaveRequest } from "../../types";

const leaveTone = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const leaveText = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối" };
const uploadBaseUrl = (() => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
  if (apiBaseUrl.startsWith("/")) return "";
  return apiBaseUrl.replace(/\/api\/?$/, "");
})();

const evidenceUrl = (path?: string | null) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  return `${uploadBaseUrl}/${normalized}`;
};

const evidenceKind = (path?: string | null) => {
  const lower = path?.toLowerCase() ?? "";
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  return "file";
};

export function TeacherLeaveRequests() {
  const { data, loading, reload } = useAsync(teacherService.leaveRequests, []);
  const { showToast } = useToast();
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState("");
  const selectedEvidenceUrl = evidenceUrl(selected?.evidencePath);
  const selectedEvidenceKind = evidenceKind(selected?.evidencePath);

  const rows = useMemo(() => (data ?? []).filter((item) => filter === "ALL" || item.status === filter), [data, filter]);

  const review = async (status: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    try {
      await teacherService.reviewLeave(selected.id, status, note);
      showToast(status === "APPROVED" ? "Đã duyệt đơn." : "Đã từ chối đơn.", "success");
      setSelected(null);
      setNote("");
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Đơn xin phép" description="Xem minh chứng, duyệt hoặc từ chối đơn xin nghỉ học của sinh viên." />
      <section className="panel">
        <div className="toolbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">Tất cả</option><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option></select>
        </div>
        <DataTable data={rows} columns={[
          { key: "student", header: "Sinh viên", render: (row) => <strong>{row.student?.fullName ?? "-"}</strong> },
          { key: "code", header: "MSSV", render: (row) => row.student?.studentCode ?? "-" },
          { key: "date", header: "Ngày gửi", render: (row) => shortDate(row.createdAt) },
          { key: "reason", header: "Lý do", render: (row) => row.reason },
          { key: "status", header: "Trạng thái", render: (row) => <Badge tone={leaveTone[row.status]}>{leaveText[row.status]}</Badge> },
          { key: "action", header: "Thao tác", render: (row) => <Button variant="outline" icon={<ExternalLink size={16} />} onClick={() => setSelected(row)}>Chi tiết</Button> }
        ]} />
      </section>
      <Modal open={Boolean(selected)} title="Chi tiết đơn xin phép" onClose={() => setSelected(null)}>
        <div className="detail-list">
          <p><strong>Sinh viên:</strong> {selected?.student?.fullName}</p>
          <p><strong>Lý do:</strong> {selected?.reason}</p>
          <div className="evidence-block">
            <strong>Minh chứng:</strong>
            {!selectedEvidenceUrl && <p>Không có minh chứng.</p>}
            {selectedEvidenceKind === "image" && <img className="evidence-preview" src={selectedEvidenceUrl} alt="Minh chứng đơn xin phép" />}
            {selectedEvidenceKind === "pdf" && <iframe className="evidence-frame" src={selectedEvidenceUrl} title="Minh chứng đơn xin phép" />}
            {selectedEvidenceUrl && (
              <a className="btn btn-outline" href={selectedEvidenceUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                <span>Mở minh chứng</span>
              </a>
            )}
          </div>
        </div>
        <Textarea label="Ghi chú xử lý" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="modal-actions">
          <Button variant="danger" icon={<X size={16} />} onClick={() => review("REJECTED")}>Từ chối</Button>
          <Button icon={<Check size={16} />} onClick={() => review("APPROVED")}>Duyệt</Button>
        </div>
      </Modal>
    </div>
  );
}
