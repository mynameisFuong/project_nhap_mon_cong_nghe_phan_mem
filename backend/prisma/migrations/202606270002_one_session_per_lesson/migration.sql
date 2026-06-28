DROP INDEX IF EXISTS "attendance_sessions_lesson_id_idx";

DO $$
DECLARE
  duplicate RECORD;
  source_lesson RECORD;
  candidate_start TEXT;
  candidate_minutes INTEGER;
  new_lesson_id UUID;
BEGIN
  FOR duplicate IN
    SELECT id, lesson_id, ROW_NUMBER() OVER (PARTITION BY lesson_id ORDER BY opened_at ASC, id ASC) AS duplicate_index
    FROM "attendance_sessions"
  LOOP
    IF duplicate.duplicate_index = 1 THEN
      CONTINUE;
    END IF;

    SELECT * INTO source_lesson FROM "lessons" WHERE id = duplicate.lesson_id;
    candidate_minutes :=
      (split_part(source_lesson.start_time, ':', 1)::INTEGER * 60)
      + split_part(source_lesson.start_time, ':', 2)::INTEGER
      + duplicate.duplicate_index - 1;

    LOOP
      candidate_start := lpad(((candidate_minutes / 60) % 24)::TEXT, 2, '0') || ':' || lpad((candidate_minutes % 60)::TEXT, 2, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "lessons"
        WHERE "course_section_id" = source_lesson.course_section_id
          AND "lesson_date" = source_lesson.lesson_date
          AND "start_time" = candidate_start
      );
      candidate_minutes := candidate_minutes + 1;
    END LOOP;

    INSERT INTO "lessons" ("id", "course_section_id", "lesson_date", "start_time", "end_time", "room", "topic", "created_at")
    VALUES (gen_random_uuid(), source_lesson.course_section_id, source_lesson.lesson_date, candidate_start, source_lesson.end_time, source_lesson.room, source_lesson.topic, CURRENT_TIMESTAMP)
    RETURNING id INTO new_lesson_id;

    UPDATE "attendance_sessions" SET "lesson_id" = new_lesson_id WHERE id = duplicate.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "attendance_sessions_lesson_id_key" ON "attendance_sessions"("lesson_id");
