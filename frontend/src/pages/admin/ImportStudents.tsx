import { useState } from "react";
import type { ChangeEvent } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Select } from "../../components/FormField";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { adminService } from "../../services";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../utils/useAsync";
import { getErrorMessage } from "../../services/apiClient";

export function ImportStudents() {
  const sections = useAsync(adminService.sections, []);
  const { showToast } = useToast();
  const [sectionId, setSectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null);

  const submit = async () => {
    if (!sectionId || !file) return showToast("Vui lòng chọn lớp học phần và file Excel.", "error");
    try {
      setImporting(true);
      const result: any = await adminService.importStudents(sectionId, file);
      setErrors(result.errors ?? []);
      showToast("Import hoàn tất.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  };

  if (sections.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Import sinh viên" description="Tải file Excel đúng cấu trúc MSSV, Họ tên, Lớp, Email để ghi danh sinh viên vào lớp học phần." />
      <section className="upload-panel">
        <div className="upload-guide">
          <FileSpreadsheet size={40} />
          <h2>Định dạng file</h2>
          <p>Sheet đầu tiên cần có hàng tiêu đề: MSSV, Họ tên, Lớp, Email.</p>
          <a className="btn btn-outline" href="/templates/import-sinh-vien-mau.xlsx" download>
            <Download size={18} />
            <span>Tải file mẫu</span>
          </a>
        </div>
        <div className="upload-form">
          <Select label="Lớp học phần" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Chọn lớp học phần</option>
            {(sections.data ?? []).map((section) => <option key={section.id} value={section.id}>{section.code} - {section.subject?.name}</option>)}
          </Select>
          <label className="dropzone">
            <UploadCloud size={30} />
            <span>{file ? file.name : "Chọn file .xlsx"}</span>
            <input type="file" accept=".xlsx,.xls" onChange={onFile} />
          </label>
          <Button disabled={importing} onClick={submit}>{importing ? "Đang import" : "Import sinh viên"}</Button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Lỗi import</h2><p>Các dòng sai định dạng sẽ hiển thị tại đây.</p></div>
        <DataTable data={errors} emptyTitle="Chưa có lỗi import" columns={[{ key: "row", header: "Dòng", render: (row) => row.row }, { key: "message", header: "Lỗi", render: (row) => row.message }]} />
      </section>
    </div>
  );
}
