-- Run this once in the Supabase SQL editor to update the live phone joker behaviour.

create or replace function public.wwm_student_use_joker(p_participant_id uuid,p_token text,p_joker_type text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p public.wwm_participants; typ text; qs jsonb; q jsonb; ckey text; wrong_keys text[]; result jsonb;
  cp integer; rem integer; a integer; b integer; c integer; total integer; p1 integer; p2 integer; p3 integer;
  guess text; reliability numeric; roll numeric; uncertainty numeric; unknown_chance numeric; second_key text;
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
    -- Exact phone joker strength by money level. "uncertainty" stores the
    -- probability of a certain correct answer for backwards-compatible declarations.
    uncertainty:=case p.current_question_index
      when 0 then 1.00 when 1 then .96 when 2 then .92 when 3 then .88 when 4 then .84
      when 5 then .80 when 6 then .75 when 7 then .70 when 8 then .65 when 9 then .58
      when 10 then .50 when 11 then .43 when 12 then .36 when 13 then .28 else .22 end;
    unknown_chance:=case p.current_question_index
      when 0 then 0.00 when 1 then 0.00 when 2 then .01 when 3 then .02 when 4 then .04
      when 5 then .05 when 6 then .07 when 7 then .08 when 8 then .10 when 9 then .14
      when 10 then .18 when 11 then .22 when 12 then .26 when 13 then .32 else .38 end;
    roll:=random();
    if roll < uncertainty then
      result:=jsonb_build_object('type','phone','outcome','certain','guessKey',ckey);
    elsif roll < (1-unknown_chance) then
      second_key:=wrong_keys[1+floor(random()*3)::integer];
      if random()<.5 then
        result:=jsonb_build_object('type','phone','outcome','between','keys',jsonb_build_array(ckey,second_key));
      else
        result:=jsonb_build_object('type','phone','outcome','between','keys',jsonb_build_array(second_key,ckey));
      end if;
    else
      result:=jsonb_build_object('type','phone','outcome','unknown');
    end if;
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

