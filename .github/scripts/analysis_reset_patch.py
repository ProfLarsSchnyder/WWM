from pathlib import Path

# backend-v3.js
p = Path('js/backend-v3.js')
t = p.read_text(encoding='utf-8')
old = "export const teacherDashboardGame = gameId => teacherRpc('wwm_teacher_dashboard_game', { p_game_id: gameId });\n"
new = old + "export const teacherResetAnalysis = gameId => teacherRpc('wwm_teacher_reset_analysis', { p_game_id: gameId });\n"
assert old in t, 'dashboard game export not found'
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# app-v3.js
p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')
old = "  teacherStopHost, teacherDashboardGame, teacherSessionHistory,\n"
new = "  teacherStopHost, teacherDashboardGame, teacherResetAnalysis, teacherSessionHistory,\n"
assert old in t, 'app import line not found'
t = t.replace(old, new, 1)

old = "  if (action === 'host-refresh') return refreshDashboard();\n"
new = old + "  if (action === 'analysis-reset') return resetCurrentAnalysis();\n"
assert old in t, 'host refresh action not found'
t = t.replace(old, new, 1)

needle = "async function refreshDashboard() {\n  if (!state.dashboardGameId) return openDashboard();\n  const data = await teacherDashboardGame(state.dashboardGameId);\n  renderDashboard(data);\n}\n"
insert = needle + "\nasync function resetCurrentAnalysis() {\n  if (!state.dashboardGameId) return;\n  const game = gameById(state.dashboardGameId);\n  const title = game?.title || 'dieses Spiel';\n  if (!confirm(`Live Analyse für «${title}» zurücksetzen? Die bisherige Auswertung bleibt im Verlauf erhalten, die Live Analyse startet leer.`)) return;\n  await teacherResetAnalysis(state.dashboardGameId);\n  toast('Live Analyse zurückgesetzt.');\n  await refreshDashboard();\n}\n"
assert needle in t, 'refresh dashboard block not found'
t = t.replace(needle, insert, 1)
p.write_text(t, encoding='utf-8')

# index.html
p = Path('index.html')
t = p.read_text(encoding='utf-8')
old = "            <button class=\"btn\" data-action=\"analysis-picker\">Anderes Spiel wählen</button>\n            <button class=\"btn\" data-action=\"host-refresh\">Jetzt aktualisieren</button>\n            <button class=\"btn ghost\" data-action=\"host-back\">Zurück</button>"
new = "            <button class=\"btn\" data-action=\"analysis-picker\">Anderes Spiel wählen</button>\n            <button class=\"btn\" data-action=\"host-refresh\">Jetzt aktualisieren</button>\n            <button class=\"btn danger-btn\" data-action=\"analysis-reset\">Analyse zurücksetzen</button>\n            <button class=\"btn ghost\" data-action=\"host-back\">Zurück</button>"
assert old in t, 'analysis header buttons not found'
t = t.replace(old, new, 1)
t = t.replace('js/app-v3.js?v=20260926-analysis1', 'js/app-v3.js?v=20260926-analysis2')
p.write_text(t, encoding='utf-8')
