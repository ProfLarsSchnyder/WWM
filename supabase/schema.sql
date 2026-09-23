-- WWM Unterrichtsquiz v3
-- Lehrer- und Lernendenmodus, Hosting, Analyse und sichere RPC-Funktionen
-- Einmal vollständig im Supabase SQL Editor ausführen.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- TABELLEN
-- ============================================================

create table if not exists public.wwm_app_settings (
  singleton boolean primary key default true check (singleton = true),
  teacher_pin_hash text not null,
  join_code text not null,
  active_session_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wwm_quiz_games (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wwm_teacher_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.wwm_host_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.wwm_quiz_games(id) on delete restrict,
  status text not null default 'active' check (status in ('active','closed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null
);

create table if not exists public.wwm_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.wwm_host_sessions(id) on delete cascade,
  game_id uuid not null references public.wwm_quiz_games(id) on delete restrict,
  student_name text not null,
  class_name text not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','completed','eliminated','quit')),
  current_question_index integer not null default 0,
  last_answered_index integer not null default -1,
  correct_count integer not null default 0,
  jokers_used jsonb not null default '{"fifty":false,"audience":false,"phone":false,"teacher":false}'::jsonb,
  joker_results jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  finished_at timestamptz null
);

create table if not exists public.wwm_participant_answers (
  id bigint generated always as identity primary key,
  participant_id uuid not null references public.wwm_participants(id) on delete cascade,
  session_id uuid not null references public.wwm_host_sessions(id) on delete cascade,
  game_id uuid not null references public.wwm_quiz_games(id) on delete restrict,
  question_index integer not null,
  selected_key text not null check (selected_key in ('A','B','C','D')),
  selected_text text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  response_ms integer null,
  unique (participant_id, question_index)
);

create index if not exists idx_wwm_participants_session on public.wwm_participants(session_id);
create index if not exists idx_wwm_participants_last_seen on public.wwm_participants(last_seen desc);
create index if not exists idx_wwm_answers_session_question on public.wwm_participant_answers(session_id, question_index);

alter table public.wwm_app_settings enable row level security;
alter table public.wwm_quiz_games enable row level security;
alter table public.wwm_teacher_sessions enable row level security;
alter table public.wwm_host_sessions enable row level security;
alter table public.wwm_participants enable row level security;
alter table public.wwm_participant_answers enable row level security;

revoke all on table public.wwm_app_settings from anon, authenticated;
revoke all on table public.wwm_quiz_games from anon, authenticated;
revoke all on table public.wwm_teacher_sessions from anon, authenticated;
revoke all on table public.wwm_host_sessions from anon, authenticated;
revoke all on table public.wwm_participants from anon, authenticated;
revoke all on table public.wwm_participant_answers from anon, authenticated;

insert into public.wwm_app_settings(singleton, teacher_pin_hash, join_code)
values (
  true,
  extensions.crypt('1234', extensions.gen_salt('bf')),
  upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6))
)
on conflict (singleton) do nothing;

-- ============================================================
-- INTERNE HELFER
-- ============================================================

create or replace function public.wwm_hash_secret(p_secret text)
returns text language sql immutable strict security definer
set search_path = public, extensions
as $$ select encode(extensions.digest(p_secret, 'sha256'), 'hex') $$;

create or replace function public.wwm_assert_teacher(p_token text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_token,'')) < 20 then raise exception 'Lehrer Sitzung ungültig'; end if;
  if not exists (
    select 1 from public.wwm_teacher_sessions
    where token_hash = public.wwm_hash_secret(p_token) and expires_at > now()
  ) then raise exception 'Lehrer Sitzung abgelaufen oder ungültig'; end if;
end;
$$;

create or replace function public.wwm_assert_participant(p_participant_id uuid, p_token text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_token,'')) < 20 then raise exception 'Spieler Token ungültig'; end if;
  if not exists (
    select 1 from public.wwm_participants
    where id = p_participant_id and token_hash = public.wwm_hash_secret(p_token)
  ) then raise exception 'Spieler Sitzung ungültig'; end if;
end;
$$;

