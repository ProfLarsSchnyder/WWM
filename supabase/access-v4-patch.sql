-- WWM Zugriffssystem v4: kleine Ergänzung für die neue Lernendenansicht
-- Einmal im Supabase SQL Editor ausführen.
-- Voraussetzung: supabase/access-v4.sql wurde bereits ausgeführt.

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

revoke all on function public.wwm_student_games_list_v4() from public;
grant execute on function public.wwm_student_games_list_v4() to anon, authenticated;
