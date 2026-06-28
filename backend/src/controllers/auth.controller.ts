import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler, AppError, ok } from "../utils/http.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { newSessionId, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6)
});

const publicUser = (user: { id: string; email: string; fullName: string; role: string; status: string; studentCode?: string | null; teacherCode?: string | null }) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
  studentCode: user.studentCode,
  teacherCode: user.teacherCode
});

export const login = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
  }
  if (user.status === "LOCKED") throw new AppError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa.");

  const sessionId = user.role === "STUDENT" ? newSessionId() : user.currentSessionId ?? newSessionId();
  const payload = { sub: user.id, email: user.email, role: user.role, sessionId };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      currentSessionId: sessionId,
      refreshTokenHash: await hashPassword(refreshToken)
    }
  });

  ok(res, { user: publicUser(updated), accessToken, refreshToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  const payload = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user?.refreshTokenHash || !(await verifyPassword(refreshToken, user.refreshTokenHash))) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ.");
  }
  if (user.role === "STUDENT" && user.currentSessionId !== payload.sessionId) {
    throw new AppError(401, "SESSION_REVOKED", "Phiên đăng nhập đã bị vô hiệu hóa.");
  }

  ok(res, { accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role, sessionId: payload.sessionId }) });
});

export const logout = asyncHandler(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { refreshTokenHash: null, currentSessionId: null }
  });
  ok(res, { message: "Đã đăng xuất." });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  ok(res, publicUser(user));
});

export const changePassword = asyncHandler(async (req, res) => {
  const input = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await verifyPassword(input.oldPassword, user.passwordHash))) {
    throw new AppError(400, "WRONG_PASSWORD", "Mật khẩu cũ không đúng.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword), refreshTokenHash: null }
  });
  ok(res, { message: "Đổi mật khẩu thành công." });
});
