
from pathlib import Path

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing pattern: {label}")
    return text.replace(old, new, 1)

# importer.js
p = Path("js/importer.js")
t = p.read_text(encoding="utf-8")
t = replace_once(
    t,
    "  const duplicate = cleaned.findIndex(q => new Set([q.correct, ...q.wrong].map(x => x.toLowerCase())).size !== 4);",
    "  // Gross- und Kleinschreibung kann selbst Teil der Aufgabe sein.\n"
    "  // Deshalb gelten nur exakt gleiche Antworttexte als Duplikate.\n"
    "  const duplicate = cleaned.findIndex(q => new Set([q.correct, ...q.wrong].map(x => x.normalize('NFC'))).size !== 4);",
    "frontend duplicate validation"
)
p.write_text(t, encoding="utf-8")

# app-core importer cache bust
p = Path("js/app-core-v3.js")
t = p.read_text(encoding="utf-8")
t = t.replace("from './importer.js';", "from './importer.js?v=20261004-caseanswers1';", 1)
p.write_text(t, encoding="utf-8")

# schema canonical validation
p = Path("supabase/schema.sql")
t = p.read_text(encoding="utf-8")
old = """    select count(distinct lower(x)) into answer_count from (
      select btrim(q->>'correct') as x union all
      select btrim(value) from jsonb_array_elements_text(q->'wrong')
    ) s;"""
new = """    -- Gross- und Kleinschreibung kann selbst Teil einer Antwort sein.
    -- Nur exakt gleiche, getrimmte Texte gelten als Duplikate.
    select count(distinct x) into answer_count from (
      select btrim(q->>'correct') as x union all
      select btrim(value) from jsonb_array_elements_text(q->'wrong')
    ) s;"""
t = replace_once(t, old, new, "backend duplicate validation")
p.write_text(t, encoding="utf-8")

# top-level cache bust
p = Path("js/app-v3.js")
t = p.read_text(encoding="utf-8")
t = t.replace("app-core-v3.js?v=20261004-mobile1", "app-core-v3.js?v=20261004-caseanswers1", 1)
p.write_text(t, encoding="utf-8")

p = Path("index.html")
t = p.read_text(encoding="utf-8")
t = t.replace("js/app-v3.js?v=20261004-mobile1", "js/app-v3.js?v=20261004-caseanswers1", 1)
p.write_text(t, encoding="utf-8")
