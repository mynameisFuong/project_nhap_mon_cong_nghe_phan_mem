import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarPlus, CheckCircle2, Download, FileUp, Play, QrCode, Square, Users } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { Input, Select, Textarea } from "../../components/FormField";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/Badge";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { teacherService } from "../../services";
import { getErrorMessage } from "../../services/apiClient";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../utils/useAsync";
import { attendanceText, attendanceTone, shortTime } from "../../utils/format";
import type { AttendanceRecord, AttendanceSession, AttendanceSessionSummary, Lesson, StudentInSection, User } from "../../types";

type SessionOption = AttendanceSession & { lesson: Lesson };

export function AttendanceSessionPage() {
  const { showToast } = useToast();
  const sections = useAsync(teacherService.sections, []);
  const openSession = useAsync(teacherService.openSession, []);
  const [sectionId, setSectionId] = useState("");
  const lessons = useAsync(() => sectionId ? teacherService.lessons(sectionId) : Promise.resolve([]), [sectionId]);
  const students = useAsync(() => sectionId ? teacherService.students(sectionId) : Promise.resolve([]), [sectionId]);
  const [lessonId, setLessonId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [qr, setQr] = useState<{ qrDataUrl: string; otp: string; validSeconds: number } | null>(null);
  const [qrCountdown, setQrCountdown] = useState(30);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"session" | "review">("session");
  const [reviewSessionId, setReviewSessionId] = useState("");
  const [summary, setSummary] = useState<AttendanceSessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [manual, setManual] = useState<StudentInSection | null>(null);
  const [reason, setReason] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    lessonDate: todayInputValue(),
    startTime: "07:30",
    endTime: "09:30",
    room: "",
    topic: ""
  });
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [importingSchedule, setImportingSchedule] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const sectionLessons = useMemo(() => (lessons.data ?? []).filter((lesson) => !lesson.courseSectionId || lesson.courseSectionId === sectionId), [lessons.data, sectionId]);
  const selectedSection = useMemo(() => (sections.data ?? []).find((section) => section.id === sectionId), [sections.data, sectionId]);
  const selectableLessons = sectionLessons;
  const selectedLesson = useMemo(() => selectableLessons.find((lesson) => lesson.id === lessonId), [selectableLessons, lessonId]);
  const canCreateSelectedLesson = Boolean(selectedLesson && isLessonInTimeWindow(selectedLesson, now));
  const sessionOptions = useMemo<SessionOption[]>(() => sectionLessons.flatMap((lesson) =>
    (lesson.sessions?.length ? lesson.sessions : lesson.session ? [lesson.session] : [])
      .map((session) => ({ ...session, lesson }))
  ), [sectionLessons]);

  useEffect(() => {
    if (!sectionId && sections.data?.[0]) setSectionId(sections.data[0].id);
  }, [sections.data, sectionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void openSession.reload();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sectionId) return;
    const timer = window.setInterval(() => {
      void lessons.reload();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [sectionId]);

  useEffect(() => {
    if (!selectableLessons.length) {
      if (lessonId) setLessonId("");
      return;
    }
    if (!lessonId || !selectableLessons.some((lesson) => lesson.id === lessonId)) {
      setLessonId(selectableLessons.find((lesson) => isLessonInTimeWindow(lesson, now))?.id ?? selectableLessons[0].id);
    }
  }, [selectableLessons, lessonId, now]);

  useEffect(() => {
    const hasSelectedSession = sessionOptions.some((session) => session.id === reviewSessionId);
    const nextSessionId = sessionOptions[0]?.id ?? "";
    if (!hasSelectedSession && reviewSessionId !== nextSessionId) setReviewSessionId(nextSessionId);
  }, [reviewSessionId, sessionOptions]);

  useEffect(() => {
    if (!sessionId) return;
    let refreshTimer: number | undefined;
    let active = true;

    const load = async () => {
      try {
        const [nextQr, nextRecords] = await Promise.all([teacherService.qrOtp(sessionId), teacherService.records(sessionId)]);
        if (!active) return;
        setQr(nextQr);
        setQrCountdown(nextQr.validSeconds);
        setRecords(nextRecords);
        refreshTimer = window.setTimeout(load, Math.max(nextQr.validSeconds, 1) * 1000 + 250);
      } catch (err) {
        if (!active) return;
        setSessionId("");
        setQr(null);
        setQrCountdown(30);
        setRecords([]);
        await lessons.reload();
        showToast(getErrorMessage(err), "error");
      }
    };
    void load();
    return () => {
      active = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [sessionId, showToast]);

  useEffect(() => {
    if (!sessionId || !qr) return;
    const timer = window.setInterval(() => {
      setQrCountdown((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionId, qr]);

  useEffect(() => {
    if (!reviewSessionId) {
      setSummary(null);
      return;
    }

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        setSummary(await teacherService.sessionSummary(reviewSessionId));
      } catch (err) {
        showToast(getErrorMessage(err), "error");
      } finally {
        setSummaryLoading(false);
      }
    };

    void loadSummary();
  }, [reviewSessionId, showToast]);

  const attendedIds = useMemo(() => new Set(records.map((record) => record.student?.id)), [records]);
  const notYet = (students.data ?? []).filter((item) => !attendedIds.has(item.student.id));

  const changeSection = (nextSectionId: string) => {
    setSectionId(nextSectionId);
    setLessonId("");
    setReviewSessionId("");
    setSummary(null);
    setSessionId("");
    setQr(null);
    setQrCountdown(30);
    setRecords([]);
    setManual(null);
  };

  const exportAttended = async () => {
    if (!reviewSessionId) return;
    try {
      const blob = await teacherService.exportSessionAttended(reviewSessionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "danh-sach-da-diem-danh.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const createSession = async () => {
    if (sessionId) return showToast("Vui lòng kết thúc phiên đang mở trước khi tạo phiên mới.", "error");
    if (!lessonId) return showToast("Không còn buổi học nào có thể tạo phiên.", "error");
    if (!selectedLesson) return showToast("Vui lòng chọn buổi học trong lịch học.", "error");
    if (!canCreateSelectedLesson) return showToast("Chỉ được tạo phiên trong đúng ngày và khung giờ diễn ra buổi học.", "error");
    try {
      const session: any = await teacherService.createSession(lessonId);
      setSessionId(session.id);
      setReviewSessionId(session.id);
      setActiveTab("session");
      await Promise.all([lessons.reload(), openSession.reload()]);
      showToast("Đã tạo phiên điểm danh.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const createLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sectionId) return showToast("Vui lòng chọn lớp học phần.", "error");
    if (lessonForm.endTime <= lessonForm.startTime) {
      return showToast("Giờ kết thúc phải sau giờ bắt đầu.", "error");
    }

    try {
      setCreatingLesson(true);
      const lesson = await teacherService.createLesson(sectionId, {
        lessonDate: lessonForm.lessonDate,
        startTime: lessonForm.startTime,
        endTime: lessonForm.endTime,
        room: lessonForm.room.trim() || undefined,
        topic: lessonForm.topic.trim() || undefined
      });
      await Promise.all([lessons.reload(), openSession.reload()]);
      setLessonId(lesson.id);
      setLessonForm((current) => ({ ...current, topic: "" }));
      showToast("Đã thêm buổi học. Bạn có thể tạo phiên ngay.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setCreatingLesson(false);
    }
  };

  const importSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sectionId) return showToast("Vui lòng chọn lớp học phần.", "error");
    if (!scheduleFile) return showToast("Vui lòng chọn file lịch học.", "error");

    try {
      setImportingSchedule(true);
      const result = await teacherService.importLessons(sectionId, scheduleFile);
      setScheduleFile(null);
      await lessons.reload();
      showToast(`Đã import ${result.successRows}/${result.totalRows} buổi học.`, result.failedRows ? "error" : "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImportingSchedule(false);
    }
  };

  const markManual = async () => {
    if (!manual || !reason.trim()) return showToast("Cần nhập lý do điểm danh thủ công.", "error");
    try {
      await teacherService.manualMark(sessionId, manual.student.id, reason);
      setManual(null);
      setReason("");
      setRecords(await teacherService.records(sessionId));
      showToast("Đã điểm danh thủ công.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const close = async () => {
    try {
      const closedSessionId = sessionId;
      await teacherService.closeSession(sessionId);
      setConfirmClose(false);
      setSessionId("");
      setQr(null);
      setQrCountdown(30);
      setRecords([]);
      setManual(null);
      setReason("");
      await lessons.reload();
      setReviewSessionId(closedSessionId);
      setSummary(await teacherService.sessionSummary(closedSessionId));
      setActiveTab("review");
      showToast("Đã kết thúc phiên.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const openActiveSession = () => {
    if (!openSession.data) return;
    if (openSession.data.courseSectionId !== sectionId) {
      changeSection(openSession.data.courseSectionId);
    }
    setSessionId(openSession.data.id);
    setReviewSessionId(openSession.data.id);
    setActiveTab("session");
  };

  const closeActiveSession = async () => {
    if (!openSession.data) return;
    try {
      const closedSessionId = openSession.data.id;
      await teacherService.closeSession(closedSessionId);
      if (sessionId === closedSessionId) {
        setSessionId("");
        setQr(null);
        setQrCountdown(30);
        setRecords([]);
        setManual(null);
        setReason("");
      }
      await Promise.all([lessons.reload(), openSession.reload()]);
      setReviewSessionId(closedSessionId);
      setSummary(await teacherService.sessionSummary(closedSessionId));
      setActiveTab("review");
      showToast("Đã kết thúc phiên đang mở.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (sections.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Phiên điểm danh QR + OTP" description="Tạo phiên, trình chiếu QR/OTP xoay vòng 30 giây và theo dõi sinh viên đã điểm danh." />
      <div className="tabs" role="tablist" aria-label="Phiên điểm danh">
        <button type="button" className={activeTab === "session" ? "active" : ""} onClick={() => setActiveTab("session")}>Phiên điểm danh</button>
        <button type="button" className={activeTab === "review" ? "active" : ""} onClick={() => setActiveTab("review")}>Xem lại phiên</button>
      </div>

      {activeTab === "session" && (
        <>
      {openSession.data && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Phiên đang mở</h2>
              <p>
                {openSession.data.courseSection?.code} - {openSession.data.courseSection?.subject?.name}
                {" | "}
                {openSession.data.lesson?.lessonDate.slice(0, 10)} {openSession.data.lesson?.startTime}-{openSession.data.lesson?.endTime}
              </p>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="outline" icon={<QrCode size={18} />} onClick={openActiveSession}>Mở phiên</Button>
              <Button type="button" variant="danger" icon={<Square size={18} />} onClick={closeActiveSession}>Kết thúc phiên</Button>
            </div>
          </div>
        </section>
      )}
      <section className="panel session-config">
        <Select label="Lớp học phần" value={sectionId} onChange={(e) => changeSection(e.target.value)}>
          {(sections.data ?? []).map((section) => <option key={section.id} value={section.id}>{section.code} - {section.subject?.name}</option>)}
        </Select>
        <Select label="Buổi học" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          {selectableLessons.length ? selectableLessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {formatLessonOption(lesson, selectedSection)}
            </option>
          )) : <option value="">Chưa có lịch học từ file import</option>}
        </Select>
        <Button icon={<Play size={18} />} onClick={createSession} disabled={!canCreateSelectedLesson}>Tạo phiên</Button>
      </section>
      {selectedLesson && !canCreateSelectedLesson && (
        <p className="muted-text">
          Chỉ có thể tạo phiên trong khung giờ {selectedLesson.startTime}-{selectedLesson.endTime} ngày {selectedLesson.lessonDate.slice(0, 10)}.
        </p>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Thêm buổi học</h2>
            <p>Tạo buổi học mới cho lớp đang chọn rồi mở phiên điểm danh ngay trên trang này.</p>
          </div>
        </div>
        <form className="lesson-create-grid" onSubmit={createLesson}>
          <Input label="Ngày học" type="date" value={lessonForm.lessonDate} onChange={(e) => setLessonForm({ ...lessonForm, lessonDate: e.target.value })} required />
          <Input label="Bắt đầu" type="time" value={lessonForm.startTime} onChange={(e) => setLessonForm({ ...lessonForm, startTime: e.target.value })} required />
          <Input label="Kết thúc" type="time" value={lessonForm.endTime} onChange={(e) => setLessonForm({ ...lessonForm, endTime: e.target.value })} required />
          <Input label="Phòng" value={lessonForm.room} onChange={(e) => setLessonForm({ ...lessonForm, room: e.target.value })} placeholder="VD: A101" />
          <Input label="Nội dung" value={lessonForm.topic} onChange={(e) => setLessonForm({ ...lessonForm, topic: e.target.value })} placeholder="VD: Chương 3" />
          <Button type="submit" icon={<CalendarPlus size={18} />} disabled={creatingLesson || !sectionId}>
            {creatingLesson ? "Đang thêm" : "Thêm buổi"}
          </Button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Import lịch học</h2>
            <p>Nhận file Excel hoặc CSV với các cột Ngày học, Bắt đầu, Kết thúc, Phòng, Nội dung.</p>
          </div>
          <a className="btn btn-outline" href="/templates/import-lich-hoc-mau.csv" download>
            <Download size={18} />
            <span>Tải mẫu</span>
          </a>
        </div>
        <form className="session-config" onSubmit={importSchedule}>
          <Input label="File lịch học" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setScheduleFile(event.target.files?.[0] ?? null)} />
          <div />
          <Button type="submit" icon={<FileUp size={18} />} disabled={importingSchedule || !sectionId || !scheduleFile}>
            {importingSchedule ? "Đang import" : "Import lịch"}
          </Button>
        </form>
      </section>
        </>
      )}

      {activeTab === "review" && (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Xem lại phiên điểm danh</h2>
            <p>Chọn một phiên để xem sinh viên đã điểm danh, chưa điểm danh và xuất Excel.</p>
          </div>
          <Button type="button" variant="outline" icon={<Download size={18} />} onClick={exportAttended} disabled={!summary?.attended.length}>
            Xuất Excel
          </Button>
        </div>
        <div className="review-toolbar">
          <Select label="Lớp học phần" value={sectionId} onChange={(e) => changeSection(e.target.value)}>
            {(sections.data ?? []).map((section) => <option key={section.id} value={section.id}>{section.code} - {section.subject?.name}</option>)}
          </Select>
          <Select label="Phiên điểm danh" value={reviewSessionId} onChange={(event) => setReviewSessionId(event.target.value)}>
            {sessionOptions.length ? sessionOptions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.lesson.lessonDate.slice(0, 10)} - {session.lesson.startTime} - {session.lesson.endTime} ({session.status === "OPEN" ? "Đang mở" : "Đã kết thúc"})
              </option>
            )) : <option value="">Chưa có phiên điểm danh</option>}
          </Select>
        </div>
        {summaryLoading ? <LoadingSpinner /> : summary && (
          <div className="session-review-grid">
            <div>
              <div className="panel-head compact"><h2>Đã điểm danh ({summary.attended.length})</h2></div>
              <DataTable data={summary.attended} emptyTitle="Chưa có sinh viên điểm danh" columns={[
                { key: "code", header: "MSSV", render: (row) => row.student?.studentCode ?? "-" },
                { key: "name", header: "Họ tên", render: (row) => <strong>{row.student?.fullName}</strong> },
                { key: "time", header: "Thời gian", render: (row) => shortTime(row.markedAt) },
                { key: "status", header: "Trạng thái", render: (row) => <Badge tone={attendanceTone(row.status)}>{attendanceText[row.status]}</Badge> }
              ]} />
            </div>
            <div>
              <div className="panel-head compact"><h2>Chưa điểm danh ({summary.notAttended.length})</h2></div>
              <DataTable data={summary.notAttended} emptyTitle="Tất cả sinh viên đã điểm danh" columns={[
                { key: "code", header: "MSSV", render: (row) => reviewStudent(row)?.studentCode ?? "-" },
                { key: "name", header: "Họ tên", render: (row) => <strong>{reviewStudent(row)?.fullName ?? "-"}</strong> },
                { key: "email", header: "Email", render: (row) => reviewStudent(row)?.email ?? "-" },
                { key: "status", header: "Trạng thái", render: (row) => "status" in row ? <Badge tone={attendanceTone(row.status)}>{attendanceText[row.status]}</Badge> : <Badge tone="neutral">Chưa có mặt</Badge> }
              ]} />
            </div>
          </div>
        )}
      </section>
      )}

      {activeTab === "session" && sessionId && (
        <section className="qr-stage">
          <div className="qr-card">
            <div className="status-pill"><CheckCircle2 size={16} /> Đang mở</div>
            {qr?.qrDataUrl ? <img src={qr.qrDataUrl} alt="QR điểm danh" /> : <div className="qr-placeholder"><QrCode size={160} /></div>}
            <div className="otp">{qr?.otp ?? "------"}</div>
            <p>Đổi mã sau {qr ? qrCountdown : 30}s</p>
            <Button variant="danger" icon={<Square size={16} />} onClick={() => setConfirmClose(true)}>Kết thúc phiên</Button>
          </div>
          <div className="live-panel">
            <div className="mini-stats">
              <StatMini label="Đã điểm danh" value={records.length} />
              <StatMini label="Chưa điểm danh" value={notYet.length} />
              <StatMini label="Tổng sinh viên" value={(students.data ?? []).length} />
            </div>
            <DataTable data={records} emptyTitle="Chưa có sinh viên điểm danh" columns={[
              { key: "code", header: "MSSV", render: (row) => row.student?.studentCode ?? "-" },
              { key: "name", header: "Họ tên", render: (row) => <strong>{row.student?.fullName}</strong> },
              { key: "time", header: "Thời gian", render: (row) => shortTime(row.markedAt) },
              { key: "status", header: "Trạng thái", render: (row) => <Badge tone={attendanceTone(row.status)}>{attendanceText[row.status]}</Badge> }
            ]} />
          </div>
        </section>
      )}

      {activeTab === "session" && sessionId && (
        <section className="panel">
          <div className="panel-head"><h2>Chưa điểm danh</h2><p>Giảng viên có thể điểm danh thủ công khi sinh viên gặp sự cố kỹ thuật.</p></div>
          <DataTable data={notYet} emptyTitle="Tất cả sinh viên đã điểm danh" columns={[
            { key: "code", header: "MSSV", render: (row) => row.student.studentCode ?? "-" },
            { key: "name", header: "Họ tên", render: (row) => <strong>{row.student.fullName}</strong> },
            { key: "action", header: "Thao tác", render: (row) => <Button variant="outline" icon={<Users size={16} />} onClick={() => setManual(row)}>Điểm danh thủ công</Button> }
          ]} />
        </section>
      )}

      <Modal open={Boolean(manual)} title="Điểm danh thủ công" onClose={() => setManual(null)}>
        <Textarea label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: máy sinh viên không quét được QR" />
        <div className="modal-actions"><Button variant="outline" onClick={() => setManual(null)}>Hủy</Button><Button onClick={markManual}>Xác nhận</Button></div>
      </Modal>
      <ConfirmDialog open={confirmClose} title="Kết thúc phiên?" message="Sinh viên chưa điểm danh sẽ tự động bị đánh dấu vắng không phép." confirmText="Kết thúc" onCancel={() => setConfirmClose(false)} onConfirm={close} />
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return <div className="stat-mini"><Users size={18} /><strong>{value}</strong><span>{label}</span></div>;
}

function reviewStudent(row: AttendanceRecord | StudentInSection): User | undefined {
  return "student" in row ? row.student : undefined;
}

function todayInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function isLessonInTimeWindow(lesson: { lessonDate: string; startTime: string; endTime: string }, now: Date) {
  const lessonDate = lesson.lessonDate.slice(0, 10);
  const startAt = new Date(`${lessonDate}T${lesson.startTime}:00`).getTime();
  const endAt = new Date(`${lessonDate}T${lesson.endTime}:00`).getTime();
  const current = now.getTime();
  return current >= startAt && current < endAt;
}

function formatLessonOption(lesson: Lesson, section?: { subject?: { name: string }; teacher?: { fullName: string } }) {
  const subjectName = lesson.courseSection?.subject?.name ?? section?.subject?.name ?? "Học phần";
  const teacherName = lesson.courseSection?.teacher?.fullName ?? section?.teacher?.fullName ?? "Giảng viên";
  const lessonDate = lesson.lessonDate.slice(0, 10);
  const room = lesson.room ? ` - ${lesson.room}` : "";
  const sessionCount = lesson.sessions?.length ?? (lesson.session ? 1 : 0);
  const sessionText = sessionCount ? ` - ${sessionCount} phiên` : "";
  return `${subjectName} - ${lessonDate} ${lesson.startTime}-${lesson.endTime}${room} - ${teacherName}${sessionText}`;
}
