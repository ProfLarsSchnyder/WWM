create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  position integer not null default 0,
  question text not null,
  correct_answer text not null,
  wrong_answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists questions_game_id_position_idx
  on public.questions(game_id, position);

alter table public.games enable row level security;
alter table public.questions enable row level security;

-- Absichtlich keine offenen anon Policies.
-- Sobald die gewünschte Anmeldung bzw. Zugriffslogik feststeht,
-- werden hier passende RLS Policies ergänzt.
-- So ist die Datenbank nicht versehentlich öffentlich beschreibbar.
