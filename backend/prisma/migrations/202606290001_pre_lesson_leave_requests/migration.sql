ALTER TABLE "leave_requests"
ADD COLUMN "lesson_id" UUID;

UPDATE "leave_requests" lr
SET "lesson_id" = s."lesson_id"
FROM "attendance_sessions" s
WHERE lr."attendance_session_id" = s."id";

ALTER TABLE "leave_requests"
ALTER COLUMN "lesson_id" SET NOT NULL;

ALTER TABLE "leave_requests"
ALTER COLUMN "attendance_session_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "leave_requests_lesson_id_idx" ON "leave_requests"("lesson_id");

CREATE UNIQUE INDEX IF NOT EXISTS "leave_requests_lesson_id_student_id_key" ON "leave_requests"("lesson_id", "student_id");

ALTER TABLE "leave_requests"
ADD CONSTRAINT "leave_requests_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
