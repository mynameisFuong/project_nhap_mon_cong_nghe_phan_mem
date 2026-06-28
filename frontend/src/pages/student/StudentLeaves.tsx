import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/Badge";
import { Select, Textarea } from "../../components/FormField";
import { Button } from "../../components/Button";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { studentService } from "../../services";
import { getErrorMessage } from "../../services/apiClient";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../utils/useAsync";
import { shortDate } from "../../utils/format";

const leaveTone = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const leaveText = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối" };

export function StudentLeaves() {
  const history = useAsync(studentService.history, []);
  const leaves = useAsync(studentService.leaveRequests, []);
  const { showToast } = useToast();
  const [attendanceRecordId, setAttendanceRecordId] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const absentRecords = useMemo(
    () => {
      const blockedRecordIds = new Set((leaves.data ?? [])
        .filter((leave) => leave.status !== "REJECTED" && leave.attendanceRecordId)
        .map((leave) => leave.attendanceRecordId));
      return (history.data ?? []).filter((record) =>
        record.status === "ABSENT_UNEXCUSED"
        && record.attendanceSession?.id
        && !blockedRecordIds.has(record.id)
      );
    },
    [history.data, leaves.data]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!attendanceRecordId || !reason || !file) return showToast("Vui lòng chọn buổi vắng, nhập lý do và chọn file minh chứng.", "error");
    try {
      await studentService.createLeave(attendanceRecordId, reason, file);
      showToast("Đã gửi đơn xin phép.", "success");
      setAttendanceRecordId("");
      setReason("");
      setFile(null);
      await leaves.reload();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (history.loading || leaves.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Đơn xin phép" description="Gửi đơn cho các buổi đã bị đánh dấu vắng, bắt buộc có lý do và minh chứng." />
      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <Select label="Buổi vắng" value={attendanceRecordId} onChange={(e) => setAttendanceRecordId(e.target.value)}>
            <option value="">Chọn buổi vắng</option>
            {absentRecords.map((record) => <option key={record.id} value={record.id}>{shortDate(record.attendanceSession?.lesson?.lessonDate)} - {record.attendanceSession?.courseSection?.subject?.name}</option>)}
          </Select>
          <Textarea label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="dropzone compact"><Upload size={22} /><span>{file ? file.name : "Chọn ảnh/PDF minh chứng"}</span><input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <div className="full-span"><Button>Gửi đơn xin phép</Button></div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Đơn đã gửi</h2></div>
        <DataTable data={leaves.data ?? []} columns={[
          { key: "date", header: "Ngày gửi", render: (row) => shortDate(row.createdAt) },
          { key: "reason", header: "Lý do", render: (row) => row.reason },
          { key: "status", header: "Trạng thái", render: (row) => <Badge tone={leaveTone[row.status]}>{leaveText[row.status]}</Badge> },
          { key: "note", header: "Ghi chú GV", render: (row) => row.reviewNote ?? "-" }
        ]} />
      </section>
    </div>
  );
}
