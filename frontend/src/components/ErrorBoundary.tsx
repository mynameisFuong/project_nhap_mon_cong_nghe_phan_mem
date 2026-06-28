import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Frontend render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="center-page">
        <h1>Frontend gặp lỗi khi hiển thị</h1>
        <p>{this.state.error.message}</p>
        <Button onClick={() => {
          localStorage.clear();
          window.location.href = "/login";
        }}>
          Xóa phiên đăng nhập và quay lại login
        </Button>
      </main>
    );
  }
}
