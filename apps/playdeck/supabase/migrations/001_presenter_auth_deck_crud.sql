-- ============================================================
-- Migration: Presenter Auth & Deck CRUD
-- ============================================================

-- ---------- helper: updated_at trigger function ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- presenter_profiles ----------

create table public.presenter_profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  display_name text       not null constraint display_name_not_empty check (trim(display_name) <> ''),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger presenter_profiles_updated_at
  before update on public.presenter_profiles
  for each row execute function public.set_updated_at();

alter table public.presenter_profiles enable row level security;

create policy "Presenters can select own profile"
  on public.presenter_profiles for select
  using (auth.uid() = id);

create policy "Presenters can insert own profile"
  on public.presenter_profiles for insert
  with check (auth.uid() = id);

create policy "Presenters can update own profile"
  on public.presenter_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- decks ----------

create table public.decks (
  id           uuid        primary key default gen_random_uuid(),
  presenter_id uuid        not null references public.presenter_profiles(id) on delete cascade,
  title        text        not null constraint deck_title_not_empty check (trim(title) <> ''),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index decks_presenter_updated on public.decks (presenter_id, updated_at desc);

create trigger decks_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

alter table public.decks enable row level security;

create policy "Presenters can select own decks"
  on public.decks for select
  using (auth.uid() = presenter_id);

create policy "Presenters can insert own decks"
  on public.decks for insert
  with check (auth.uid() = presenter_id);

create policy "Presenters can update own decks"
  on public.decks for update
  using (auth.uid() = presenter_id)
  with check (auth.uid() = presenter_id);

create policy "Presenters can delete own decks"
  on public.decks for delete
  using (auth.uid() = presenter_id);

-- ---------- deck_slides ----------

create table public.deck_slides (
  id            uuid        primary key default gen_random_uuid(),
  deck_id       uuid        not null references public.decks(id) on delete cascade,
  position      integer     not null constraint position_non_negative check (position >= 0),
  slide_kind    text        not null default 'simple' constraint slide_kind_valid check (slide_kind in ('simple')),
  title         text        not null default '',
  body          text        not null default '',
  speaker_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (deck_id, position)
);

create index deck_slides_ordered on public.deck_slides (deck_id, position asc);

create trigger deck_slides_updated_at
  before update on public.deck_slides
  for each row execute function public.set_updated_at();

alter table public.deck_slides enable row level security;

create policy "Presenters can select own slides"
  on public.deck_slides for select
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_slides.deck_id
        and decks.presenter_id = auth.uid()
    )
  );

create policy "Presenters can insert own slides"
  on public.deck_slides for insert
  with check (
    exists (
      select 1 from public.decks
      where decks.id = deck_slides.deck_id
        and decks.presenter_id = auth.uid()
    )
  );

create policy "Presenters can update own slides"
  on public.deck_slides for update
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_slides.deck_id
        and decks.presenter_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks
      where decks.id = deck_slides.deck_id
        and decks.presenter_id = auth.uid()
    )
  );

create policy "Presenters can delete own slides"
  on public.deck_slides for delete
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_slides.deck_id
        and decks.presenter_id = auth.uid()
    )
  );
