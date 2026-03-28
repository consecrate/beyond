-- Generated lesson body: Markdown with $...$ / $$...$$ math (see lesson GPT flow).

alter table public.lessons
  add column if not exists lesson_markdown text;

comment on column public.lessons.lesson_markdown is 'Full Markdown lesson document from the lesson generator; optional.';
