export function LoadingSpinner({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <p>{label}</p>
    </div>
  );
}
