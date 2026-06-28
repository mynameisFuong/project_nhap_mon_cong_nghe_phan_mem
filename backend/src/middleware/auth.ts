import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/http.js";
import { verifyAccessToken } from "../utils/tokens.js";

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "Thiếu access token."));
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === "LOCKED") {
      throw new AppError(401, "ACCOUNT_INVALID", "Tài khoản không tồn tại hoặc đã bị khóa.");
    }

    if (user.role === "STUDENT" && user.currentSessionId !== payload.sessionId) {
      throw new AppError(401, "SESSION_REVOKED", "Phiên đăng nhập đã bị vô hiệu hóa.");
    }

    req.user = { id: user.id, email: user.email, role: user.role, sessionId: payload.sessionId };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, "INVALID_TOKEN", "Token không hợp lệ."));
  }
};

export const authorize = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Chưa đăng nhập."));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, "FORBIDDEN", "Không đủ quyền truy cập."));
  }
  next();
};
