import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";
import { closeExpiredSessions } from "./services/attendance.service.js";

const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

let closingExpiredSessions = false;
const runAttendanceSessionCleanup = async () => {
  if (closingExpiredSessions) return;
  closingExpiredSessions = true;
  try {
    const closed = await closeExpiredSessions();
    if (closed > 0) console.log(`Auto-closed ${closed} expired attendance session(s).`);
  } catch (error) {
    console.error("Failed to auto-close expired attendance sessions:", error);
  } finally {
    closingExpiredSessions = false;
  }
};

void runAttendanceSessionCleanup();
const attendanceCleanupTimer = setInterval(() => {
  void runAttendanceSessionCleanup();
}, 60_000);
attendanceCleanupTimer.unref();

const shutdown = async () => {
  clearInterval(attendanceCleanupTimer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
