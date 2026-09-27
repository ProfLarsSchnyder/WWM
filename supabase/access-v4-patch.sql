-- WWM Zugriffssystem v4: Ergänzung für die neue Lernendenansicht
-- Einmal im Supabase SQL Editor ausführen.
-- Voraussetzung: supabase/access-v4.sql wurde bereits ausgeführt.

-- 1) Lernende erhalten nur Spiele, die wirklich sichtbar sind.
-- Der interne joinCode wird nur für diese sichtbaren Spiele geliefert,
-- damit die bestehende stabile Spiellogik weiterverwendet werden kann.
create or replace function public.wwm_student_games_list_v4()
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
        'joinCode', g.join_code,
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

-- 2) Auch ein alter oder bereits bekannter Spielcode darf versteckte Spiele
-- nicht mehr öffnen. Die bestehende Join-Funktion ruft diese Preview-Funktion auf.
create or replace function public.wwm_student_preview(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sid uuid;
  gid uuid;
  title text;
  qs jsonb;
  code text;
begin
  code := upper(btrim(coalesce(p_join_code,'')));

  select id, title, questions
  into gid, title, qs
  from public.wwm_quiz_games
  where join_code = code
    and archived = false
    and access_mode in ('active','open');

  if not found then
    raise exception 'Spiel ist nicht freigeschaltet';
  end if;

  select id
  into sid
  from public.wwm_host_sessions
  where game_id = gid
    and status = 'active'
  order by started_at desc
  limit 1;

  if sid is null then
    insert into public.wwm_host_sessions(game_id,status)
    values(gid,'active')
    returning id into sid;
  end if;

  return jsonb_build_object(
    'sessionId', sid,
    'gameId', gid,
    'title', title,
    'joinCode', code,
    'questionCount', jsonb_array_length(qs)
  );
end;
$$;

revoke all on function public.wwm_student_games_list_v4() from public;
revoke all on function public.wwm_student_preview(text) from public;

grant execute on function public.wwm_student_games_list_v4() to anon, authenticated;
grant execute on function public.wwm_student_preview(text) to anon, authenticated;
