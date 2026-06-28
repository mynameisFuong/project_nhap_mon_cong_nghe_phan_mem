import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { adminRoutes } from "./admin.routes.js";
import { authRoutes } from "./auth.routes.js";
import { studentRoutes } from "./student.routes.js";
import { teacherRoutes } from "./teacher.routes.js";

export const routes = Router();

routes.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));
routes.use("/auth", authRoutes);
routes.use("/admin", authenticate, adminRoutes);
routes.use("/teacher", authenticate, teacherRoutes);
routes.use("/student", authenticate, studentRoutes);
