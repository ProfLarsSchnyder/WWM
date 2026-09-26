from pathlib import Path

app_path = Path('js/app-v3.js')
text = app_path.read_text(encoding='utf-8')

old = "else if (state.play.index === 9) cue = 'safe2';"
new = "else if (state.play.index === 9) cue = 'safe1';"
if old not in text:
    raise SystemExit('16000 sound mapping not found')
text = text.replace(old, new, 1)

old = """function localPhoneResult() {
  const correct = state.play.answers.find(answer => answer.correct);
  const wrong = state.play.answers.filter(answer => !answer.correct);
  const reliability = Math.max(.52, .88 - state.play.index * .022);
  const guess = Math.random() < reliability ? correct : wrong[Math.floor(Math.random() * wrong.length)];
  return { type:'phone', guessKey: guess.key, confidence: 55 + Math.floor(Math.random() * 36) };
}
"""
new = """function phoneOutcomeProbabilities(index) {
  const uncertainty = Math.min(.70, .18 + index * .035);
  const unknown = Math.min(.30, .03 + index * .018);
  return {
    certain: 1 - uncertainty,
    between: uncertainty - unknown,
    unknown
  };
}

function localPhoneResult() {
  const correct = state.play.answers.find(answer => answer.correct);
  const activeAnswers = state.play.answers.filter(answer => !document.querySelector(`.answer[data-key=\"${answer.key}\"]`)?.classList.contains('removed'));
  const wrong = activeAnswers.filter(answer => !answer.correct);
  const probabilities = phoneOutcomeProbabilities(state.play.index);
  const roll = Math.random();

  if (roll < probabilities.certain || !wrong.length) {
    return { type:'phone', outcome:'certain', guessKey: correct.key };
  }

  if (roll < probabilities.certain + probabilities.between) {
    const other = wrong[Math.floor(Math.random() * wrong.length)].key;
    const keys = Math.random() < .5 ? [correct.key, other] : [other, correct.key];
    return { type:'phone', outcome:'between', keys };
  }

  return { type:'phone', outcome:'unknown' };
}
"""
if old not in text:
    raise SystemExit('localPhoneResult block not found')
text = text.replace(old, new, 1)

old = """  modal(`
    <div class=\"joker-result-pop\">
      <div class=\"phase-icon\">☎</div>
      <h3>Der Tipp</h3>
      <div class=\"phone-process final-phone-tip\">«Ich würde <strong>${escapeHtml(String(result.guessKey || '').toUpperCase())}</strong> nehmen. Ich bin ungefähr zu <strong>${Number(result.confidence || 0)}%</strong> sicher.»</div>
      <div class=\"modal-actions\"><button class=\"btn primary\" data-modal=\"close-joker\">Zurück zur Frage</button></div>
    </div>`, true);
"""
new = """  let phoneText;
  if (result.outcome === 'between' && Array.isArray(result.keys) && result.keys.length >= 2) {
    phoneText = `«Ich schwanke zwischen <strong>${escapeHtml(String(result.keys[0]).toUpperCase())}</strong> und <strong>${escapeHtml(String(result.keys[1]).toUpperCase())}</strong>. Mehr kann ich leider nicht eingrenzen.»`;
  } else if (result.outcome === 'unknown') {
    phoneText = '«Tut mir leid, ich weiss es wirklich nicht. Ich möchte dich hier nicht in die falsche Richtung schicken.»';
  } else {
    phoneText = `«Ich bin mir sicher: Die richtige Antwort ist <strong>${escapeHtml(String(result.guessKey || '').toUpperCase())}</strong>.»`;
  }

  modal(`
    <div class=\"joker-result-pop\">
      <div class=\"phase-icon\">☎</div>
      <h3>Der Tipp</h3>
      <div class=\"phone-process final-phone-tip\">${phoneText}</div>
      <div class=\"modal-actions\"><button class=\"btn primary\" data-modal=\"close-joker\">Zurück zur Frage</button></div>
    </div>`, true);
"""
if old not in text:
    raise SystemExit('phone result modal block not found')
text = text.replace(old, new, 1)
app_path.write_text(text, encoding='utf-8')

schema_path = Path('supabase/schema.sql')
sql = schema_path.read_text(encoding='utf-8')
sql = sql.replace('  guess text; reliability numeric;','  guess text; reliability numeric; roll numeric; uncertainty numeric; unknown_chance numeric; second_key text;')
old = """  elsif typ='phone' then
    reliability:=greatest(.52,.88-(p.current_question_index*.022));
    if random()<=reliability then guess:=ckey; else guess:=wrong_keys[1+floor(random()*3)::integer]; end if;
    result:=jsonb_build_object('type','phone','guessKey',guess,'confidence',55+floor(random()*36)::integer);
"""
new = """  elsif typ='phone' then
    uncertainty:=least(.70,.18+(p.current_question_index*.035));
    unknown_chance:=least(.30,.03+(p.current_question_index*.018));
    roll:=random();
    if roll < (1-uncertainty) then
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
"""
if old not in sql:
    raise SystemExit('phone SQL block not found')
sql = sql.replace(old, new, 1)
schema_path.write_text(sql, encoding='utf-8')

migration = Path('supabase/phone-joker-update.sql')
start = sql.index('create or replace function public.wwm_student_use_joker')
end = sql.index('create or replace function public.wwm_student_heartbeat', start)
function_sql = sql[start:end].rstrip() + '\n\n'
migration.write_text('-- Run this once in the Supabase SQL editor to update the live phone joker behaviour.\n\n' + function_sql, encoding='utf-8')
