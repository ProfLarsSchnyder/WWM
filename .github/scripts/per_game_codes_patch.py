from pathlib import Path

# ---------------- app-v3.js ----------------
p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')
t = t.replace(
"  teacherGamesList, teacherGameSave, teacherGameDelete, teacherHostGame,\n  teacherStopHost, teacherDashboard, teacherSessionHistory,",
"  teacherGamesList, teacherGameSave, teacherGameDelete,\n  teacherStopHost, teacherDashboard, teacherSessionHistory,"
)
t = t.replace(
"  if (action === 'game-host') {\n    const game = gameById(button.dataset.id);\n    if (game) await hostGame(game);\n  }",
"  if (action === 'game-code') {\n    const game = gameById(button.dataset.id);\n    if (game) showGameCode(game);\n  }"
)
t = t.replace(
"        <button class=\"btn\" data-action=\"game-host\" data-id=\"${game.id}\">Für Lernende hosten</button>",
"        <button class=\"btn\" data-action=\"game-code\" data-id=\"${game.id}\">Code anzeigen</button>"
)
t = t.replace(
"      <div class=\"game-card-meta\">${questionCount} Fragen · geändert ${formatDate(game.updatedAt)}</div>",
"      <div class=\"game-card-meta\">${questionCount} Fragen · Code ${escapeHtml(game.joinCode || '------')} · geändert ${formatDate(game.updatedAt)}</div>"
)
old_host = '''async function hostGame(game) {
  const result = await teacherHostGame(game.id);
  $('#host-game-name').textContent = result.title || game.title;
  $('#host-title').textContent = result.title || game.title;
  $('#host-join-code').textContent = result.joinCode || '------';
  showScreen('host');
  await refreshDashboard();
  startDashboardPolling();
}
'''
new_host = '''function showGameCode(game) {
  const code = game.joinCode || '------';
  modal(`
    <div class="code-presenter-modal">
      <div class="code-presenter-label">Spielcode</div>
      <div class="code-presenter-code">${escapeHtml(code)}</div>
      <div class="code-presenter-title">${escapeHtml(game.title || 'Spiel')}</div>
      <div class="code-presenter-hint">Dieser Code bleibt dauerhaft gültig. Lernende können das Spiel jederzeit im Lernendenmodus starten.</div>
      <div class="modal-actions">
        <button class="btn" data-action="fullscreen">Vollbild</button>
        <button class="btn primary" data-modal="close">Schliessen</button>
      </div>
    </div>`, false, true);
}
'''
if old_host not in t:
    raise SystemExit('hostGame block not found')
t = t.replace(old_host, new_host, 1)
t = t.replace("      <h3>Kein Spiel wird gehostet</h3>\n      <p>Starte bei einem gespeicherten Spiel «Für Lernende hosten».</p>", "      <h3>Noch keine Lernenden aktiv</h3>\n      <p>Sobald jemand eines der Spiele über seinen dauerhaften Code startet, erscheint die Aktivität hier.</p>")
t = t.replace("    toast('Momentan wird kein Spiel gehostet.');", "    toast('Momentan ist noch keine Spielaktivität vorhanden.');")
t = t.replace("  $('#host-game-name').textContent = session.title || 'Gehostetes Spiel';", "  $('#host-game-name').textContent = session.title || 'Spielanalyse';")
p.write_text(t, encoding='utf-8')

