import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { teacherService } from "../../services";
import type { NotificationItem } from "../../types";
import { useAsync } from "../../utils/useAsync";
import { shortDate } from "../../utils/format";

type Filter = "ALL" | "UNREAD" | "READ";

const filterLabels: Record<Filter, string> = {
  ALL: "Tất cả",
  UNREAD: "Chưa đọc",
  READ: "Đã xem"
};

export function TeacherNotifications() {
  const notifications = useAsync(teacherService.notifications, []);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<NotificationItem | null>(null);

  const data = notifications.data ?? [];
  const counts = useMemo(() => ({
    ALL: data.length,
    UNREAD: data.filter((item) => !item.readAt).length,
    READ: data.filter((item) => item.readAt).length
  }), [data]);

  const filtered = data.filter((item) => {
    if (filter === "UNREAD") return !item.readAt;
    if (filter === "READ") return Boolean(item.readAt);
    return true;
  });

  const openDetail = async (item: NotificationItem) => {
    setSelected(item);
    if (!item.readAt) {
      await teacherService.markNotificationRead(item.id);
      await notifications.reload();
      window.dispatchEvent(new Event("notifications:changed"));
    }
  };

  if (notifications.loading) return <LoadingSpinner />;

  return (
    <div className="page-stack">
      <PageHeader title="Thông báo" description="Cảnh báo chuyên cần, đơn xin phép mới và cập nhật hệ thống." />
      <section className="panel">
        <div className="tabs">
          {(Object.keys(filterLabels) as Filter[]).map((item) => (
            <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
              {filterLabels[item]} ({counts[item]})
            </button>
          ))}
        </div>
        <div className="notification-list">
          {!filtered.length && <EmptyState title="Không có thông báo phù hợp" />}
          {filtered.map((item) => (
            <article className={`notification-item ${!item.readAt ? "notification-unread" : ""}`} key={item.id}>
              <div className="notification-icon"><Bell size={18} /></div>
              <div>
                <h3>{item.title} {!item.readAt && <Badge tone="warning">Chưa đọc</Badge>}</h3>
                <p>{item.message}</p>
                <span>{shortDate(item.createdAt)}</span>
              </div>
              <Button variant="outline" onClick={() => void openDetail(item)}>Xem chi tiết</Button>
            </article>
          ))}
        </div>
      </section>
      <Modal open={Boolean(selected)} title={selected?.title ?? "Chi tiết thông báo"} onClose={() => setSelected(null)}>
        <div className="page-stack">
          <p>{selected?.message}</p>
          <p className="muted-text">Ngày tạo: {shortDate(selected?.createdAt)}</p>
          <div className="modal-actions">
            <Button onClick={() => setSelected(null)}>Đóng</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
