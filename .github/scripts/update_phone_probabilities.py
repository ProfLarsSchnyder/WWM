from pathlib import Path

# 1) Frontend probability table
app = Path('js/app-v3.js')
text = app.read_text(encoding='utf-8')
old = """function phoneOutcomeProbabilities(index) {
  const uncertainty = Math.min(.70, .18 + index * .035);
  const unknown = Math.min(.30, .03 + index * .018);
  return {
    certain: 1 - uncertainty,
    between: uncertainty - unknown,
    unknown
  };
}
"""
new = """function phoneOutcomeProbabilities(index) {
  const table = [
    { certain:1.00, between:0.00, unknown:0.00 }, // 50
    { certain:0.96, between:0.04, unknown:0.00 }, // 100
    { certain:0.92, between:0.07, unknown:0.01 }, // 200
    { certain:0.88, between:0.10, unknown:0.02 }, // 300
    { certain:0.84, between:0.12, unknown:0.04 }, // 500
    { certain:0.80, between:0.15, unknown:0.05 }, // 1'000
    { certain:0.75, between:0.18, unknown:0.07 }, // 2'000
    { certain:0.70, between:0.22, unknown:0.08 }, // 4'000
    { certain:0.65, between:0.25, unknown:0.10 }, // 8'000
    { certain:0.58, between:0.28, unknown:0.14 }, // 16'000
    { certain:0.50, between:0.32, unknown:0.18 }, // 32'000
    { certain:0.43, between:0.35, unknown:0.22 }, // 64'000
    { certain:0.36, between:0.38, unknown:0.26 }, // 125'000
    { certain:0.28, between:0.40, unknown:0.32 }, // 500'000
    { certain:0.22, between:0.40, unknown:0.38 }  // 1'000'000
  ];
  return table[Math.min(Math.max(index, 0), table.length - 1)];
}
"""
if old not in text:
    raise SystemExit('phoneOutcomeProbabilities block not found')
text = text.replace(old, new, 1)
app.write_text(text, encoding='utf-8')

# 2) Make final phone result a normal flowing sentence, not grid-separated fragments
css = Path('styles-v3.css')
css_text = css.read_text(encoding='utf-8')
marker = '/* Phone joker final result: compact flowing sentence */'
if marker not in css_text:
    css_text += """

/* Phone joker final result: compact flowing sentence */
.phone-process.final-phone-tip{
  display:block;
  min-height:0;
  max-width:760px;
  margin:18px auto 8px;
  padding:0 20px;
  text-align:center;
  font-size:clamp(22px,2.3vw,32px);
  line-height:1.4;
}
.phone-process.final-phone-tip strong{display:inline;color:var(--v3-orange)}
"""
css.write_text(css_text, encoding='utf-8')

# 3) Server-side probabilities for hosted learner mode
old_sql = """  elsif typ='phone' then
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
new_sql = """  elsif typ='phone' then
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
"""
for sql_path in [Path('supabase/schema.sql'), Path('supabase/phone-joker-update.sql')]:
    sql = sql_path.read_text(encoding='utf-8')
    if old_sql not in sql:
        raise SystemExit(f'phone SQL block not found in {sql_path}')
    sql_path.write_text(sql.replace(old_sql, new_sql, 1), encoding='utf-8')

# 4) Cache bust both JS and CSS so browsers load this exact update
index = Path('index.html')
html = index.read_text(encoding='utf-8')
html = html.replace('href="styles-v3.css"', 'href="styles-v3.css?v=20260926-phone3"')
html = html.replace('src="js/app-v3.js?v=20260926-1349"', 'src="js/app-v3.js?v=20260926-phone3"')
index.write_text(html, encoding='utf-8')
