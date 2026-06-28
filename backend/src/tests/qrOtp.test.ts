import { describe, expect, it } from "vitest";
import { createQrToken, currentWindow, generateOtp, verifyOtpAndQr } from "../utils/qrOtp.js";

describe("QR + OTP", () => {
  it("accepts matching QR token and OTP in current 30s window", () => {
    const session = {
      id: "session-1",
      courseSectionId: "section-1",
      nonce: "nonce-1"
    };
    const window = currentWindow();
    const qrToken = createQrToken({ sessionId: session.id, courseSectionId: session.courseSectionId, nonce: session.nonce, window });
    const otp = generateOtp(session.id, session.nonce, window);

    expect(() => verifyOtpAndQr(qrToken, otp, session)).not.toThrow();
  });

  it("rejects wrong OTP", () => {
    const session = {
      id: "session-1",
      courseSectionId: "section-1",
      nonce: "nonce-1"
    };
    const window = currentWindow();
    const qrToken = createQrToken({ sessionId: session.id, courseSectionId: session.courseSectionId, nonce: session.nonce, window });

    expect(() => verifyOtpAndQr(qrToken, "000000", session)).toThrow("OTP không đúng.");
  });
});