create or replace function public.wwm_validate_questions(p_questions jsonb)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare q jsonb; n integer := 0; answer_count integer;
begin
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then raise exception 'Fragen müssen eine JSON Liste sein'; end if;
  if jsonb_array_length(p_questions) < 1 then raise exception 'Ein Spiel braucht mindestens eine Frage'; end if;
  if jsonb_array_length(p_questions) > 100 then raise exception 'Maximal 100 Fragen pro Spiel'; end if;
  for q in select value from jsonb_array_elements(p_questions) loop
    n := n + 1;
    if btrim(coalesce(q->>'question','')) = '' then raise exception 'Frage % enthält keinen Fragetext', n; end if;
    if btrim(coalesce(q->>'correct','')) = '' then raise exception 'Frage % enthält keine richtige Antwort', n; end if;
    if jsonb_typeof(q->'wrong') <> 'array' or jsonb_array_length(q->'wrong') <> 3 then raise exception 'Frage % braucht genau drei falsche Antworten', n; end if;
    if exists (select 1 from jsonb_array_elements_text(q->'wrong') x where btrim(x.value) = '') then raise exception 'Frage % enthält eine leere Antwort', n; end if;
    select count(distinct lower(x)) into answer_count from (
      select btrim(q->>'correct') as x union all
      select btrim(value) from jsonb_array_elements_text(q->'wrong')
    ) s;
    if answer_count <> 4 then raise exception 'Frage % enthält doppelte Antworten', n; end if;
  end loop;
end;
$$;

create or replace function public.wwm_answer_key_map(p_participant_id uuid, p_question_index integer, p_question jsonb)
returns table(answer_key text, answer_text text, is_correct boolean)
language sql immutable security definer
set search_path = public, extensions
as $$
with items(answer_text,is_correct,source_number) as (
  values
    (p_question->>'correct', true, 0),
    (p_question->'wrong'->>0, false, 1),
    (p_question->'wrong'->>1, false, 2),
    (p_question->'wrong'->>2, false, 3)
), ranked as (
  select i.*, row_number() over (
    order by encode(extensions.digest(
      p_participant_id::text || ':' || p_question_index::text || ':' || i.source_number::text || ':' || i.answer_text,
      'sha256'), 'hex')
  ) as pos
  from items i
)
select chr(64 + pos::integer)::text, answer_text, is_correct from ranked order by pos;
$$;

-- ============================================================
-- LEHRER RPC
-- ============================================================