# ---------------- index.html ----------------
p = Path('index.html')
t = p.read_text(encoding='utf-8')
t = t.replace('Spiele erstellen, am Beamer spielen, für Klassen hosten und Lernstände analysieren.', 'Spiele erstellen, am Beamer spielen, Codes anzeigen und Lernstände analysieren.')
t = t.replace('Beamer, Hosting, Bearbeiten, Duplizieren und Löschen.', 'Beamer, Spielcode, Bearbeiten, Duplizieren und Löschen.')
t = t.replace('<button class="btn danger-btn" data-action="host-stop">Hosting beenden</button>\n            ', '')
t = t.replace('Gehostetes Spiel', 'Spielanalyse')
t = t.replace('Lernende wählen auf der Startseite den Lernendenmodus und geben diesen Code zusammen mit Name und Klasse ein.', 'Lernende wählen auf der Startseite den Lernendenmodus und geben den dauerhaften Code des gewünschten Spiels zusammen mit Name und Klasse ein.')
t = t.replace('js/app-v3.js?v=20260926-phone3', 'js/app-v3.js?v=20260926-codes1')
p.write_text(t, encoding='utf-8')

# ---------------- schema.sql ----------------
p = Path('supabase/schema.sql')
s = p.read_text(encoding='utf-8')

s = s.replace(
"  title text not null,\n  questions jsonb not null default '[]'::jsonb,",
"  title text not null,\n  join_code text unique,\n  questions jsonb not null default '[]'::jsonb,",
1)

helper_anchor = "create or replace function public.wwm_hash_secret(p_secret text)"
helper = '''create or replace function public.wwm_generate_game_code()
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

'''
if helper not in s:
    s = s.replace(helper_anchor, helper + helper_anchor, 1)

s = s.replace(
"    'id',id,'title',title,'questions',questions,'createdAt',created_at,'updatedAt',updated_at",
"    'id',id,'title',title,'joinCode',join_code,'questions',questions,'createdAt',created_at,'updatedAt',updated_at",
1)

old_save_decl = "declare v_id uuid; v_title text; v_questions jsonb; v_created timestamptz; r public.wwm_quiz_games;"
new_save_decl = "declare v_id uuid; v_title text; v_questions jsonb; v_created timestamptz; v_code text; r public.wwm_quiz_games;"
s = s.replace(old_save_decl, new_save_decl, 1)
old_save_insert = '''  insert into public.wwm_quiz_games as g(id,title,questions,archived,created_at,updated_at)
  values(v_id,v_title,v_questions,false,v_created,now())
  on conflict(id) do update set title=excluded.title, questions=excluded.questions, archived=false, updated_at=now()
  returning * into r;
  return jsonb_build_object('id',r.id,'title',r.title,'questions',r.questions,'createdAt',r.created_at,'updatedAt',r.updated_at);'''
new_save_insert = '''  select join_code into v_code from public.wwm_quiz_games where id=v_id;
  if v_code is null then v_code := public.wwm_generate_game_code(); end if;
  insert into public.wwm_quiz_games as g(id,title,join_code,questions,archived,created_at,updated_at)
  values(v_id,v_title,v_code,v_questions,false,v_created,now())
  on conflict(id) do update set title=excluded.title, questions=excluded.questions, archived=false, updated_at=now()
  returning * into r;
  return jsonb_build_object('id',r.id,'title',r.title,'joinCode',r.join_code,'questions',r.questions,'createdAt',r.created_at,'updatedAt',r.updated_at);'''
if old_save_insert not in s:
    raise SystemExit('schema save block not found')
s = s.replace(old_save_insert, new_save_insert, 1)

old_preview = '''create or replace function public.wwm_student_preview(p_join_code text)
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
$$;'''
new_preview = '''create or replace function public.wwm_student_preview(p_join_code text)
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
$$;'''
if old_preview not in s:
    raise SystemExit('schema preview block not found')
s = s.replace(old_preview, new_preview, 1)

old_join_tail = '''  insert into public.wwm_participants(session_id,game_id,student_name,class_name,token_hash)
  values(sid,gid,sname,cname,public.wwm_hash_secret(token)) returning id into pid;
  return jsonb_build_object('''
new_join_tail = '''  insert into public.wwm_participants(session_id,game_id,student_name,class_name,token_hash)
  values(sid,gid,sname,cname,public.wwm_hash_secret(token)) returning id into pid;
  update public.wwm_app_settings set active_session_id=sid,updated_at=now() where singleton=true;
  return jsonb_build_object('''
