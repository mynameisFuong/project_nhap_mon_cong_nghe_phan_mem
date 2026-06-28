import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmDialog({ open, title, message, confirmText = "Xác nhận", onCancel, onConfirm }: { open: boolean; title: string; message: string; confirmText?: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="confirm-body">
        <AlertTriangle size={36} />
        <p>{message}</p>
      </div>
      <div className="modal-actions">
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmText}</Button>
      </div>
    </Modal>
  );
}
