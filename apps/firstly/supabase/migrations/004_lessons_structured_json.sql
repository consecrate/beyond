-- Persist custom-GPT generated structured lesson JSON on the lesson workspace row.

alter table public.lessons
  add column if not exists structured_lesson_json jsonb;
