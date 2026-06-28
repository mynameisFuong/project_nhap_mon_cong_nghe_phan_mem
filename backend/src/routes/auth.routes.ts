import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { changePassword, login, logout, me, refresh } from "../controllers/auth.controller.js";

export const authRoutes = Router();

authRoutes.post("/login", login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", authenticate, logout);
authRoutes.get("/me", authenticate, me);
authRoutes.patch("/change-password", authenticate, changePassword);
