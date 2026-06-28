import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="center-page">
      <h1>404</h1>
      <p>Không tìm thấy trang bạn yêu cầu.</p>
      <Link to="/">Quay về dashboard</Link>
    </div>
  );
}
