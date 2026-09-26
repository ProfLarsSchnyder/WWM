-- WWM: dauerhafte individuelle Spielcodes pro Spiel
-- Einmal im Supabase SQL Editor ausführen.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.wwm_quiz_games add column if not exists join_code text;

create or replace function public.wwm_generate_game_code()
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare c text;
begin
  loop
    c := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (select 1 from public.wwm_quiz_games where join_code = c);
  end loop;
  return c;
end;
$$;

do $$
declare r record; c text;
begin
  for r in select id from public.wwm_quiz_games where join_code is null or btrim(join_code)='' loop
    c := public.wwm_generate_game_code();
    update public.wwm_quiz_games set join_code=c where id=r.id;
  end loop;
end;
$$;

create unique index if not exists idx_wwm_quiz_games_join_code on public.wwm_quiz_games(join_code);
alter table public.wwm_quiz_games alter column join_code set not null;

-- Alte aktive Hosting-Sessions werden zu normalen dauerhaften Spiel-Sessions.
-- Pro Spiel bleibt genau eine aktive Session bestehen.
update public.wwm_host_sessions set status='closed', ended_at=coalesce(ended_at,now()) where status='active';
insert into public.wwm_host_sessions(game_id,status)
select id,'active' from public.wwm_quiz_games where archived=false;
update public.wwm_app_settings set active_session_id=null,updated_at=now() where singleton=true;

create or replace function public.wwm_teacher_games_list(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare result jsonb;
begin
  perform public.wwm_assert_teacher(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title',title,'joinCode',join_code,'questions',questions,'createdAt',created_at,'updatedAt',updated_at
  ) order by updated_at desc),'[]'::jsonb) into result
  from public.wwm_quiz_games where archived=false;
  return result;
end;
$$;

create or replace function public.wwm_teacher_game_save(p_token text, p_game jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid; v_title text; v_questions jsonb; v_created timestamptz; v_code text; r public.wwm_quiz_games;
begin
  perform public.wwm_assert_teacher(p_token);
  v_title := btrim(coalesce(p_game->>'title',''));
  if v_title = '' then raise exception 'Das Spiel braucht einen Titel'; end if;
  v_questions := coalesce(p_game->'questions','[]'::jsonb);
  perform public.wwm_validate_questions(v_questions);
  begin v_id := nullif(p_game->>'id','')::uuid; exception when others then v_id := null; end;
  if v_id is null then v_id := extensions.gen_random_uuid(); end if;
  begin v_created := coalesce(nullif(p_game->>'createdAt','')::timestamptz, now()); exception when others then v_created := now(); end;
  select join_code into v_code from public.wwm_quiz_games where id=v_id;
  if v_code is null then v_code := public.wwm_generate_game_code(); end if;
  insert into public.wwm_quiz_games as g(id,title,join_code,questions,archived,created_at,updated_at)
  values(v_id,v_title,v_code,v_questions,false,v_created,now())
  on conflict(id) do update set title=excluded.title, questions=excluded.questions, archived=false, updated_at=now()
  returning * into r;
  return jsonb_build_object('id',r.id,'title',r.title,'joinCode',r.join_code,'questions',r.questions,'createdAt',r.created_at,'updatedAt',r.updated_at);
end;
$$;

create or replace function public.wwm_student_preview(p_join_code text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare sid uuid; gid uuid; title text; qs jsonb; code text;
begin
  code := upper(btrim(coalesce(p_join_code,'')));
  select id,title,questions into gid,title,qs
  from public.wwm_quiz_games
  where join_code=code and archived=false;
  if not found then raise exception 'Code ist nicht gültig'; end if;

  select id into sid from public.wwm_host_sessions
  where game_id=gid and status='active'
  order by started_at desc limit 1;
  if sid is null then
    insert into public.wwm_host_sessions(game_id,status) values(gid,'active') returning id into sid;
  end if;

  return jsonb_build_object('sessionId',sid,'gameId',gid,'title',title,'joinCode',code,'questionCount',jsonb_array_length(qs));
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
  update public.wwm_app_settings set active_session_id=sid,updated_at=now() where singleton=true;
  return jsonb_build_object(
    'participantId',pid,'participantToken',token,'sessionId',sid,'gameId',gid,
    'title',preview->>'title','questionCount',(preview->>'questionCount')::integer,
    'studentName',sname,'className',cname,'currentQuestionIndex',0
  );
end;
$$;

-- Dashboard zeigt automatisch das Spiel, dem zuletzt jemand beigetreten ist.
create or replace function public.wwm_teacher_dashboard(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  sid uuid; code text; gid uuid; title text; qs jsonb; started timestamptz; qcount integer;
  people jsonb; qstats jsonb; total integer; active_n integer; completed_n integer; eliminated_n integer; quit_n integer; online_n integer; avgq numeric;
begin
  perform public.wwm_assert_teacher(p_token);
  select active_session_id into sid from public.wwm_app_settings where singleton=true;
  if sid is null then return jsonb_build_object('active',false,'participants','[]'::jsonb,'questions','[]'::jsonb); end if;

  select h.game_id,h.started_at,g.title,g.questions,g.join_code into gid,started,title,qs,code
  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id
  where h.id=sid and h.status='active';
  if not found then
    update public.wwm_app_settings set active_session_id=null,updated_at=now() where singleton=true;
    return jsonb_build_object('active',false,'participants','[]'::jsonb,'questions','[]'::jsonb);
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

revoke all on function public.wwm_generate_game_code() from public,anon,authenticated;
grant execute on function public.wwm_teacher_games_list(text) to anon,authenticated;
grant execute on function public.wwm_teacher_game_save(text,jsonb) to anon,authenticated;
grant execute on function public.wwm_student_preview(text) to anon,authenticated;
grant execute on function public.wwm_student_join(text,text,text) to anon,authenticated;
grant execute on function public.wwm_teacher_dashboard(text) to anon,authenticated;
