import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { routes } from "./routes/index.js";

export const app = express();
const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim());
const isLocalDevOrigin = (origin: string) => {
  if (env.NODE_ENV !== "development") return false;
  try {
    const { hostname } = new URL(origin);
    return (
      ["localhost", "127.0.0.1", "::1"].includes(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60_000, limit: 180 }));
app.use("/uploads", express.static("uploads"));

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);
