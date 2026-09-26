from pathlib import Path

p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')
old = "} from './backend-v3.js';"
new = "} from './backend-v3.js?v=20260926-analysis2';"
assert old in t, 'backend import not found'
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

p = Path('index.html')
t = p.read_text(encoding='utf-8')
old = 'js/app-v3.js?v=20260926-analysis2'
new = 'js/app-v3.js?v=20260926-analysis3'
assert old in t, 'app cache version not found'
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')
