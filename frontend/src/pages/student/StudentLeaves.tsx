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
  const sections = useAsync(studentService.sections, []);
  const schedule = useAsync(studentService.schedule, []);
  const leaves = useAsync(studentService.leaveRequests, []);
  const { showToast } = useToast();
  const [sectionId, setSectionId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const activeLeaveByLessonId = useMemo(
    () => new Map((leaves.data ?? [])
      .filter((leave) => leave.status !== "REJECTED")
      .map((leave) => [leave.lessonId ?? leave.lesson?.id ?? leave.attendanceSession?.lessonId, leave.status] as const)
      .filter(([id]) => Boolean(id))),
    [leaves.data]
  );

  const sectionLessons = useMemo(
    () => (schedule.data ?? []).filter((lesson) =>
      (lesson.courseSectionId === sectionId || lesson.courseSection?.id === sectionId)
    ),
    [schedule.data, sectionId]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!sectionId || !lessonId || !reason || !file) return showToast("Vui lòng chọn lớp học phần, buổi học, nhập lý do và chọn file minh chứng.", "error");
    try {
      await studentService.createLeave({ lessonId }, reason, file);
      showToast("Đã gửi đơn xin phép.", "success");
      setLessonId("");
      setReason("");
      setFile(null);
      await Promise.all([leaves.reload(), history.reload(), schedule.reload()]);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (history.loading || sections.loading || schedule.loading || leaves.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Đơn xin phép" description="Chọn lớp học phần, chọn buổi học cần xin nghỉ, nhập lý do và gửi minh chứng." />
      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <Select
            label="Lớp học phần"
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setLessonId("");
            }}
          >
            <option value="">Chọn lớp học phần</option>
            {(sections.data ?? []).map(({ courseSection }) => (
              <option key={courseSection.id} value={courseSection.id}>
                {courseSection.code} - {courseSection.subject?.name ?? "Học phần"} - {courseSection.teacher?.fullName ?? "Giảng viên"}
              </option>
            ))}
          </Select>
          <Select label="Buổi học" value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!sectionId}>
            <option value="">{sectionId ? "Chọn buổi học" : "Chọn lớp học phần trước"}</option>
            {sectionLessons.map((lesson) => {
              const leaveStatus = activeLeaveByLessonId.get(lesson.id);
              return (
                <option key={lesson.id} value={lesson.id} disabled={Boolean(leaveStatus)}>
                  {lessonLabel(lesson)}{leaveStatus ? ` - Đã gửi đơn (${leaveText[leaveStatus]})` : ""}
                </option>
              );
            })}
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
