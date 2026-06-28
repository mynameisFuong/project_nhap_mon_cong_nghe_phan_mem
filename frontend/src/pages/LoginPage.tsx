import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authService } from "../services/authService";
import { getErrorMessage } from "../services/apiClient";

export function LoginPage() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [email, setEmail] = useState("admin@school.test");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to={redirect && redirect.startsWith("/") ? redirect : authService.dashboardPath(user.role)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const loggedUser = await login(email, password);
      showToast("Đăng nhập thành công.", "success");
      navigate(redirect && redirect.startsWith("/") ? redirect : authService.dashboardPath(loggedUser.role));
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand-row">
          <div className="brand-mark"><ShieldCheck size={24} /></div>
          <strong>Attendly</strong>
        </div>
        <h1>Điểm danh nhanh, dữ liệu chuyên cần rõ ràng.</h1>
        <p>QR động và OTP 30 giây giúp lớp học điểm danh gọn hơn, hạn chế điểm danh hộ và theo dõi minh bạch theo từng học phần.</p>
        <div className="login-benefits">
          <span><CheckCircle2 size={18} /> Phân quyền Admin, Giảng viên, Sinh viên</span>
          <span><CheckCircle2 size={18} /> Báo cáo chuyên cần và cảnh báo vắng</span>
          <span><CheckCircle2 size={18} /> Responsive cho lớp học và điện thoại</span>
        </div>
      </section>

      <section className="login-card">
        <div>
          <h2>Đăng nhập</h2>
          <p>Truy cập hệ thống điểm danh sinh viên.</p>
        </div>
        <form onSubmit={submit}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@school.test" />
          <Input label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" />
          {error && <div className="form-alert">{error}</div>}
          <Button className="full-width" type="submit" disabled={loading} icon={loading ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}>
            {loading ? "Đang đăng nhập" : "Đăng nhập"}
          </Button>
        </form>
        <div className="demo-accounts">
          <span>Tài khoản mẫu</span>
          <button onClick={() => setEmail("admin@school.test")}><Mail size={14} /> Admin</button>
          <button onClick={() => setEmail("gv1@school.test")}><Mail size={14} /> Giảng viên</button>
          <button onClick={() => setEmail("sv001@school.test")}><Mail size={14} /> Sinh viên</button>
        </div>
      </section>
    </main>
  );
}
