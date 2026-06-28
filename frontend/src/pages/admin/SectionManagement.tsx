import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable } from "../../components/DataTable";
import { Input, Select } from "../../components/FormField";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services";
import { apiClient, getErrorMessage, unwrap } from "../../services/apiClient";
import type { CourseSection, StudentInSection } from "../../types";
import { useAsync } from "../../utils/useAsync";

const emptySectionForm = {
  code: "",
  subjectId: "",
  semesterId: "",
  teacherId: "",
  absenceThresholdPercent: "20"
};

export function SectionManagement() {
  const sections = useAsync(adminService.sections, []);
  const subjects = useAsync(adminService.subjects, []);
  const semesters = useAsync(adminService.semesters, []);
  const users = useAsync(adminService.users, []);
  const { showToast } = useToast();
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseSection | null>(null);
  const [students, setStudents] = useState<StudentInSection[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [sectionFile, setSectionFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);

  const teachers = (users.data ?? []).filter((user) => user.role === "TEACHER");
  const loading = sections.loading || subjects.loading || semesters.loading || users.loading;
  const filteredStudents = students.filter((item) => {
    const student = item.student;
    const keyword = `${student.studentCode ?? ""} ${student.fullName} ${student.email} ${student.class?.code ?? ""} ${student.class?.name ?? ""}`.toLowerCase();
    return keyword.includes(studentQuery.toLowerCase());
  });
  const studentPageCount = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const currentStudentPage = Math.min(studentPage, studentPageCount);
  const studentPageStart = (currentStudentPage - 1) * studentPageSize;
  const paginatedStudents = filteredStudents.slice(studentPageStart, studentPageStart + studentPageSize);

  const openStudents = async (section: CourseSection) => {
    setSelectedSection(section);
    setStudents([]);
    setStudentQuery("");
    setStudentPage(1);
    setStudentsLoading(true);
    try {
      const loadStudents = adminService.sectionStudents
        ?? ((sectionId: string) => unwrap<StudentInSection[]>(apiClient.get(`/admin/sections/${sectionId}/students`)));
      setStudents(await loadStudents(section.id));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setStudentsLoading(false);
    }
  };

  const openCreate = () => {
    setSectionForm(emptySectionForm);
    setCreateOpen(true);
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await adminService.createSection({
        code: sectionForm.code.trim(),
        subjectId: sectionForm.subjectId,
        semesterId: sectionForm.semesterId,
        teacherId: sectionForm.teacherId,
        absenceThresholdPercent: Number(sectionForm.absenceThresholdPercent)
      });
      await sections.reload();
      setCreateOpen(false);
      showToast("Đã tạo lớp học phần.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const onImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSectionFile(event.target.files?.[0] ?? null);
  };

  const submitImport = async () => {
    if (!sectionFile) {
      showToast("Vui lòng chọn file Excel hoặc CSV.", "error");
      return;
    }
    try {
      setImporting(true);
      const result = await adminService.importSections(sectionFile);
      setImportErrors(result.errors ?? []);
      await sections.reload();
      showToast(`Import hoàn tất: ${result.successRows}/${result.totalRows} dòng thành công.`, result.failedRows ? "info" : "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  };

  const deleteSection = async () => {
    if (!deleteTarget) return;
    try {
      await adminService.deleteSection(deleteTarget.id);
      setDeleteTarget(null);
      await sections.reload();
      showToast("Đã xóa lớp học phần.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader
        title="Lớp học phần"
        description="Quản lý lớp học phần, giảng viên phụ trách, sĩ số và trạng thái."
        actions={(
          <>
            <Button variant="outline" icon={<FileUp size={18} />} onClick={() => setImportOpen(true)}>Import file</Button>
            <Button icon={<Plus size={18} />} onClick={openCreate}>Tạo lớp học phần</Button>
          </>
        )}
      />
      <section className="panel">
        <DataTable
          data={sections.data ?? []}
          columns={[
            { key: "code", header: "Mã lớp HP", render: (row) => <strong>{row.code}</strong> },
            { key: "subject", header: "Học phần", render: (row) => row.subject?.name ?? "-" },
            { key: "semester", header: "Học kỳ", render: (row) => row.semester?.name ?? "-" },
            { key: "teacher", header: "Giảng viên", render: (row) => row.teacher?.fullName ?? "-" },
            {
              key: "count",
              header: "Sinh viên",
              render: (row) => (
                <Button variant="outline" icon={<Eye size={16} />} onClick={() => openStudents(row)}>
                  {row._count?.enrollments ?? 0}
                </Button>
              )
            },
            { key: "status", header: "Trạng thái", render: (row) => <Badge tone="success">{row.status ?? "ACTIVE"}</Badge> },
            {
              key: "actions",
              header: "Thao tác",
              render: (row) => (
                <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteTarget(row)}>
                  Xóa
                </Button>
              )
            }
          ]}
        />
      </section>

      <Modal open={createOpen} title="Tạo lớp học phần" onClose={() => setCreateOpen(false)}>
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Mã lớp HP" value={sectionForm.code} onChange={(event) => setSectionForm({ ...sectionForm, code: event.target.value })} required />
          <Select label="Học phần" value={sectionForm.subjectId} onChange={(event) => setSectionForm({ ...sectionForm, subjectId: event.target.value })} required>
            <option value="">Chọn học phần</option>
            {(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>)}
          </Select>
          <Select label="Học kỳ" value={sectionForm.semesterId} onChange={(event) => setSectionForm({ ...sectionForm, semesterId: event.target.value })} required>
            <option value="">Chọn học kỳ</option>
            {(semesters.data ?? []).map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
          </Select>
          <Select label="Giảng viên" value={sectionForm.teacherId} onChange={(event) => setSectionForm({ ...sectionForm, teacherId: event.target.value })} required>
            <option value="">Chọn giảng viên</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} - {teacher.email}</option>)}
          </Select>
          <Input label="Ngưỡng vắng (%)" type="number" min={0} max={100} value={sectionForm.absenceThresholdPercent} onChange={(event) => setSectionForm({ ...sectionForm, absenceThresholdPercent: event.target.value })} required />
          <div className="modal-actions full-span">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? "Đang lưu" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={importOpen} title="Import lớp học phần" onClose={() => setImportOpen(false)}>
        <div className="page-stack">
          <div className="upload-guide compact-guide">
            <p>File cần có các cột: Mã lớp HP, Mã học phần, Học kỳ, Email giảng viên. Có thể thêm cột Ngưỡng vắng (%).</p>
            <p>Ví dụ: SE101-02, SE101, HK1 2026-2027, gv1@school.test, 20</p>
            <a className="btn btn-outline" href="/templates/import-lop-hoc-phan-mau.csv" download>
              <Download size={18} />
              <span>Tải file mẫu CSV</span>
            </a>
          </div>
          <label className="dropzone">
            <FileUp size={30} />
            <span>{sectionFile ? sectionFile.name : "Chọn file .xlsx hoặc .csv"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onImportFile} />
          </label>
          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Đóng</Button>
            <Button type="button" disabled={importing} onClick={submitImport}>{importing ? "Đang import" : "Import lớp học phần"}</Button>
          </div>
          <DataTable
            data={importErrors}
            emptyTitle="Chưa có lỗi import"
            columns={[
              { key: "row", header: "Dòng", render: (row) => row.row },
              { key: "message", header: "Lỗi", render: (row) => row.message }
            ]}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedSection)}
        title={`Sinh viên lớp ${selectedSection?.code ?? ""}`}
        onClose={() => setSelectedSection(null)}
        className="modal-wide"
      >
        {studentsLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="page-stack">
            <div className="student-list-toolbar">
              <div className="search-box"><Search size={18} /><input value={studentQuery} onChange={(event) => { setStudentQuery(event.target.value); setStudentPage(1); }} placeholder="Tìm MSSV, họ tên, email hoặc lớp" /></div>
              <div className="summary-metrics compact-metrics">
                <div><strong>{students.length}</strong><span>Tổng SV</span></div>
                <div><strong>{filteredStudents.length}</strong><span>Đang hiển thị</span></div>
              </div>
            </div>
            <DataTable
              data={paginatedStudents}
              emptyTitle="Chưa có sinh viên trong lớp này"
              columns={[
                { key: "studentCode", header: "MSSV", render: (row) => row.student.studentCode ?? "-" },
                { key: "fullName", header: "Họ tên", render: (row) => <strong>{row.student.fullName}</strong> },
                { key: "email", header: "Email", render: (row) => row.student.email },
                { key: "classCode", header: "Lớp", render: (row) => row.student.class?.code ?? "-" },
                { key: "status", header: "Tài khoản", render: (row) => <Badge tone={row.student.status === "LOCKED" ? "danger" : "success"}>{row.student.status === "LOCKED" ? "Đã khóa" : "Hoạt động"}</Badge> }
              ]}
            />
            {filteredStudents.length > 0 && (
              <div className="pagination-bar">
                <div className="pagination-summary">
                  Hiển thị {studentPageStart + 1}-{Math.min(studentPageStart + studentPageSize, filteredStudents.length)} / {filteredStudents.length} sinh viên
                </div>
                <div className="pagination-controls">
                  <select value={studentPageSize} onChange={(event) => { setStudentPageSize(Number(event.target.value)); setStudentPage(1); }} aria-label="Số sinh viên mỗi trang">
                    <option value={10}>10 / trang</option>
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                  </select>
                  <Button variant="outline" icon={<ChevronLeft size={16} />} onClick={() => setStudentPage((value) => Math.max(1, value - 1))} disabled={currentStudentPage === 1}>Trước</Button>
                  <span className="page-indicator">Trang {currentStudentPage} / {studentPageCount}</span>
                  <Button variant="outline" icon={<ChevronRight size={16} />} onClick={() => setStudentPage((value) => Math.min(studentPageCount, value + 1))} disabled={currentStudentPage === studentPageCount}>Sau</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa lớp học phần"
        message={`Bạn chắc chắn muốn xóa lớp ${deleteTarget?.code}? Toàn bộ dữ liệu liên quan có thể bị ảnh hưởng.`}
        confirmText="Xóa"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteSection}
      />
    </div>
  );
}
