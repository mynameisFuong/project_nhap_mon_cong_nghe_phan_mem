DROP INDEX IF EXISTS "attendance_sessions_lesson_id_key";

CREATE INDEX IF NOT EXISTS "attendance_sessions_lesson_id_idx" ON "attendance_sessions"("lesson_id");
