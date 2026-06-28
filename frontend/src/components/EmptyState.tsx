import { Inbox } from "lucide-react";

export function EmptyState({ title, description = "Dữ liệu sẽ xuất hiện tại đây khi có bản ghi phù hợp." }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
