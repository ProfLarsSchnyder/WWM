-- WWM Unterrichtsquiz, Supabase Cloud-Speicher
-- Einmal im Supabase SQL Editor ausführen.
-- Die Tabelle ist direkt gesperrt. Zugriff erfolgt nur über die drei RPC-Funktionen
-- und einen langen persönlichen Cloud Code, der im Browser gespeichert wird.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.wwm_games (
  workspace_hash text not null,
  id uuid not null,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_hash, id)
);

alter table public.wwm_games enable row level security;
revoke all on table public.wwm_games from anon, authenticated;

create or replace function public.wwm_workspace_hash(p_workspace_key text)
returns text
language sql
immutable
strict
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_workspace_key, 'sha256'), 'hex');
$$;

revoke all on function public.wwm_workspace_hash(text) from public, anon, authenticated;

create or replace function public.wwm_games_list(p_workspace_key text)
returns table (
  id uuid,
  title text,
  questions jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_workspace_key, '')) < 20 then
    raise exception 'Cloud Code ist zu kurz';
  end if;

  return query
  select g.id, g.title, g.questions, g.created_at, g.updated_at
  from public.wwm_games g
  where g.workspace_hash = public.wwm_workspace_hash(p_workspace_key)
  order by g.updated_at desc;
end;
$$;

create or replace function public.wwm_game_save(p_workspace_key text, p_game jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_workspace_hash text;
  v_id uuid;
  v_title text;
  v_questions jsonb;
  v_created_at timestamptz;
  v_saved public.wwm_games;
begin
  if length(coalesce(p_workspace_key, '')) < 20 then
    raise exception 'Cloud Code ist zu kurz';
  end if;

  v_workspace_hash := public.wwm_workspace_hash(p_workspace_key);
  v_title := btrim(coalesce(p_game ->> 'title', ''));
  v_questions := coalesce(p_game -> 'questions', '[]'::jsonb);

  if v_title = '' then
    raise exception 'Titel fehlt';
  end if;
  if jsonb_typeof(v_questions) <> 'array' then
    raise exception 'Fragen müssen eine JSON-Liste sein';
  end if;

  begin
    v_id := nullif(p_game ->> 'id', '')::uuid;
  exception when others then
    raise exception 'Ungültige Spiel-ID';
  end;
  if v_id is null then v_id := extensions.gen_random_uuid(); end if;

  begin
    v_created_at := coalesce(nullif(p_game ->> 'createdAt', '')::timestamptz, now());
  exception when others then
    v_created_at := now();
  end;

  insert into public.wwm_games as g (
    workspace_hash, id, title, questions, created_at, updated_at
  ) values (
    v_workspace_hash, v_id, v_title, v_questions, v_created_at, now()
  )
  on conflict (workspace_hash, id) do update
    set title = excluded.title,
        questions = excluded.questions,
        updated_at = now()
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'title', v_saved.title,
    'questions', v_saved.questions,
    'created_at', v_saved.created_at,
    'updated_at', v_saved.updated_at
  );
end;
$$;

create or replace function public.wwm_game_delete(p_workspace_key text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted integer;
begin
  if length(coalesce(p_workspace_key, '')) < 20 then
    raise exception 'Cloud Code ist zu kurz';
  end if;

  delete from public.wwm_games
  where workspace_hash = public.wwm_workspace_hash(p_workspace_key)
    and id = p_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.wwm_games_list(text) from public;
revoke all on function public.wwm_game_save(text, jsonb) from public;
revoke all on function public.wwm_game_delete(text, uuid) from public;

grant execute on function public.wwm_games_list(text) to anon, authenticated;
grant execute on function public.wwm_game_save(text, jsonb) to anon, authenticated;
grant execute on function public.wwm_game_delete(text, uuid) to anon, authenticated;