create or replace function public.wwm_teacher_login(p_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare v_hash text; v_code text; v_token text; v_expires timestamptz;
begin
  select teacher_pin_hash, join_code into v_hash, v_code from public.wwm_app_settings where singleton = true;
  if extensions.crypt(coalesce(p_pin,''), v_hash) <> v_hash then raise exception 'Falsches Passwort'; end if;
  delete from public.wwm_teacher_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires := now() + interval '12 hours';
  insert into public.wwm_teacher_sessions(token_hash, expires_at) values(public.wwm_hash_secret(v_token), v_expires);
  return jsonb_build_object('token',v_token,'expiresAt',v_expires,'joinCode',v_code);
end;
$$;

create or replace function public.wwm_teacher_logout(p_token text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  delete from public.wwm_teacher_sessions where token_hash = public.wwm_hash_secret(p_token);
  get diagnostics n = row_count; return n > 0;
end;
$$;

create or replace function public.wwm_teacher_get_settings(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare r public.wwm_app_settings;
begin
  perform public.wwm_assert_teacher(p_token);
  select * into r from public.wwm_app_settings where singleton = true;
  return jsonb_build_object('joinCode',r.join_code,'activeSessionId',r.active_session_id);
end;
$$;

create or replace function public.wwm_teacher_games_list(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare result jsonb;
begin
  perform public.wwm_assert_teacher(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title',title,'questions',questions,'createdAt',created_at,'updatedAt',updated_at
  ) order by updated_at desc),'[]'::jsonb) into result
  from public.wwm_quiz_games where archived = false;
  return result;
end;
$$;

create or replace function public.wwm_teacher_game_save(p_token text, p_game jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid; v_title text; v_questions jsonb; v_created timestamptz; r public.wwm_quiz_games;
begin
  perform public.wwm_assert_teacher(p_token);
  v_title := btrim(coalesce(p_game->>'title',''));
  if v_title = '' then raise exception 'Das Spiel braucht einen Titel'; end if;
  v_questions := coalesce(p_game->'questions','[]'::jsonb);
  perform public.wwm_validate_questions(v_questions);
  begin v_id := nullif(p_game->>'id','')::uuid; exception when others then v_id := null; end;
  if v_id is null then v_id := extensions.gen_random_uuid(); end if;
  begin v_created := coalesce(nullif(p_game->>'createdAt','')::timestamptz, now()); exception when others then v_created := now(); end;
  insert into public.wwm_quiz_games as g(id,title,questions,archived,created_at,updated_at)
  values(v_id,v_title,v_questions,false,v_created,now())
  on conflict(id) do update set title=excluded.title, questions=excluded.questions, archived=false, updated_at=now()
  returning * into r;
  return jsonb_build_object('id',r.id,'title',r.title,'questions',r.questions,'createdAt',r.created_at,'updatedAt',r.updated_at);
end;
$$;

create or replace function public.wwm_teacher_game_delete(p_token text, p_game_id uuid)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  perform public.wwm_assert_teacher(p_token);
  update public.wwm_quiz_games set archived=true, updated_at=now() where id=p_game_id;
  get diagnostics n = row_count; return n > 0;
end;
$$;

create or replace function public.wwm_teacher_host_game(p_token text, p_game_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare g public.wwm_quiz_games; sid uuid; code text;
begin
  perform public.wwm_assert_teacher(p_token);
  select * into g from public.wwm_quiz_games where id=p_game_id and archived=false;
  if not found then raise exception 'Spiel nicht gefunden'; end if;
  update public.wwm_host_sessions set status='closed',ended_at=now() where status='active';
  insert into public.wwm_host_sessions(game_id,status) values(p_game_id,'active') returning id into sid;
  update public.wwm_app_settings set active_session_id=sid,updated_at=now() where singleton=true;
  select join_code into code from public.wwm_app_settings where singleton=true;
  return jsonb_build_object('sessionId',sid,'gameId',g.id,'title',g.title,'joinCode',code,'startedAt',now());
end;
$$;

create or replace function public.wwm_teacher_stop_host(p_token text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare sid uuid;
begin
  perform public.wwm_assert_teacher(p_token);
  select active_session_id into sid from public.wwm_app_settings where singleton=true;
  if sid is null then return false; end if;
  update public.wwm_host_sessions set status='closed',ended_at=now() where id=sid;
  update public.wwm_app_settings set active_session_id=null,updated_at=now() where singleton=true;
  return true;
end;
$$;

create or replace function public.wwm_teacher_dashboard(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  sid uuid; code text; gid uuid; title text; qs jsonb; started timestamptz; qcount integer;
  people jsonb; qstats jsonb; total integer; active_n integer; completed_n integer; eliminated_n integer; quit_n integer; online_n integer; avgq numeric;
begin
  perform public.wwm_assert_teacher(p_token);
  select active_session_id,join_code into sid,code from public.wwm_app_settings where singleton=true;
  if sid is null then return jsonb_build_object('active',false,'joinCode',code,'participants','[]'::jsonb,'questions','[]'::jsonb); end if;

  select h.game_id,h.started_at,g.title,g.questions into gid,started,title,qs
  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id
  where h.id=sid and h.status='active';
  if not found then
    update public.wwm_app_settings set active_session_id=null,updated_at=now() where singleton=true;
    return jsonb_build_object('active',false,'joinCode',code,'participants','[]'::jsonb,'questions','[]'::jsonb);
  end if;
  qcount := jsonb_array_length(qs);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.student_name,'class',p.class_name,'status',p.status,
    'questionIndex',p.current_question_index,
    'questionNumber',case when p.status='completed' then qcount else least(p.current_question_index+1,qcount) end,
    'lastAnsweredIndex',p.last_answered_index,'correctCount',p.correct_count,'jokersUsed',p.jokers_used,
    'startedAt',p.started_at,'lastSeen',p.last_seen,'finishedAt',p.finished_at,
    'online',(p.status='active' and p.last_seen > now()-interval '75 seconds')
  ) order by p.class_name,p.student_name),'[]'::jsonb) into people
  from public.wwm_participants p where p.session_id=sid;

  select count(*),
    count(*) filter(where status='active'),
    count(*) filter(where status='completed'),
    count(*) filter(where status='eliminated'),
    count(*) filter(where status='quit'),
    count(*) filter(where status='active' and last_seen > now()-interval '75 seconds'),
    coalesce(round(avg(least(current_question_index+1,qcount))::numeric,1),0)
  into total,active_n,completed_n,eliminated_n,quit_n,online_n,avgq
  from public.wwm_participants where session_id=sid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'index',s.i,'number',s.i+1,'question',qs->s.i->>'question','attempts',s.attempts,
    'correct',s.correct_n,'wrong',s.wrong_n,
    'correctRate',case when s.attempts=0 then null else round(s.correct_n::numeric/s.attempts::numeric*100,1) end
  ) order by s.i),'[]'::jsonb) into qstats
  from (
    select series.i,count(a.id) attempts,
      count(a.id) filter(where a.is_correct) correct_n,
      count(a.id) filter(where not a.is_correct) wrong_n
    from generate_series(0,greatest(qcount-1,0)) series(i)
    left join public.wwm_participant_answers a on a.session_id=sid and a.question_index=series.i
    group by series.i
  ) s;

  return jsonb_build_object(
    'active',true,
    'session',jsonb_build_object('id',sid,'gameId',gid,'title',title,'joinCode',code,'startedAt',started,'questionCount',qcount),
    'summary',jsonb_build_object('total',total,'active',active_n,'completed',completed_n,'eliminated',eliminated_n,'quit',quit_n,'online',online_n,'averageQuestion',avgq),
    'participants',people,'questions',qstats
  );
