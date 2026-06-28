import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Search, Unlock, UserRoundPen } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Input, Select } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { adminService } from "../../services";
import { getErrorMessage } from "../../services/apiClient";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../utils/useAsync";
import { roleText, shortDate } from "../../utils/format";
import type { Role, User } from "../../types";

export function UserManagement() {
  const { data, loading, reload } = useAsync(adminService.users, []);
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirm, setConfirm] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: "", password: "123456", fullName: "", role: "STUDENT" as Role });

  const users = data ?? [];
  const filtered = useMemo(() => users.filter((user) => {
    const matchQuery = `${user.fullName} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    const matchRole = role === "ALL" || user.role === role;
    const matchStatus = status === "ALL" || user.status === status;
    return matchQuery && matchRole && matchStatus;
  }), [users, query, role, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedUsers = filtered.slice(pageStart, pageStart + pageSize);

  const resetPage = () => setPage(1);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ email: "", password: "123456", fullName: "", role: "STUDENT" });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "123456",
      fullName: user.fullName,
      role: user.role
    });
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.email || !form.fullName) return showToast("Vui lòng nhập đủ họ tên và email.", "error");
    try {
      if (editingUser) {
        await adminService.updateUser(editingUser.id, {
          email: form.email,
          fullName: form.fullName,
          role: form.role
        });
        showToast("Đã cập nhật người dùng.", "success");
      } else {
        await adminService.createUser(form);
        showToast("Đã tạo người dùng.", "success");
      }
      setModalOpen(false);
      setEditingUser(null);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const toggleLock = async (user: User) => {
    try {
      await adminService.lockUser(user.id, user.status !== "LOCKED");
      showToast("Đã cập nhật trạng thái tài khoản.", "success");
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Quản lý người dùng" description="Tạo tài khoản, phân quyền và khóa/mở khóa truy cập hệ thống." actions={<Button icon={<Plus size={18} />} onClick={openCreate}>Thêm người dùng</Button>} />
      <section className="panel">
        <div className="toolbar">
          <div className="search-box"><Search size={18} /><input value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }} placeholder="Tìm theo tên hoặc email" /></div>
          <select value={role} onChange={(e) => { setRole(e.target.value); resetPage(); }}><option value="ALL">Tất cả vai trò</option><option value="ADMIN">Admin</option><option value="TEACHER">Giảng viên</option><option value="STUDENT">Sinh viên</option></select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa</option></select>
        </div>
        <DataTable
          data={paginatedUsers}
          columns={[
            { key: "name", header: "Họ tên", render: (user) => <strong>{user.fullName}</strong> },
            { key: "email", header: "Email", render: (user) => user.email },
            { key: "role", header: "Vai trò", render: (user) => <Badge tone="info">{roleText[user.role]}</Badge> },
            { key: "status", header: "Trạng thái", render: (user) => <Badge tone={user.status === "LOCKED" ? "danger" : "success"}>{user.status === "LOCKED" ? "Đã khóa" : "Hoạt động"}</Badge> },
            { key: "created", header: "Ngày tạo", render: (user) => shortDate(user.createdAt) },
            { key: "actions", header: "Thao tác", render: (user) => <div className="row-actions"><Button variant="outline" icon={<UserRoundPen size={16} />} onClick={() => openEdit(user)}>Sửa</Button><Button variant={user.status === "LOCKED" ? "secondary" : "danger"} icon={user.status === "LOCKED" ? <Unlock size={16} /> : <Lock size={16} />} onClick={() => setConfirm(user)}>{user.status === "LOCKED" ? "Mở khóa" : "Khóa"}</Button></div> }
          ]}
        />
        {filtered.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-summary">
              Hiển thị {pageStart + 1}-{Math.min(pageStart + pageSize, filtered.length)} / {filtered.length} người dùng
            </div>
            <div className="pagination-controls">
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} aria-label="Số dòng mỗi trang">
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
              <Button variant="outline" icon={<ChevronLeft size={16} />} onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Trước</Button>
              <span className="page-indicator">Trang {currentPage} / {pageCount}</span>
              <Button variant="outline" icon={<ChevronRight size={16} />} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount}>Sau</Button>
            </div>
          </div>
        )}
      </section>

      <Modal open={modalOpen} title={editingUser ? "Sửa người dùng" : "Thêm người dùng"} onClose={() => { setModalOpen(false); setEditingUser(null); }}>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {!editingUser && <Input label="Mật khẩu mặc định" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          <Select label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="STUDENT">Sinh viên</option><option value="TEACHER">Giảng viên</option><option value="ADMIN">Admin</option></Select>
          <div className="modal-actions full-span"><Button variant="outline" type="button" onClick={() => { setModalOpen(false); setEditingUser(null); }}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(confirm)} title="Xác nhận trạng thái" message={`Bạn muốn ${confirm?.status === "LOCKED" ? "mở khóa" : "khóa"} tài khoản ${confirm?.fullName}?`} onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) void toggleLock(confirm); setConfirm(null); }} />
    </div>
  );
}
