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

const lessonLabel = (lesson?: { lessonDate?: string; startTime?: string; courseSection?: { code?: string; subject?: { name?: string } } }) =>
  `${shortDate(lesson?.lessonDate)} ${lesson?.startTime ?? ""} - ${lesson?.courseSection?.code ?? ""} - ${lesson?.courseSection?.subject?.name ?? "Học phần"}`;

export function StudentLeaves() {
  const history = useAsync(studentService.history, []);
  const schedule = useAsync(studentService.schedule, []);
  const leaves = useAsync(studentService.leaveRequests, []);
  const { showToast } = useToast();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const activeLeaveLessonIds = useMemo(
    () => new Set((leaves.data ?? [])
      .filter((leave) => leave.status !== "REJECTED")
      .map((leave) => leave.lessonId ?? leave.lesson?.id ?? leave.attendanceSession?.lessonId)
      .filter(Boolean)),
    [leaves.data]
  );

  const upcomingLessons = useMemo(
    () => (schedule.data ?? []).filter((lesson) => {
      const start = new Date(`${lesson.lessonDate}T${lesson.startTime}:00+07:00`);
      return start.getTime() > Date.now() && !activeLeaveLessonIds.has(lesson.id);
    }),
    [activeLeaveLessonIds, schedule.data]
  );

  const absentRecords = useMemo(
    () => (history.data ?? []).filter((record) =>
      record.status === "ABSENT_UNEXCUSED"
      && record.attendanceSession?.id
      && !activeLeaveLessonIds.has(record.attendanceSession.lessonId)
    ),
    [activeLeaveLessonIds, history.data]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target || !reason || !file) return showToast("Vui lòng chọn buổi học, nhập lý do và chọn file minh chứng.", "error");
    const [kind, id] = target.split(":");
    try {
      await studentService.createLeave(kind === "lesson" ? { lessonId: id } : { attendanceRecordId: id }, reason, file);
      showToast("Đã gửi đơn xin phép.", "success");
      setTarget("");
      setReason("");
      setFile(null);
      await Promise.all([leaves.reload(), history.reload(), schedule.reload()]);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (history.loading || schedule.loading || leaves.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Đơn xin phép" description="Gửi đơn trước buổi học theo lịch học hoặc gửi bổ sung cho buổi đã bị đánh dấu vắng không phép." />
      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <Select label="Buổi học / buổi vắng" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Chọn buổi học hoặc buổi vắng</option>
            {upcomingLessons.length > 0 && <option disabled>-- Xin phép trước buổi học --</option>}
            {upcomingLessons.map((lesson) => (
              <option key={lesson.id} value={`lesson:${lesson.id}`}>{lessonLabel(lesson)}</option>
            ))}
            {absentRecords.length > 0 && <option disabled>-- Xin phép sau khi đã vắng --</option>}
            {absentRecords.map((record) => (
              <option key={record.id} value={`record:${record.id}`}>
                {lessonLabel(record.attendanceSession?.lesson)} - {record.attendanceSession?.courseSection?.subject?.name ?? ""}
              </option>
            ))}
          </Select>
          <Textarea label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="dropzone compact">
            <Upload size={22} />
            <span>{file ? file.name : "Chọn ảnh/PDF minh chứng"}</span>
            <input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="full-span"><Button>Gửi đơn xin phép</Button></div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Đơn đã gửi</h2></div>
        <DataTable data={leaves.data ?? []} columns={[
          { key: "date", header: "Ngày gửi", render: (row) => shortDate(row.createdAt) },
          { key: "lesson", header: "Buổi học", render: (row) => lessonLabel(row.lesson ?? row.attendanceSession?.lesson) },
          { key: "reason", header: "Lý do", render: (row) => row.reason },
          { key: "status", header: "Trạng thái", render: (row) => <Badge tone={leaveTone[row.status]}>{leaveText[row.status]}</Badge> },
          { key: "note", header: "Ghi chú GV", render: (row) => row.reviewNote ?? "-" }
        ]} />
      </section>
    </div>
  );
}