end;
$$;

create or replace function public.wwm_teacher_session_history(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare result jsonb;
begin
  perform public.wwm_assert_teacher(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',h.id,'gameId',h.game_id,'title',g.title,'status',h.status,'startedAt',h.started_at,'endedAt',h.ended_at,
    'participants',(select count(*) from public.wwm_participants p where p.session_id=h.id)
  ) order by h.started_at desc),'[]'::jsonb) into result
  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id;
  return result;
end;
$$;

-- ============================================================
-- LERNENDEN RPC
-- ============================================================

create or replace function public.wwm_student_preview(p_join_code text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare expected text; sid uuid; gid uuid; title text; qs jsonb;
begin
  select join_code,active_session_id into expected,sid from public.wwm_app_settings where singleton=true;
  if upper(btrim(coalesce(p_join_code,''))) <> expected then raise exception 'Code ist nicht gültig'; end if;
  if sid is null then raise exception 'Momentan ist kein Spiel geöffnet'; end if;
  select h.game_id,g.title,g.questions into gid,title,qs
  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id
  where h.id=sid and h.status='active' and g.archived=false;
  if not found then raise exception 'Momentan ist kein Spiel geöffnet'; end if;
  return jsonb_build_object('sessionId',sid,'gameId',gid,'title',title,'questionCount',jsonb_array_length(qs));
end;
$$;

create or replace function public.wwm_student_join(p_join_code text, p_student_name text, p_class_name text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare preview jsonb; sid uuid; gid uuid; token text; pid uuid; sname text; cname text;
begin
  sname:=btrim(coalesce(p_student_name,'')); cname:=btrim(coalesce(p_class_name,''));
  if sname='' then raise exception 'Bitte Name eingeben'; end if;
  if cname='' then raise exception 'Bitte Klasse eingeben'; end if;
  preview:=public.wwm_student_preview(p_join_code);
  sid:=(preview->>'sessionId')::uuid; gid:=(preview->>'gameId')::uuid;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.wwm_participants(session_id,game_id,student_name,class_name,token_hash)
  values(sid,gid,sname,cname,public.wwm_hash_secret(token)) returning id into pid;
  return jsonb_build_object(
    'participantId',pid,'participantToken',token,'sessionId',sid,'gameId',gid,
    'title',preview->>'title','questionCount',(preview->>'questionCount')::integer,
    'studentName',sname,'className',cname,'currentQuestionIndex',0
  );
end;
$$;

create or replace function public.wwm_student_resume(p_participant_id uuid, p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare p public.wwm_participants; g public.wwm_quiz_games;
begin
  perform public.wwm_assert_participant(p_participant_id,p_token);
  select * into p from public.wwm_participants where id=p_participant_id;
  select * into g from public.wwm_quiz_games where id=p.game_id;
  update public.wwm_participants set last_seen=now() where id=p_participant_id;
  return jsonb_build_object(
    'participantId',p.id,'sessionId',p.session_id,'gameId',p.game_id,'title',g.title,
    'studentName',p.student_name,'className',p.class_name,'status',p.status,
    'currentQuestionIndex',p.current_question_index,'lastAnsweredIndex',p.last_answered_index,
    'correctCount',p.correct_count,'jokersUsed',p.jokers_used,'questionCount',jsonb_array_length(g.questions)
  );
end;
$$;

create or replace function public.wwm_student_get_question(p_participant_id uuid, p_token text, p_question_index integer)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare p public.wwm_participants; qs jsonb; q jsonb; answers jsonb;
begin
  perform public.wwm_assert_participant(p_participant_id,p_token);
  select * into p from public.wwm_participants where id=p_participant_id;
  if p.status<>'active' then raise exception 'Dieses Spiel ist bereits beendet'; end if;
  if p_question_index<>p.current_question_index then raise exception 'Diese Frage ist momentan nicht freigeschaltet'; end if;
  select questions into qs from public.wwm_quiz_games where id=p.game_id;
  if p_question_index<0 or p_question_index>=jsonb_array_length(qs) then raise exception 'Frage existiert nicht'; end if;
  q:=qs->p_question_index;
  select jsonb_agg(jsonb_build_object('key',m.answer_key,'text',m.answer_text) order by m.answer_key) into answers
  from public.wwm_answer_key_map(p_participant_id,p_question_index,q) m;
  update public.wwm_participants set last_seen=now() where id=p_participant_id;
  return jsonb_build_object('index',p_question_index,'id',coalesce(q->>'id',p_question_index::text),'question',q->>'question','answers',answers);
end;
$$;

create or replace function public.wwm_student_submit_answer(
  p_participant_id uuid,p_token text,p_question_index integer,p_selected_key text,p_response_ms integer default null
)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p public.wwm_participants; old public.wwm_participant_answers; qs jsonb; q jsonb; totalq integer;
  skey text; stext text; scorrect boolean; ckey text; ctext text; next_status text; next_index integer;
begin
  perform public.wwm_assert_participant(p_participant_id,p_token);
  skey:=upper(btrim(coalesce(p_selected_key,'')));
  if skey not in ('A','B','C','D') then raise exception 'Ungültige Antwort'; end if;
  select * into p from public.wwm_participants where id=p_participant_id;
  select questions into qs from public.wwm_quiz_games where id=p.game_id;
  totalq:=jsonb_array_length(qs);
  if p_question_index<0 or p_question_index>=totalq then raise exception 'Frage existiert nicht'; end if;
  q:=qs->p_question_index;
  select answer_key,answer_text into ckey,ctext
  from public.wwm_answer_key_map(p_participant_id,p_question_index,q) where is_correct=true;

  select * into old from public.wwm_participant_answers
  where participant_id=p_participant_id and question_index=p_question_index;
  if old.id is not null then
    return jsonb_build_object('correct',old.is_correct,'selectedKey',old.selected_key,'correctKey',ckey,'correctText',ctext,'status',p.status,'nextQuestionIndex',p.current_question_index);
  end if;

  if p.status<>'active' then raise exception 'Dieses Spiel ist bereits beendet'; end if;
  if p_question_index<>p.current_question_index then raise exception 'Diese Frage ist momentan nicht freigeschaltet'; end if;
  select answer_text,is_correct into stext,scorrect
  from public.wwm_answer_key_map(p_participant_id,p_question_index,q) where answer_key=skey;
  if stext is null then raise exception 'Antwort existiert nicht'; end if;

  insert into public.wwm_participant_answers(participant_id,session_id,game_id,question_index,selected_key,selected_text,is_correct,response_ms)
  values(p_participant_id,p.session_id,p.game_id,p_question_index,skey,stext,scorrect,case when p_response_ms>=0 then p_response_ms else null end);

  if scorrect then
    if p_question_index>=totalq-1 then
      update public.wwm_participants set status='completed',last_answered_index=p_question_index,correct_count=correct_count+1,last_seen=now(),finished_at=now() where id=p_participant_id;
      next_status:='completed'; next_index:=p_question_index;
    else
      update public.wwm_participants set current_question_index=p_question_index+1,last_answered_index=p_question_index,correct_count=correct_count+1,last_seen=now() where id=p_participant_id;
      next_status:='active'; next_index:=p_question_index+1;
    end if;
  else
    update public.wwm_participants set status='eliminated',last_answered_index=p_question_index,last_seen=now(),finished_at=now() where id=p_participant_id;
    next_status:='eliminated'; next_index:=p_question_index;
  end if;

  return jsonb_build_object('correct',scorrect,'selectedKey',skey,'correctKey',ckey,'correctText',ctext,'status',next_status,'nextQuestionIndex',next_index);
end;
$$;

create or replace function public.wwm_student_use_joker(p_participant_id uuid,p_token text,p_joker_type text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p public.wwm_participants; typ text; qs jsonb; q jsonb; ckey text; wrong_keys text[]; result jsonb;
  cp integer; rem integer; a integer; b integer; c integer; total integer; p1 integer; p2 integer; p3 integer;
  guess text; reliability numeric;
begin
  perform public.wwm_assert_participant(p_participant_id,p_token);
  typ:=lower(btrim(coalesce(p_joker_type,'')));
  if typ not in ('fifty','audience','phone','teacher') then raise exception 'Unbekannter Joker'; end if;
  select * into p from public.wwm_participants where id=p_participant_id;
  if p.status<>'active' then raise exception 'Spiel ist bereits beendet'; end if;
  if coalesce((p.jokers_used->>typ)::boolean,false) then
    result:=p.joker_results->typ;
    if result is not null then return result; end if;
    raise exception 'Joker wurde bereits verwendet';
  end if;
  select questions into qs from public.wwm_quiz_games where id=p.game_id;
  q:=qs->p.current_question_index;
  select answer_key into ckey from public.wwm_answer_key_map(p_participant_id,p.current_question_index,q) where is_correct=true;
  select array_agg(answer_key order by md5(p_participant_id::text||':'||p.current_question_index::text||':'||typ||':'||answer_key)) into wrong_keys
  from public.wwm_answer_key_map(p_participant_id,p.current_question_index,q) where is_correct=false;

  if typ='fifty' then
    result:=jsonb_build_object('type','fifty','removedKeys',jsonb_build_array(wrong_keys[1],wrong_keys[2]));
  elsif typ='audience' then
    cp:=greatest(34,least(82,72-(p.current_question_index*2)+floor(random()*9)::integer-4));
    rem:=100-cp; a:=20+floor(random()*80)::integer; b:=20+floor(random()*80)::integer; c:=20+floor(random()*80)::integer; total:=a+b+c;
    p1:=round(rem::numeric*a/total)::integer; p2:=round(rem::numeric*b/total)::integer; p3:=rem-p1-p2;
    result:=jsonb_build_object('type','audience','percentages',jsonb_build_object(ckey,cp,wrong_keys[1],p1,wrong_keys[2],p2,wrong_keys[3],p3));
  elsif typ='phone' then
    reliability:=greatest(.52,.88-(p.current_question_index*.022));
    if random()<=reliability then guess:=ckey; else guess:=wrong_keys[1+floor(random()*3)::integer]; end if;
    result:=jsonb_build_object('type','phone','guessKey',guess,'confidence',55+floor(random()*36)::integer);
  else
    result:=jsonb_build_object('type','teacher','message','Bitte die Lehrperson um einen Hinweis.');
  end if;

  update public.wwm_participants set
    jokers_used=jsonb_set(jokers_used,array[typ],'true'::jsonb,true),
    joker_results=jsonb_set(joker_results,array[typ],result,true),
    last_seen=now()
  where id=p_participant_id;
  return result;
end;
$$;

create or replace function public.wwm_student_heartbeat(p_participant_id uuid,p_token text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public.wwm_assert_participant(p_participant_id,p_token);
  update public.wwm_participants set last_seen=now() where id=p_participant_id;
  return true;
end;
$$;

create or replace function public.wwm_student_quit(p_participant_id uuid,p_token text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public.wwm_assert_participant(p_participant_id,p_token);
  update public.wwm_participants set
    status=case when status='active' then 'quit' else status end,
    finished_at=case when status='active' then now() else finished_at end,
    last_seen=now()
  where id=p_participant_id;
  return true;
end;
$$;

-- ============================================================
-- RECHTE
-- ============================================================

revoke all on function public.wwm_hash_secret(text) from public,anon,authenticated;
revoke all on function public.wwm_assert_teacher(text) from public,anon,authenticated;
revoke all on function public.wwm_assert_participant(uuid,text) from public,anon,authenticated;
revoke all on function public.wwm_validate_questions(jsonb) from public,anon,authenticated;
revoke all on function public.wwm_answer_key_map(uuid,integer,jsonb) from public,anon,authenticated;

revoke all on function public.wwm_teacher_login(text) from public;
revoke all on function public.wwm_teacher_logout(text) from public;
revoke all on function public.wwm_teacher_get_settings(text) from public;
revoke all on function public.wwm_teacher_games_list(text) from public;
revoke all on function public.wwm_teacher_game_save(text,jsonb) from public;
revoke all on function public.wwm_teacher_game_delete(text,uuid) from public;
revoke all on function public.wwm_teacher_host_game(text,uuid) from public;
revoke all on function public.wwm_teacher_stop_host(text) from public;
revoke all on function public.wwm_teacher_dashboard(text) from public;
revoke all on function public.wwm_teacher_session_history(text) from public;
revoke all on function public.wwm_student_preview(text) from public;
revoke all on function public.wwm_student_join(text,text,text) from public;
revoke all on function public.wwm_student_resume(uuid,text) from public;
revoke all on function public.wwm_student_get_question(uuid,text,integer) from public;
revoke all on function public.wwm_student_submit_answer(uuid,text,integer,text,integer) from public;
revoke all on function public.wwm_student_use_joker(uuid,text,text) from public;
revoke all on function public.wwm_student_heartbeat(uuid,text) from public;
revoke all on function public.wwm_student_quit(uuid,text) from public;

grant execute on function public.wwm_teacher_login(text) to anon,authenticated;
grant execute on function public.wwm_teacher_logout(text) to anon,authenticated;
grant execute on function public.wwm_teacher_get_settings(text) to anon,authenticated;
grant execute on function public.wwm_teacher_games_list(text) to anon,authenticated;
grant execute on function public.wwm_teacher_game_save(text,jsonb) to anon,authenticated;
grant execute on function public.wwm_teacher_game_delete(text,uuid) to anon,authenticated;
grant execute on function public.wwm_teacher_host_game(text,uuid) to anon,authenticated;
grant execute on function public.wwm_teacher_stop_host(text) to anon,authenticated;
grant execute on function public.wwm_teacher_dashboard(text) to anon,authenticated;
grant execute on function public.wwm_teacher_session_history(text) to anon,authenticated;
grant execute on function public.wwm_student_preview(text) to anon,authenticated;
grant execute on function public.wwm_student_join(text,text,text) to anon,authenticated;
grant execute on function public.wwm_student_resume(uuid,text) to anon,authenticated;
grant execute on function public.wwm_student_get_question(uuid,text,integer) to anon,authenticated;
grant execute on function public.wwm_student_submit_answer(uuid,text,integer,text,integer) to anon,authenticated;
grant execute on function public.wwm_student_use_joker(uuid,text,text) to anon,authenticated;
grant execute on function public.wwm_student_heartbeat(uuid,text) to anon,authenticated;
grant execute on function public.wwm_student_quit(uuid,text) to anon,authenticated;
