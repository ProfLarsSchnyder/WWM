from pathlib import Path
p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')
old = """  let phoneText;
  if (result.outcome === 'between' && Array.isArray(result.keys) && result.keys.length >= 2) {
"""
new = """  let phoneText;
  const phoneOutcome = result.outcome || 'unknown';
  if (phoneOutcome === 'between' && Array.isArray(result.keys) && result.keys.length >= 2) {
"""
if old not in t:
    raise SystemExit('phone text start not found')
t = t.replace(old, new, 1)
t = t.replace("  } else if (result.outcome === 'unknown') {", "  } else if (phoneOutcome === 'unknown') {", 1)
p.write_text(t, encoding='utf-8')
