import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  sessionId?: string;
};

export const newSessionId = () => nanoid(32);

export const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, {
    expiresIn: env.ACCESS_TOKEN_TTL
  } as SignOptions);

export const signRefreshToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, {
    expiresIn: env.REFRESH_TOKEN_TTL
  } as SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
