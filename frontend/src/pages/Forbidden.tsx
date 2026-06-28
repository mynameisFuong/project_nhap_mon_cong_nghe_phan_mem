import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export function Forbidden() {
  return (
    <div className="center-page">
      <ShieldAlert size={48} />
      <h1>Không có quyền truy cập</h1>
      <p>Trang này không thuộc phạm vi vai trò hiện tại của bạn.</p>
      <Link to="/">Quay về dashboard</Link>
    </div>
  );
}
