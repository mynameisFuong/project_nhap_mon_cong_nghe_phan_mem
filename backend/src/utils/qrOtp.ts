import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./http.js";

export type QrPayload = {
  sessionId: string;
  courseSectionId: string;
  window: number;
  nonce: string;
};

const base64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

export const currentWindow = (date = new Date()) =>
  Math.floor(date.getTime() / 1000 / env.OTP_WINDOW_SECONDS);

const sign = (payload: string) =>
  crypto.createHmac("sha256", env.OTP_SECRET).update(payload).digest("base64url");

export const generateOtp = (sessionId: string, nonce: string, window = currentWindow()) => {
  const digest = crypto
    .createHmac("sha256", env.OTP_SECRET)
    .update(`${sessionId}:${nonce}:${window}`)
    .digest();
  const code = digest.readUInt32BE(0) % 10 ** env.OTP_DIGITS;
  return code.toString().padStart(env.OTP_DIGITS, "0");
};

export const createQrToken = (payload: QrPayload) => {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
};

export const parseQrToken = (token: string): QrPayload => {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) {
    throw new AppError(400, "INVALID_QR", "QR token không hợp lệ.");
  }

  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as QrPayload;
};

export const verifyOtpAndQr = (token: string, otp: string, session: { id: string; courseSectionId: string; nonce: string }) => {
  const payload = parseQrToken(token);
  const nowWindow = currentWindow();
  const validWindow = payload.window === nowWindow || payload.window === nowWindow - 1;

  if (
    payload.sessionId !== session.id ||
    payload.courseSectionId !== session.courseSectionId ||
    payload.nonce !== session.nonce ||
    !validWindow
  ) {
    throw new AppError(400, "EXPIRED_QR", "QR đã hết hạn hoặc không thuộc phiên hiện tại.");
  }

  const expected = generateOtp(session.id, session.nonce, payload.window);
  if (expected !== otp) {
    throw new AppError(400, "INVALID_OTP", "OTP không đúng.");
  }
};