if old_join_tail not in s:
    raise SystemExit('schema join insert block not found')
s = s.replace(old_join_tail, new_join_tail, 1)

s = s.replace(
"  select h.game_id,h.started_at,g.title,g.questions into gid,started,title,qs\n  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id",
"  select h.game_id,h.started_at,g.title,g.questions,g.join_code into gid,started,title,qs,code\n  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id",
1)

revoke_anchor = "revoke all on function public.wwm_hash_secret(text) from public,anon,authenticated;"
if "revoke all on function public.wwm_generate_game_code()" not in s:
    s = s.replace(revoke_anchor, "revoke all on function public.wwm_generate_game_code() from public,anon,authenticated;\n" + revoke_anchor, 1)

p.write_text(s, encoding='utf-8')

# ---------------- migration for existing Supabase ----------------
migration = '''-- WWM: dauerhafte individuelle Spielcodes pro Spiel\n-- Einmal im Supabase SQL Editor ausführen.\n\ncreate schema if not exists extensions;\ncreate extension if not exists pgcrypto with schema extensions;\n\nalter table public.wwm_quiz_games add column if not exists join_code text;\n\ncreate or replace function public.wwm_generate_game_code()\nreturns text language plpgsql security definer\nset search_path = public, extensions\nas $$\ndeclare c text;\nbegin\n  loop\n    c := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));\n    exit when not exists (select 1 from public.wwm_quiz_games where join_code = c);\n  end loop;\n  return c;\nend;\n$$;\n\ndo $$\ndeclare r record; c text;\nbegin\n  for r in select id from public.wwm_quiz_games where join_code is null or btrim(join_code)='' loop\n    c := public.wwm_generate_game_code();\n    update public.wwm_quiz_games set join_code=c where id=r.id;\n  end loop;\nend;\n$$;\n\ncreate unique index if not exists idx_wwm_quiz_games_join_code on public.wwm_quiz_games(join_code);\nalter table public.wwm_quiz_games alter column join_code set not null;\n\n-- Alte aktive Hosting-Sessions werden zu normalen dauerhaften Spiel-Sessions.\n-- Pro Spiel bleibt genau eine aktive Session bestehen.\nupdate public.wwm_host_sessions set status='closed', ended_at=coalesce(ended_at,now()) where status='active';\ninsert into public.wwm_host_sessions(game_id,status)\nselect id,'active' from public.wwm_quiz_games where archived=false;\nupdate public.wwm_app_settings set active_session_id=null,updated_at=now() where singleton=true;\n\ncreate or replace function public.wwm_teacher_games_list(p_token text)\nreturns jsonb language plpgsql security definer\nset search_path = public, extensions\nas $$\ndeclare result jsonb;\nbegin\n  perform public.wwm_assert_teacher(p_token);\n  select coalesce(jsonb_agg(jsonb_build_object(\n    'id',id,'title',title,'joinCode',join_code,'questions',questions,'createdAt',created_at,'updatedAt',updated_at\n  ) order by updated_at desc),'[]'::jsonb) into result\n  from public.wwm_quiz_games where archived=false;\n  return result;\nend;\n$$;\n\ncreate or replace function public.wwm_teacher_game_save(p_token text, p_game jsonb)\nreturns jsonb language plpgsql security definer\nset search_path = public, extensions\nas $$\ndeclare v_id uuid; v_title text; v_questions jsonb; v_created timestamptz; v_code text; r public.wwm_quiz_games;\nbegin\n  perform public.wwm_assert_teacher(p_token);\n  v_title := btrim(coalesce(p_game->>'title',''));\n  if v_title = '' then raise exception 'Das Spiel braucht einen Titel'; end if;\n  v_questions := coalesce(p_game->'questions','[]'::jsonb);\n  perform public.wwm_validate_questions(v_questions);\n  begin v_id := nullif(p_game->>'id','')::uuid; exception when others then v_id := null; end;\n  if v_id is null then v_id := extensions.gen_random_uuid(); end if;\n  begin v_created := coalesce(nullif(p_game->>'createdAt','')::timestamptz, now()); exception when others then v_created := now(); end;\n  select join_code into v_code from public.wwm_quiz_games where id=v_id;\n  if v_code is null then v_code := public.wwm_generate_game_code(); end if;\n  insert into public.wwm_quiz_games as g(id,title,join_code,questions,archived,created_at,updated_at)\n  values(v_id,v_title,v_code,v_questions,false,v_created,now())\n  on conflict(id) do update set title=excluded.title, questions=excluded.questions, archived=false, updated_at=now()\n  returning * into r;\n  return jsonb_build_object('id',r.id,'title',r.title,'joinCode',r.join_code,'questions',r.questions,'createdAt',r.created_at,'updatedAt',r.updated_at);\nend;\n$$;\n\ncreate or replace function public.wwm_student_preview(p_join_code text)\nreturns jsonb language plpgsql security definer\nset search_path = public, extensions\nas $$\ndeclare sid uuid; gid uuid; title text; qs jsonb; code text;\nbegin\n  code := upper(btrim(coalesce(p_join_code,'')));\n  select id,title,questions into gid,title,qs\n  from public.wwm_quiz_games\n  where join_code=code and archived=false;\n  if not found then raise exception 'Code ist nicht gültig'; end if;\n\n  select id into sid from public.wwm_host_sessions\n  where game_id=gid and status='active'\n  order by started_at desc limit 1;\n  if sid is null then\n    insert into public.wwm_host_sessions(game_id,status) values(gid,'active') returning id into sid;\n  end if;\n\n  return jsonb_build_object('sessionId',sid,'gameId',gid,'title',title,'joinCode',code,'questionCount',jsonb_array_length(qs));\nend;\n$$;\n\ncreate or replace function public.wwm_student_join(p_join_code text, p_student_name text, p_class_name text)\nreturns jsonb language plpgsql security definer\nset search_path = public, extensions\nas $$\ndeclare preview jsonb; sid uuid; gid uuid; token text; pid uuid; sname text; cname text;\nbegin\n  sname:=btrim(coalesce(p_student_name,'')); cname:=btrim(coalesce(p_class_name,''));\n  if sname='' then raise exception 'Bitte Name eingeben'; end if;\n  if cname='' then raise exception 'Bitte Klasse eingeben'; end if;\n  preview:=public.wwm_student_preview(p_join_code);\n  sid:=(preview->>'sessionId')::uuid; gid:=(preview->>'gameId')::uuid;\n  token:=encode(extensions.gen_random_bytes(32),'hex');\n  insert into public.wwm_participants(session_id,game_id,student_name,class_name,token_hash)\n  values(sid,gid,sname,cname,public.wwm_hash_secret(token)) returning id into pid;\n  update public.wwm_app_settings set active_session_id=sid,updated_at=now() where singleton=true;\n  return jsonb_build_object(\n    'participantId',pid,'participantToken',token,'sessionId',sid,'gameId',gid,\n    'title',preview->>'title','questionCount',(preview->>'questionCount')::integer,\n    'studentName',sname,'className',cname,'currentQuestionIndex',0\n  );\nend;\n$$;\n\n-- Dashboard zeigt automatisch das Spiel, dem zuletzt jemand beigetreten ist.\ncreate or replace function public.wwm_teacher_dashboard(p_token text)\nreturns jsonb language plpgsql security definer\nset search_path = public, extensions\nas $$\ndeclare\n  sid uuid; code text; gid uuid; title text; qs jsonb; started timestamptz; qcount integer;\n  people jsonb; qstats jsonb; total integer; active_n integer; completed_n integer; eliminated_n integer; quit_n integer; online_n integer; avgq numeric;\nbegin\n  perform public.wwm_assert_teacher(p_token);\n  select active_session_id into sid from public.wwm_app_settings where singleton=true;\n  if sid is null then return jsonb_build_object('active',false,'participants','[]'::jsonb,'questions','[]'::jsonb); end if;\n\n  select h.game_id,h.started_at,g.title,g.questions,g.join_code into gid,started,title,qs,code\n  from public.wwm_host_sessions h join public.wwm_quiz_games g on g.id=h.game_id\n  where h.id=sid and h.status='active';\n  if not found then\n    update public.wwm_app_settings set active_session_id=null,updated_at=now() where singleton=true;\n    return jsonb_build_object('active',false,'participants','[]'::jsonb,'questions','[]'::jsonb);\n  end if;\n  qcount := jsonb_array_length(qs);\n\n  select coalesce(jsonb_agg(jsonb_build_object(\n    'id',p.id,'name',p.student_name,'class',p.class_name,'status',p.status,\n    'questionIndex',p.current_question_index,\n    'questionNumber',case when p.status='completed' then qcount else least(p.current_question_index+1,qcount) end,\n    'lastAnsweredIndex',p.last_answered_index,'correctCount',p.correct_count,'jokersUsed',p.jokers_used,\n    'startedAt',p.started_at,'lastSeen',p.last_seen,'finishedAt',p.finished_at,\n    'online',(p.status='active' and p.last_seen > now()-interval '75 seconds')\n  ) order by p.class_name,p.student_name),'[]'::jsonb) into people\n  from public.wwm_participants p where p.session_id=sid;\n\n  select count(*),\n    count(*) filter(where status='active'),\n    count(*) filter(where status='completed'),\n    count(*) filter(where status='eliminated'),\n    count(*) filter(where status='quit'),\n    count(*) filter(where status='active' and last_seen > now()-interval '75 seconds'),\n    coalesce(round(avg(least(current_question_index+1,qcount))::numeric,1),0)\n  into total,active_n,completed_n,eliminated_n,quit_n,online_n,avgq\n  from public.wwm_participants where session_id=sid;\n\n  select coalesce(jsonb_agg(jsonb_build_object(\n    'index',s.i,'number',s.i+1,'question',qs->s.i->>'question','attempts',s.attempts,\n    'correct',s.correct_n,'wrong',s.wrong_n,\n    'correctRate',case when s.attempts=0 then null else round(s.correct_n::numeric/s.attempts::numeric*100,1) end\n  ) order by s.i),'[]'::jsonb) into qstats\n  from (\n    select series.i,count(a.id) attempts,\n      count(a.id) filter(where a.is_correct) correct_n,\n      count(a.id) filter(where not a.is_correct) wrong_n\n    from generate_series(0,greatest(qcount-1,0)) series(i)\n    left join public.wwm_participant_answers a on a.session_id=sid and a.question_index=series.i\n    group by series.i\n  ) s;\n\n  return jsonb_build_object(\n    'active',true,\n    'session',jsonb_build_object('id',sid,'gameId',gid,'title',title,'joinCode',code,'startedAt',started,'questionCount',qcount),\n    'summary',jsonb_build_object('total',total,'active',active_n,'completed',completed_n,'eliminated',eliminated_n,'quit',quit_n,'online',online_n,'averageQuestion',avgq),\n    'participants',people,'questions',qstats\n  );\nend;\n$$;\n\nrevoke all on function public.wwm_generate_game_code() from public,anon,authenticated;\ngrant execute on function public.wwm_teacher_games_list(text) to anon,authenticated;\ngrant execute on function public.wwm_teacher_game_save(text,jsonb) to anon,authenticated;\ngrant execute on function public.wwm_student_preview(text) to anon,authenticated;\ngrant execute on function public.wwm_student_join(text,text,text) to anon,authenticated;\ngrant execute on function public.wwm_teacher_dashboard(text) to anon,authenticated;\n'''
Path('supabase/per-game-codes-update.sql').write_text(migration, encoding='utf-8')
