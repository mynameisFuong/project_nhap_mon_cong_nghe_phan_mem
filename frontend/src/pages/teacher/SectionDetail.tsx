import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Info, QrCode, UserRound, Users } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PageHeader } from "../../components/PageHeader";
import { teacherService } from "../../services";
import { useAsync } from "../../utils/useAsync";

type DetailTab = "overview" | "schedule" | "students" | "teacher";

const tabs: Array<{ id: DetailTab; label: string; icon: typeof Info }> = [
  { id: "overview", label: "Thông tin chung", icon: Info },
  { id: "schedule", label: "Lịch học", icon: CalendarDays },
  { id: "students", label: "Học viên", icon: Users },
  { id: "teacher", label: "Giảng viên", icon: UserRound }
];

export function SectionDetail() {
  const { id = "" } = useParams();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const sections = useAsync(teacherService.sections, []);
  const students = useAsync(() => teacherService.students(id), [id]);
  const lessons = useAsync(() => teacherService.lessons(id), [id]);

  const section = useMemo(() => sections.data?.find((item) => item.id === id), [id, sections.data]);
  const lessonRows = lessons.data ?? [];
  const studentRows = students.data ?? [];

  if (sections.loading || students.loading || lessons.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader
        title={section?.code ?? "Chi tiết lớp học phần"}
        description={section?.subject?.name ?? "Quản lý thông tin lớp, lịch học và học viên theo từng tab."}
        actions={<Link to="/teacher/attendance"><Button icon={<QrCode size={18} />}>Tạo phiên điểm danh</Button></Link>}
      />

      <section className="panel section-detail-shell">
        <div className="section-detail-summary">
          <div>
            <span className="breadcrumb">Lớp học phần</span>
            <h2>{section?.code ?? "-"}</h2>
            <p>{section?.subject?.name ?? "-"}</p>
          </div>
          <div className="summary-metrics">
            <div><strong>{studentRows.length}</strong><span>Học viên</span></div>
            <div><strong>{lessonRows.length}</strong><span>Buổi học</span></div>
            <div><Badge tone="success">Đang mở</Badge></div>
          </div>
        </div>

        <div className="detail-tabs" role="tablist" aria-label="Chi tiết lớp học phần">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "active" : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <div className="detail-tab-panel">
            <div className="info-grid">
              <InfoItem label="Mã lớp" value={section?.code} />
              <InfoItem label="Học phần" value={section?.subject?.name} />
              <InfoItem label="Học kỳ" value={section?.semester?.name} />
              <InfoItem label="Số học viên" value={studentRows.length} />
              <InfoItem label="Số buổi học" value={lessonRows.length} />
              <InfoItem label="Ngưỡng cảnh báo vắng" value={section?.absenceThresholdPercent ? `${section.absenceThresholdPercent}%` : "20%"} />
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="detail-tab-panel">
            <div className="schedule-settings">
              <div>
                <span>No. sessions</span>
                <strong>{lessonRows.length}</strong>
              </div>
              <Link to="/teacher/attendance"><Button icon={<QrCode size={16} />}>Tạo phiên</Button></Link>
            </div>
            <div className="lesson-list">
              {lessonRows.length ? lessonRows.map((lesson, index) => (
                <div className="lesson-row" key={lesson.id}>
                  <input type="checkbox" aria-label={`Chọn buổi ${index + 1}`} />
                  <span className="lesson-index">#{index + 1}</span>
                  <span>{lesson.lessonDate.slice(0, 10)}</span>
                  <span>{lesson.startTime}</span>
                  <span>{lesson.endTime}</span>
                  <span>{lesson.room ?? "-"}</span>
                  <Badge tone={lesson.session ? "success" : "neutral"}>{lesson.session ? "Đã có phiên" : "Chưa có phiên"}</Badge>
                </div>
              )) : (
                <div className="empty-state compact"><p>Chưa có buổi học nào.</p></div>
              )}
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div className="detail-tab-panel">
            <div className="panel-head">
              <div>
                <h2>Học viên</h2>
                <p>Danh sách sinh viên đang thuộc lớp học phần này.</p>
              </div>
            </div>
            <DataTable data={studentRows} columns={[
              { key: "code", header: "MSSV", render: (row) => row.student.studentCode ?? "-" },
              { key: "name", header: "Tên", render: (row) => <strong>{row.student.fullName}</strong> },
              { key: "email", header: "Email", render: (row) => row.student.email },
              { key: "class", header: "Lớp", render: (row) => row.student.class?.code ?? "-" },
              { key: "status", header: "Trạng thái", render: () => <Badge tone="success">Đang học</Badge> }
            ]} />
          </div>
        )}

        {activeTab === "teacher" && (
          <div className="detail-tab-panel">
            <div className="teacher-card">
              <div className="avatar large">{section?.teacher?.fullName?.charAt(0) ?? "G"}</div>
              <div>
                <h2>{section?.teacher?.fullName ?? "Giảng viên phụ trách"}</h2>
                <p>{section?.teacher?.email ?? "-"}</p>
                <Badge tone="info">Giảng viên</Badge>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}
