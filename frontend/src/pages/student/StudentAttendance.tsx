import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Camera, CheckCircle2, QrCode, ScanLine, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/Button";
import { Input } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { studentService } from "../../services";
import { getErrorMessage } from "../../services/apiClient";
import { useToast } from "../../context/ToastContext";

export function StudentAttendance() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [qrToken, setQrToken] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState("Đưa camera tới mã QR trên màn hình giảng viên.");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);

  const ensureReader = async () => {
    if (!readerRef.current) {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      readerRef.current = new BrowserQRCodeReader();
    }
    return readerRef.current;
  };

  const extractQrToken = (value: string) => {
    const text = value.trim();
    try {
      return new URL(text).searchParams.get("qrToken") ?? text;
    } catch {
      return text;
    }
  };

  const acceptQrText = (text: string) => {
    setQrToken(extractQrToken(text));
    setSuccess(false);
    showToast("Đã quét QR. Nhập OTP rồi xác nhận điểm danh.", "success");
  };

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get("qrToken");
    if (!tokenFromUrl) return;
    setQrToken(tokenFromUrl);
    setSuccess(false);
  }, [searchParams]);

  useEffect(() => {
    const video = videoRef.current;
    if (!scannerOpen || !video) return;

    let cancelled = false;
    const startScanner = async () => {
      try {
        setScannerStatus("Đang xin quyền truy cập camera...");
        const reader = await ensureReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video,
          (result) => {
            const text = result?.getText();
            if (!text) return;
            acceptQrText(text);
            stopScanner();
            setScannerOpen(false);
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setScannerStatus("Đang quét QR...");
      } catch (err) {
        setScannerStatus("Không thể mở camera live. Hãy bấm Chụp ảnh QR để mở camera hệ thống rồi quét mã.");
        showToast(getErrorMessage(err), "error");
      }
    };

    void startScanner();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scannerOpen, showToast]);

  const closeScanner = () => {
    stopScanner();
    setScannerOpen(false);
  };

  const scanQrImage = async (file: File | undefined) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = await ensureReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      acceptQrText(result.getText());
      closeScanner();
    } catch {
      showToast("Không đọc được QR từ ảnh. Hãy chụp rõ mã QR và thử lại.", "error");
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!qrToken || !otp) return showToast("Vui lòng quét QR token và nhập OTP.", "error");
    try {
      setLoading(true);
      await studentService.submitAttendance(qrToken, otp);
      setSuccess(true);
      showToast("Điểm danh thành công.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader title="Điểm danh" description="Quét QR bằng camera, nhập OTP và xác nhận trong thời gian mã còn hiệu lực." />
      <section className="mobile-attendance">
        <div className="steps-card">
          <div><ScanLine size={22} /><strong>1. Quét QR</strong><span>Mở camera và quét mã trên màn hình giảng viên.</span></div>
          <div><QrCode size={22} /><strong>2. Nhập OTP</strong><span>OTP xoay vòng mỗi 30 giây.</span></div>
          <div><CheckCircle2 size={22} /><strong>3. Xác nhận</strong><span>Hệ thống phản hồi trong vài giây.</span></div>
        </div>
        <form className="attendance-form" onSubmit={submit}>
          <div className="scan-action">
            <Button type="button" icon={<Camera size={18} />} onClick={() => setScannerOpen(true)}>
              Quét QR
            </Button>
            <Button type="button" variant="outline" icon={<ScanLine size={18} />} onClick={() => fileInputRef.current?.click()}>
              Chụp ảnh QR
            </Button>
            {qrToken && <Button type="button" variant="ghost" icon={<X size={16} />} onClick={() => setQrToken("")}>Xóa token</Button>}
          </div>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void scanQrImage(e.target.files?.[0])}
          />
          <Input label="QR token" value={qrToken} onChange={(e) => setQrToken(e.target.value)} placeholder="Token sẽ tự điền sau khi quét QR" />
          <Input label="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Nhập 4-6 chữ số" inputMode="numeric" autoComplete="one-time-code" />
          <Button className="full-width" disabled={loading}>{loading ? "Đang xác thực" : "Xác nhận điểm danh"}</Button>
          {success && <div className="success-box"><CheckCircle2 size={22} /> Điểm danh thành công. Bạn có thể xem lại trong lịch sử.</div>}
        </form>
      </section>

      <Modal open={scannerOpen} title="Quét QR điểm danh" onClose={closeScanner}>
        <div className="qr-scanner">
          <video ref={videoRef} muted playsInline />
          <div className="scanner-frame" aria-hidden="true" />
        </div>
        <p className="scanner-status">{scannerStatus}</p>
        <div className="modal-actions">
          <Button type="button" icon={<ScanLine size={16} />} onClick={() => fileInputRef.current?.click()}>Chụp ảnh QR</Button>
          <Button type="button" variant="outline" onClick={closeScanner}>Hủy</Button>
        </div>
      </Modal>
    </div>
  );
}
