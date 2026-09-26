from pathlib import Path

# backend-v3.js
p = Path('js/backend-v3.js')
t = p.read_text(encoding='utf-8')
old = "export const teacherDashboard = () => teacherRpc('wwm_teacher_dashboard');\n"
new = old + "export const teacherDashboardGame = gameId => teacherRpc('wwm_teacher_dashboard_game', { p_game_id: gameId });\n"
assert old in t, 'backend dashboard export not found'
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# app-v3.js
p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')
old = "  teacherStopHost, teacherDashboard, teacherSessionHistory,\n"
new = "  teacherStopHost, teacherDashboardGame, teacherSessionHistory,\n"
assert old in t, 'app import not found'
t = t.replace(old, new, 1)

old = "  dashboardTimer: null,\n  heartbeatTimer: null,\n"
new = "  dashboardTimer: null,\n  dashboardGameId: null,\n  heartbeatTimer: null,\n"
assert old in t, 'dashboard state not found'
t = t.replace(old, new, 1)

old = "  if (action === 'teacher-open-dashboard') return openDashboard();\n"
new = old + "  if (action === 'analysis-picker') return openDashboard();\n"
assert old in t, 'teacher dashboard action not found'
t = t.replace(old, new, 1)

needle = "  if (action === 'game-code') {\n    const game = gameById(button.dataset.id);\n    if (game) showGameCode(game);\n  }\n"
insert = needle + "  if (action === 'analysis-game') {\n    const game = gameById(button.dataset.id);\n    if (game) await openGameDashboard(game);\n  }\n"
assert needle in t, 'game-code block not found'
t = t.replace(needle, insert, 1)

start = t.index('async function openDashboard() {')
end = t.index('\nfunction startDashboardPolling()', start)
new_block = '''async function openDashboard() {
  stopDashboardPolling();
  if (!state.teacherGames.length) state.teacherGames = await teacherGamesList();

  const rows = state.teacherGames.map(game => `
    <div class="history-row">
      <div><strong>${escapeHtml(game.title || 'Spiel')}</strong><br><small>Code ${escapeHtml(game.joinCode || '------')}</small></div>
      <span>${Array.isArray(game.questions) ? game.questions.length : 0} Fragen</span>
      <button class="btn primary small" data-action="analysis-game" data-id="${game.id}">Analyse öffnen</button>
    </div>`).join('');

  modal(`
    <p class="eyebrow">Live Analyse</p>
    <h3>Spiel auswählen</h3>
    <p class="section-muted">Wähle das Spiel, dessen Lernstände und Ergebnisse du sehen möchtest.</p>
    <div class="history-list">${rows || '<div class="empty-state"><p>Noch keine Spiele vorhanden.</p></div>'}</div>
    <div class="modal-actions"><button class="btn" data-modal="close">Schliessen</button></div>`, false, true);
}

async function openGameDashboard(game) {
  closeModal(true);
  state.dashboardGameId = game.id;
  const dashboard = await teacherDashboardGame(game.id);
  showScreen('host');
  renderDashboard(dashboard);
  startDashboardPolling();
}
'''
t = t[:start] + new_block + t[end:]

old = "async function refreshDashboard() {\n  const data = await teacherDashboard();\n  if (!data?.active) {\n    stopDashboardPolling();\n    toast('Momentan ist noch keine Spielaktivität vorhanden.');\n    return openTeacherHome();\n  }\n  renderDashboard(data);\n}\n"
new = "async function refreshDashboard() {\n  if (!state.dashboardGameId) return openDashboard();\n  const data = await teacherDashboardGame(state.dashboardGameId);\n  renderDashboard(data);\n}\n"
assert old in t, 'refreshDashboard block not found'
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# index.html
p = Path('index.html')
t = p.read_text(encoding='utf-8')
old = "            <button class=\"btn\" data-action=\"host-refresh\">Jetzt aktualisieren</button>\n            <button class=\"btn ghost\" data-action=\"host-back\">Zurück</button>"
new = "            <button class=\"btn\" data-action=\"analysis-picker\">Anderes Spiel wählen</button>\n            <button class=\"btn\" data-action=\"host-refresh\">Jetzt aktualisieren</button>\n            <button class=\"btn ghost\" data-action=\"host-back\">Zurück</button>"
assert old in t, 'host header buttons not found'
t = t.replace(old, new, 1)

t = t.replace('js/app-v3.js?v=20260926-codes1', 'js/app-v3.js?v=20260926-analysis1')
p.write_text(t, encoding='utf-8')
