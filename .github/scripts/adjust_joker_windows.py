from pathlib import Path

path = Path('js/app-v3.js')
text = path.read_text(encoding='utf-8')

pairs = [
    ("playCueSegment('joker-audience', 26, 33)", "playCueSegment('joker-audience', 26, 32.5)"),
    ("playCueSegment('joker-phone', 20, 39)", "playCueSegment('joker-phone', 21, 40)"),
]

for old, new in pairs:
    if old not in text:
        raise SystemExit(f'Missing expected text: {old}')
    text = text.replace(old, new, 1)

old = """  for (let remaining = 7; remaining >= 1; remaining--) {
    const clock = document.querySelector('.joker-countdown strong');
    if (clock) clock.textContent = String(remaining);
    await sleep(1000);
    if (seq !== state.playSeq) return;
  }
"""
new = """  for (let remaining = 7; remaining >= 1; remaining--) {
    const clock = document.querySelector('.joker-countdown strong');
    if (clock) clock.textContent = String(remaining);
    await sleep(remaining === 1 ? 500 : 1000);
    if (seq !== state.playSeq) return;
  }
"""

if old not in text:
    raise SystemExit('Audience countdown loop not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
