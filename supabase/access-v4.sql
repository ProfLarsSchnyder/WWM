-- ============================================================
-- WWM Zugriffssystem v4
-- Keine Lernendencodes mehr in der Oberfläche.
-- Spiele haben:
--   category    = subject | fun
--   access_mode = hidden | active | open
--
-- Lernendenansicht:
--   subject + active -> Aktuell freigeschaltet
--   subject + open   -> Freies Üben
--   fun + active/open -> Just for Fun
-- ============================================================

alter table public.wwm_quiz_games
  add column if not exists category text not null default 'subject';

alter table public.wwm_quiz_games
  add column if not exists access_mode text not null default 'hidden';

-- Ungültige Altwerte bereinigen, bevor Constraints gesetzt werden.
update public.wwm_quiz_games
set category = 'subject'
where category is null or category not in ('subject','fun');

update public.wwm_quiz_games
set access_mode = 'hidden'
where access_mode is null or access_mode not in ('hidden','active','open');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wwm_quiz_games_category_check'
      and conrelid = 'public.wwm_quiz_games'::regclass
  ) then
    alter table public.wwm_quiz_games
      add constraint wwm_quiz_games_category_check
      check (category in ('subject','fun'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wwm_quiz_games_access_mode_check'
      and conrelid = 'public.wwm_quiz_games'::regclass
  ) then
    alter table public.wwm_quiz_games
      add constraint wwm_quiz_games_access_mode_check
      check (access_mode in ('hidden','active','open'));
  end if;
end;
$$;

-- Falls bereits ein offensichtlicher Fun-Ordner existiert, werden diese Spiele
-- automatisch als Fun und offen markiert. Alles andere bleibt sicher versteckt.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wwm_quiz_games'
      and column_name = 'folder'
  ) then
    execute $sql$
      update public.wwm_quiz_games
      set category = 'fun', access_mode = 'open', updated_at = now()
      where lower(btrim(coalesce(folder,''))) in (
        'fun', 'just for fun', 'spass', 'spaß', 'freizeit'
      )
    $sql$;
  end if;
end;
$$;

-- ============================================================
-- LEHRER: Spiele inklusive Zugriffsinformationen laden
-- ============================================================

create or replace function public.wwm_teacher_games_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
begin
  perform public.wwm_assert_teacher(p_token);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'title', g.title,
        'joinCode', g.join_code,
        'folder', coalesce(to_jsonb(g)->>'folder',''),
        'category', g.category,
        'accessMode', g.access_mode,
        'questions', g.questions,
        'createdAt', g.created_at,
        'updatedAt', g.updated_at
      )
      order by g.updated_at desc
    ),
    '[]'::jsonb
  )
  into result
  from public.wwm_quiz_games g
  where g.archived = false;

  return result;
end;
$$;

-- ============================================================
-- LEHRER: Bereich und Zugriff eines Spiels ändern
-- ============================================================

create or replace function public.wwm_teacher_game_access_set(
  p_token text,
  p_game_id uuid,
  p_category text,
  p_access_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_category text;
  v_access text;
  g public.wwm_quiz_games;
begin
  perform public.wwm_assert_teacher(p_token);

  v_category := lower(btrim(coalesce(p_category,'')));
  v_access := lower(btrim(coalesce(p_access_mode,'')));

  if v_category not in ('subject','fun') then
    raise exception 'Ungültiger Bereich';
  end if;

  if v_access not in ('hidden','active','open') then
    raise exception 'Ungültiger Zugriff';
  end if;

  update public.wwm_quiz_games
  set
    category = v_category,
    access_mode = v_access,
    updated_at = now()
  where id = p_game_id
    and archived = false
  returning * into g;

  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;

  return jsonb_build_object(
    'id', g.id,
    'category', g.category,
    'accessMode', g.access_mode,
    'updatedAt', g.updated_at
  );
end;
$$;

-- ============================================================
-- LERNENDE: Nur sichtbare Spiele auflisten
-- Es werden bewusst keine Fragen oder Lösungen ausgeliefert.
-- ============================================================

create or replace function public.wwm_student_games_list()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'title', g.title,
        'category', g.category,
        'accessMode', g.access_mode,
        'questionCount', jsonb_array_length(g.questions)
      )
      order by
        case g.access_mode when 'active' then 0 else 1 end,
        lower(g.title)
    ),
    '[]'::jsonb
  )
  from public.wwm_quiz_games g
  where g.archived = false
    and g.access_mode in ('active','open');
$$;

-- ============================================================
-- LERNENDE: Ohne Code direkt einem sichtbaren Spiel beitreten
-- ============================================================

create or replace function public.wwm_student_join_game(
  p_game_id uuid,
  p_student_name text,
  p_class_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  g public.wwm_quiz_games;
  sid uuid;
  token text;
  pid uuid;
  sname text;
  cname text;
begin
  sname := btrim(coalesce(p_student_name,''));
  cname := btrim(coalesce(p_class_name,''));

  if sname = '' then
    raise exception 'Bitte Name eingeben';
  end if;

  if cname = '' then
    raise exception 'Bitte Klasse eingeben';
  end if;

  select *
  into g
  from public.wwm_quiz_games
  where id = p_game_id
    and archived = false
    and access_mode in ('active','open');

  if not found then
    raise exception 'Spiel ist nicht freigeschaltet';
  end if;

  select h.id
  into sid
  from public.wwm_host_sessions h
  where h.game_id = g.id
    and h.status = 'active'
  order by h.started_at desc
  limit 1;

  if sid is null then
    insert into public.wwm_host_sessions(game_id,status)
    values(g.id,'active')
    returning id into sid;
  end if;

  token := encode(extensions.gen_random_bytes(32),'hex');

  insert into public.wwm_participants(
    session_id,
    game_id,
    student_name,
    class_name,
    token_hash
  )
  values(
    sid,
    g.id,
    sname,
    cname,
    public.wwm_hash_secret(token)
  )
  returning id into pid;

  return jsonb_build_object(
    'participantId', pid,
    'participantToken', token,
    'sessionId', sid,
    'gameId', g.id,
    'title', g.title,
    'questionCount', jsonb_array_length(g.questions),
    'studentName', sname,
    'className', cname,
    'currentQuestionIndex', 0
  );
end;
$$;

-- ============================================================
-- RECHTE
-- ============================================================

revoke all on function public.wwm_teacher_games_list(text) from public;
revoke all on function public.wwm_teacher_game_access_set(text,uuid,text,text) from public;
revoke all on function public.wwm_student_games_list() from public;
revoke all on function public.wwm_student_join_game(uuid,text,text) from public;

grant execute on function public.wwm_teacher_games_list(text) to anon, authenticated;
grant execute on function public.wwm_teacher_game_access_set(text,uuid,text,text) to anon, authenticated;
grant execute on function public.wwm_student_games_list() to anon, authenticated;
grant execute on function public.wwm_student_join_game(uuid,text,text) to anon, authenticated;
