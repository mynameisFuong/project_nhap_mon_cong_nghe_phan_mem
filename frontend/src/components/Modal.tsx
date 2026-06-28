import type { ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Button } from "./Button";

export function Modal({ open, title, children, onClose, className }: { open: boolean; title: string; children: ReactNode; onClose: () => void; className?: string }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={clsx("modal", className)}>
        <div className="modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" icon={<X size={18} />} onClick={onClose} aria-label="Đóng" />
        </div>
        {children}
      </div>
    </div>
  );
}
