import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Download, FileUp, Plus, Trash2, Users } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { Input, Select } from "../../components/FormField";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services";
import { getErrorMessage } from "../../services/apiClient";
import { useAsync } from "../../utils/useAsync";
import { shortDate } from "../../utils/format";

const tabs = ["Khoa", "Lớp", "Học phần", "Học kỳ"] as const;
type CatalogTab = (typeof tabs)[number];

const emptyForm = {
  code: "",
  name: "",
  facultyId: "",
  credits: "3",
  startDate: "",
  endDate: ""
};

export function CatalogManagement() {
  const [tab, setTab] = useState<CatalogTab>("Khoa");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [classFile, setClassFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [bulkStudentImportOpen, setBulkStudentImportOpen] = useState(false);
  const [bulkStudentFile, setBulkStudentFile] = useState<File | null>(null);
  const [bulkStudentImporting, setBulkStudentImporting] = useState(false);
  const [bulkStudentImportErrors, setBulkStudentImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<any | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentImporting, setStudentImporting] = useState(false);
  const [studentImportErrors, setStudentImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [form, setForm] = useState(emptyForm);
  const { showToast } = useToast();
  const faculties = useAsync(adminService.faculties, []);
  const classes = useAsync(adminService.classes, []);
  const subjects = useAsync(adminService.subjects, []);
  const semesters = useAsync(adminService.semesters, []);

  const loading = faculties.loading || classes.loading || subjects.loading || semesters.loading;

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openImport = () => {
    setClassFile(null);
    setImportErrors([]);
    setImportOpen(true);
  };

  const openBulkStudentImport = () => {
    setBulkStudentFile(null);
    setBulkStudentImportErrors([]);
    setBulkStudentImportOpen(true);
  };

  const reloadCurrent = async () => {
    if (tab === "Khoa") await faculties.reload();
    if (tab === "Lớp") await classes.reload();
    if (tab === "Học phần") await subjects.reload();
    if (tab === "Học kỳ") await semesters.reload();
  };

  const labelFor = (item: any) => item?.code ? `${item.code} - ${item.name}` : item?.name;

  const openClassStudents = async (classRoom: any) => {
    setSelectedClass(classRoom);
    setClassStudents([]);
    setRemoveStudentTarget(null);
    setStudentFile(null);
    setStudentImportErrors([]);
    try {
      setStudentsLoading(true);
      setClassStudents(await adminService.classStudents(classRoom.id));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setStudentsLoading(false);
    }
  };

  const removeStudentFromClass = async () => {
    if (!selectedClass || !removeStudentTarget) return;
    try {
      await adminService.removeClassStudent(selectedClass.id, removeStudentTarget.id);
      setRemoveStudentTarget(null);
      setClassStudents(await adminService.classStudents(selectedClass.id));
      await classes.reload();
      showToast("Đã xoá sinh viên khỏi lớp.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const deleteCurrent = async () => {
    if (!deleteTarget) return;
    try {
      if (tab === "Khoa") await adminService.deleteFaculty(deleteTarget.id);
      if (tab === "Lớp") await adminService.deleteClass(deleteTarget.id);
      if (tab === "Học phần") await adminService.deleteSubject(deleteTarget.id);
      if (tab === "Học kỳ") await adminService.deleteSemester(deleteTarget.id);
      setDeleteTarget(null);
      await reloadCurrent();
      showToast(`Đã xóa ${tab.toLowerCase()}.`, "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const actionColumn = {
    key: "actions",
    header: "Thao tác",
    render: (row: any) => (
      <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteTarget(row)}>
        Xóa
      </Button>
    )
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      if (tab === "Khoa") {
        await adminService.createFaculty({ code: form.code.trim(), name: form.name.trim() });
      } else if (tab === "Lớp") {
        await adminService.createClass({ code: form.code.trim(), name: form.name.trim(), facultyId: form.facultyId });
      } else if (tab === "Học phần") {
        await adminService.createSubject({
          code: form.code.trim(),
          name: form.name.trim(),
          credits: Number(form.credits),
          facultyId: form.facultyId
        });
      } else {
        await adminService.createSemester({
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate
        });
      }
      await reloadCurrent();
      setModalOpen(false);
      showToast(`Đã thêm ${tab.toLowerCase()}.`, "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const onImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    setClassFile(event.target.files?.[0] ?? null);
  };

  const onStudentImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    setStudentFile(event.target.files?.[0] ?? null);
  };

  const onBulkStudentImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    setBulkStudentFile(event.target.files?.[0] ?? null);
  };

  const submitImport = async () => {
    if (!classFile) {
      showToast("Vui lòng chọn file Excel hoặc CSV.", "error");
      return;
    }
    try {
      setImporting(true);
      const result = await adminService.importClasses(classFile);
      setImportErrors(result.errors ?? []);
      await classes.reload();
      showToast(`Import hoàn tất: ${result.successRows}/${result.totalRows} dòng thành công.`, result.failedRows ? "info" : "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  };

  const submitStudentImport = async () => {
    if (!selectedClass || !studentFile) {
      showToast("Vui lòng chọn file Excel hoặc CSV.", "error");
      return;
    }
    try {
      setStudentImporting(true);
      const result = await adminService.importClassStudents(selectedClass.id, studentFile);
      setStudentImportErrors(result.errors ?? []);
      try {
        setClassStudents(await adminService.classStudents(selectedClass.id));
      } catch {
        showToast("Import đã xử lý xong, nhưng chưa làm mới được danh sách sinh viên.", "info");
      }
      showToast(`Import hoàn tất: ${result.successRows}/${result.totalRows} sinh viên thành công.`, result.failedRows ? "info" : "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setStudentImporting(false);
    }
  };

  const submitBulkStudentImport = async () => {
    if (!bulkStudentFile) {
      showToast("Vui lòng chọn file Excel hoặc CSV.", "error");
      return;
    }
    try {
      setBulkStudentImporting(true);
      const result = await adminService.importStudentsByClass(bulkStudentFile);
      setBulkStudentImportErrors(result.errors ?? []);
      showToast(`Import hoàn tất: ${result.successRows}/${result.totalRows} sinh viên thành công.`, result.failedRows ? "info" : "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setBulkStudentImporting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const content = {
    "Khoa": {
      data: faculties.data ?? [],
      columns: [
        { key: "code", header: "Mã khoa", render: (row: any) => row.code },
        { key: "name", header: "Tên khoa", render: (row: any) => <strong>{row.name}</strong> },
        actionColumn
      ]
    },
    "Lớp": {
      data: classes.data ?? [],
      columns: [
        { key: "code", header: "Mã lớp", render: (row: any) => row.code },
        { key: "name", header: "Tên lớp", render: (row: any) => <strong>{row.name}</strong> },
        { key: "faculty", header: "Khoa", render: (row: any) => row.faculty?.name ?? "-" },
        {
          key: "actions",
          header: "Thao tác",
          render: (row: any) => (
            <div className="row-actions">
              <Button variant="outline" icon={<Users size={16} />} onClick={() => openClassStudents(row)}>Sinh viên</Button>
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteTarget(row)}>Xóa</Button>
            </div>
          )
        }
      ]
    },
    "Học phần": {
      data: subjects.data ?? [],
      columns: [
        { key: "code", header: "Mã HP", render: (row: any) => row.code },
        { key: "name", header: "Tên học phần", render: (row: any) => <strong>{row.name}</strong> },
        { key: "credits", header: "Tín chỉ", render: (row: any) => row.credits },
        { key: "faculty", header: "Khoa", render: (row: any) => row.faculty?.name ?? "-" },
        actionColumn
      ]
    },
    "Học kỳ": {
      data: semesters.data ?? [],
      columns: [
        { key: "name", header: "Tên học kỳ", render: (row: any) => <strong>{row.name}</strong> },
        { key: "start", header: "Bắt đầu", render: (row: any) => shortDate(row.startDate) },
        { key: "end", header: "Kết thúc", render: (row: any) => shortDate(row.endDate) },
        actionColumn
      ]
    }
  }[tab];

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý danh mục"
        description="Quản lý khoa, lớp, học phần và học kỳ dùng chung trong hệ thống."
        actions={(
          <>
            {tab === "Lớp" && <Button variant="outline" icon={<FileUp size={18} />} onClick={openBulkStudentImport}>Import sinh viên</Button>}
            {tab === "Lớp" && <Button variant="outline" icon={<FileUp size={18} />} onClick={openImport}>Import lớp</Button>}
            <Button icon={<Plus size={18} />} onClick={openCreate}>Thêm {tab.toLowerCase()}</Button>
          </>
        )}
      />
      <section className="panel">
        <div className="tabs">
          {tabs.map((item) => (
            <button key={item} className={item === tab ? "active" : ""} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </div>
        <DataTable data={content.data} columns={content.columns} />
      </section>
      <Modal open={modalOpen} title={`Thêm ${tab.toLowerCase()}`} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          {tab !== "Học kỳ" && (
            <Input label={tab === "Học phần" ? "Mã học phần" : `Mã ${tab.toLowerCase()}`} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
          )}
          <Input label={tab === "Học kỳ" ? "Tên học kỳ" : `Tên ${tab.toLowerCase()}`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          {(tab === "Lớp" || tab === "Học phần") && (
            <Select label="Khoa" value={form.facultyId} onChange={(event) => setForm({ ...form, facultyId: event.target.value })} required>
              <option value="">Chọn khoa</option>
              {(faculties.data ?? []).map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.code} - {faculty.name}</option>)}
            </Select>
          )}
          {tab === "Học phần" && (
            <Input label="Tín chỉ" type="number" min={1} max={10} value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} required />
          )}
          {tab === "Học kỳ" && (
            <>
              <Input label="Ngày bắt đầu" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
              <Input label="Ngày kết thúc" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required />
            </>
          )}
          <div className="modal-actions full-span">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? "Đang lưu" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>
      <Modal open={importOpen} title="Import lớp" onClose={() => setImportOpen(false)}>
        <div className="page-stack">
          <div className="upload-guide compact-guide">
            <p>File cần có các cột: Mã lớp, Tên lớp, Mã khoa. Cột Mã khoa có thể dùng mã khoa hoặc tên khoa đang có trong hệ thống.</p>
            <p>Ví dụ: DCT1223, DCT1223, FIT</p>
            <a className="btn btn-outline" href="/templates/import-lop-mau.csv" download>
              <Download size={18} />
              <span>Tải file mẫu CSV</span>
            </a>
          </div>
          <label className="dropzone">
            <FileUp size={30} />
            <span>{classFile ? classFile.name : "Chọn file .xlsx hoặc .csv"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onImportFile} />
          </label>
          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Đóng</Button>
            <Button type="button" disabled={importing} onClick={submitImport}>{importing ? "Đang import" : "Import lớp"}</Button>
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
      <Modal open={bulkStudentImportOpen} title="Import sinh viên theo lớp" onClose={() => setBulkStudentImportOpen(false)}>
        <div className="page-stack">
          <div className="upload-guide compact-guide">
            <p>File cần có các cột: MSSV, Họ tên, Lớp, Email. Hệ thống sẽ tự tìm lớp theo mã hoặc tên lớp đã có.</p>
            <p>Sinh viên mới sẽ được tạo tài khoản mật khẩu mặc định 123456 với vai trò sinh viên.</p>
            <a className="btn btn-outline" href="/templates/import-sinh-vien-theo-danh-sach-lop-mau.xlsx" download>
              <Download size={18} />
              <span>Tải file mẫu Excel</span>
            </a>
          </div>
          <label className="dropzone">
            <FileUp size={30} />
            <span>{bulkStudentFile ? bulkStudentFile.name : "Chọn file .xlsx hoặc .csv"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onBulkStudentImportFile} />
          </label>
          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setBulkStudentImportOpen(false)}>Đóng</Button>
            <Button type="button" disabled={bulkStudentImporting} onClick={submitBulkStudentImport}>{bulkStudentImporting ? "Đang import" : "Import sinh viên"}</Button>
          </div>
          <DataTable
            data={bulkStudentImportErrors}
            emptyTitle="Chưa có lỗi import"
            columns={[
              { key: "row", header: "Dòng", render: (row) => row.row },
              { key: "message", header: "Lỗi", render: (row) => row.message }
            ]}
          />
        </div>
      </Modal>
      <Modal
        open={Boolean(selectedClass)}
        title={`Sinh viên lớp ${selectedClass?.code ?? ""}`}
        onClose={() => setSelectedClass(null)}
        className="student-class-modal"
      >
        <div className="student-class-modal-body">
          <div className="student-class-import">
            <div className="upload-guide compact-guide">
              <p>File cần có các cột: MSSV, Họ tên, Email. Sinh viên mới sẽ được tạo tài khoản mặc định mật khẩu 123456 với vai trò sinh viên.</p>
              <a className="btn btn-outline" href="/templates/import-sinh-vien-theo-lop-mau.csv" download>
                <Download size={18} />
                <span>Tải file mẫu CSV</span>
              </a>
            </div>
            <label className="dropzone compact">
              <FileUp size={24} />
              <span>{studentFile ? studentFile.name : "Chọn file .xlsx hoặc .csv"}</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onStudentImportFile} />
            </label>
            <div className="modal-actions">
              <Button type="button" disabled={studentImporting} onClick={submitStudentImport}>{studentImporting ? "Đang import" : "Import sinh viên vào lớp"}</Button>
            </div>
          </div>
          <div className="student-class-list">
            {studentImportErrors.length > 0 && (
              <DataTable
                data={studentImportErrors}
                emptyTitle="Chưa có lỗi import"
                columns={[
                  { key: "row", header: "Dòng", render: (row) => row.row },
                  { key: "message", header: "Lỗi", render: (row) => row.message }
                ]}
              />
            )}
            {studentsLoading ? (
              <LoadingSpinner />
            ) : (
              <DataTable
                data={classStudents}
                emptyTitle="Lớp này chưa có sinh viên"
                columns={[
                  { key: "code", header: "MSSV", render: (row) => row.studentCode ?? "-" },
                  { key: "name", header: "Họ tên", render: (row) => <strong>{row.fullName}</strong> },
                  { key: "email", header: "Email", render: (row) => row.email },
                  { key: "status", header: "Trạng thái", render: (row) => row.status ?? "-" },
                  {
                    key: "actions",
                    header: "Thao tác",
                    render: (row) => (
                      <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setRemoveStudentTarget(row)}>
                        Xóa
                      </Button>
                    )
                  }
                ]}
              />
            )}
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(removeStudentTarget)}
        title="Xóa sinh viên khỏi lớp"
        message={`Bạn chắc chắn muốn xóa ${removeStudentTarget?.fullName ?? "sinh viên này"} khỏi lớp ${selectedClass?.code ?? ""}?`}
        confirmText="Xóa khỏi lớp"
        onCancel={() => setRemoveStudentTarget(null)}
        onConfirm={removeStudentFromClass}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Xóa ${tab.toLowerCase()}`}
        message={`Bạn chắc chắn muốn xóa ${labelFor(deleteTarget)}?`}
        confirmText="Xóa"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteCurrent}
      />
    </div>
  );
}
