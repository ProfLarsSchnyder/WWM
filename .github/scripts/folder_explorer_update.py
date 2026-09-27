from pathlib import Path

# ---------------- APP ----------------
p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')

t = t.replace(
"  teacherGamesList, teacherGameSave, teacherGameDelete,\n  teacherStopHost, teacherDashboardGame, teacherResetAnalysis, teacherSessionHistory,",
"  teacherGamesList, teacherGameSave, teacherGameDelete, teacherGameMove,\n  teacherFoldersList, teacherFolderCreate, teacherFolderDelete,\n  teacherStopHost, teacherDashboardGame, teacherResetAnalysis, teacherSessionHistory,",
1)

t = t.replace(
"  teacherGames: [],\n  editorId: null,",
"  teacherGames: [],\n  teacherFolders: [],\n  currentFolder: null,\n  editorId: null,",
1)

t = t.replace(
"  if (action === 'teacher-new-game') return openEditor();\n  if (action === 'teacher-open-dashboard') return openDashboard();",
"  if (action === 'teacher-new-game') return openEditor();\n  if (action === 'teacher-new-folder') return createFolder();\n  if (action === 'folder-up') return openFolder(null);\n  if (action === 'teacher-open-dashboard') return openDashboard();",
1)

t = t.replace(
"  if (action === 'game-code') {\n    const game = gameById(button.dataset.id);\n    if (game) showGameCode(game);\n  }",
"  if (action === 'game-code') {\n    const game = gameById(button.dataset.id);\n    if (game) showGameCode(game);\n  }\n  if (action === 'folder-open') return openFolder(button.dataset.folder || '');\n  if (action === 'folder-delete') return deleteFolder(button.dataset.folderId || '', button.dataset.folder || '');\n  if (action === 'game-move') {\n    const game = gameById(button.dataset.id);\n    if (game) showMoveGame(game);\n  }\n  if (action === 'move-game-folder') {\n    const game = gameById(button.dataset.id);\n    if (game) await moveGame(game, button.dataset.folder || '');\n  }",
1)

old = """async function openTeacherHome() {
  if (!teacherToken()) return openTeacherLogin();
  state.teacherGames = await teacherGamesList();
  renderTeacherGames();
  $('#teacher-section-title').textContent = 'Meine Spiele';
  $('#teacher-section-subtitle').textContent = `${state.teacherGames.length} gespeicherte Spiele`;
  showScreen('teacher');
}"""
new = """async function openTeacherHome() {
  if (!teacherToken()) return openTeacherLogin();
  const [games, folders] = await Promise.all([teacherGamesList(), teacherFoldersList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.currentFolder = null;
  renderTeacherGames();
  showScreen('teacher');
}"""
assert old in t, 'openTeacherHome block not found'
t = t.replace(old, new, 1)

start = t.index('function renderTeacherGames() {')
end = t.index('function formatDate(value) {', start)
new_block = r'''function renderTeacherGames() {
  const box = $('#teacher-games');
  box.replaceChildren();
  const current = state.currentFolder;

  const folderNames = [...new Set([
    ...state.teacherFolders.map(folder => String(folder.name || '').trim()),
    ...state.teacherGames.map(game => String(game.folder || '').trim())
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de-CH', { sensitivity: 'base' }));

  if (current == null) {
    $('#teacher-section-title').textContent = 'Meine Spiele';
    $('#teacher-section-subtitle').textContent = `${state.teacherGames.length} gespeicherte Spiele · ${folderNames.length} Ordner`;
    $('#teacher-empty').classList.toggle('hidden', state.teacherGames.length > 0 || folderNames.length > 0);

    if (folderNames.length) {
      const folderGrid = document.createElement('div');
      folderGrid.className = 'folder-grid-v3';
      for (const name of folderNames) {
        const folderRecord = state.teacherFolders.find(folder => folder.name === name);
        const count = state.teacherGames.filter(game => String(game.folder || '').trim() === name).length;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'folder-card-v3';
        card.dataset.action = 'folder-open';
        card.dataset.folder = name;
        card.innerHTML = `<span class="folder-icon-v3">📁</span><strong></strong><small>${count} ${count === 1 ? 'Spiel' : 'Spiele'}</small>`;
        card.querySelector('strong').textContent = name;
        if (folderRecord?.id) card.dataset.folderId = folderRecord.id;
        folderGrid.append(card);
      }
      box.append(folderGrid);
    }

    const rootGames = state.teacherGames.filter(game => !String(game.folder || '').trim());
    if (rootGames.length) {
      const heading = document.createElement('div');
      heading.className = 'explorer-heading-v3';
      heading.innerHTML = '<strong>Spiele ohne Ordner</strong><span></span>';
      heading.querySelector('span').textContent = `${rootGames.length} ${rootGames.length === 1 ? 'Spiel' : 'Spiele'}`;
      box.append(heading);
      const grid = document.createElement('div');
      grid.className = 'game-grid-v3';
      for (const game of rootGames) grid.append(renderTeacherGameCard(game));
      box.append(grid);
    }
    return;
  }

  const folderRecord = state.teacherFolders.find(folder => folder.name === current);
  const games = state.teacherGames.filter(game => String(game.folder || '').trim() === current);
  $('#teacher-section-title').textContent = `📁 ${current}`;
  $('#teacher-section-subtitle').textContent = `${games.length} ${games.length === 1 ? 'Spiel' : 'Spiele'} in diesem Ordner`;
  $('#teacher-empty').classList.add('hidden');

  const toolbar = document.createElement('div');
  toolbar.className = 'folder-toolbar-v3';
  toolbar.innerHTML = `
    <button class="btn" data-action="folder-up">← Meine Spiele</button>
    <div class="folder-path-v3"><span>Meine Spiele</span><b>›</b><strong></strong></div>
    ${folderRecord?.id ? `<button class="btn danger-btn" data-action="folder-delete" data-folder-id="${folderRecord.id}" data-folder="${escapeHtml(current)}">Ordner löschen</button>` : ''}`;
  toolbar.querySelector('.folder-path-v3 strong').textContent = current;
  box.append(toolbar);

  if (!games.length) {
    const empty = document.createElement('div');
    empty.className = 'folder-empty-v3';
    empty.innerHTML = '<div>📂</div><strong>Dieser Ordner ist leer</strong><p>Verschiebe ein bestehendes Spiel hierher oder erstelle ein neues Spiel in diesem Ordner.</p>';
    box.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'game-grid-v3';
  for (const game of games) grid.append(renderTeacherGameCard(game));
  box.append(grid);
}

function renderTeacherGameCard(game) {
  const card = document.createElement('article');
  card.className = 'game-card-v3';
  const questionCount = Array.isArray(game.questions) ? game.questions.length : 0;
  card.innerHTML = `
    <h3></h3>
    <div class="game-card-meta">${questionCount} Fragen · Code ${escapeHtml(game.joinCode || '------')} · geändert ${formatDate(game.updatedAt)}</div>
    <div class="game-card-actions">
      <button class="btn primary" data-action="game-beamer" data-id="${game.id}">Beamer</button>
      <button class="btn" data-action="game-code" data-id="${game.id}">Code anzeigen</button>
      <button class="btn" data-action="game-move" data-id="${game.id}">📁 Verschieben</button>
      <button class="btn" data-action="game-edit" data-id="${game.id}">Bearbeiten</button>
      <button class="btn" data-action="game-duplicate" data-id="${game.id}">Duplizieren</button>
      <button class="btn danger-btn" data-action="game-delete" data-id="${game.id}">Löschen</button>
    </div>`;
  card.querySelector('h3').textContent = game.title;
  return card;
}

async function createFolder() {
  const proposed = prompt('Name des neuen Ordners:');
  if (proposed == null) return;
  const name = proposed.trim();
  if (!name) return;
  const folder = await teacherFolderCreate(name);
  state.teacherFolders = await teacherFoldersList();
  state.currentFolder = folder?.name || name;
  renderTeacherGames();
  toast(`Ordner «${state.currentFolder}» erstellt.`);
}

function openFolder(name) {
  state.currentFolder = name ? String(name) : null;
  renderTeacherGames();
}

async function deleteFolder(folderId, name) {
  if (!folderId) return;
  const count = state.teacherGames.filter(game => String(game.folder || '').trim() === name).length;
  const extra = count ? ` Die ${count} ${count === 1 ? 'Spiel' : 'Spiele'} werden zu «Ohne Ordner» verschoben.` : '';
  if (!confirm(`Ordner «${name}» wirklich löschen?${extra}`)) return;
  await teacherFolderDelete(folderId);
  const [games, folders] = await Promise.all([teacherGamesList(), teacherFoldersList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.currentFolder = null;
  renderTeacherGames();
  toast('Ordner gelöscht. Spiele bleiben erhalten.');
}

function showMoveGame(game) {
  const folders = [...new Set(state.teacherFolders.map(folder => String(folder.name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de-CH', { sensitivity: 'base' }));
  const current = String(game.folder || '').trim();
  const choices = [
    `<button class="folder-choice-v3${!current ? ' active' : ''}" data-action="move-game-folder" data-id="${game.id}" data-folder=""><span>🗂️</span><strong>Ohne Ordner</strong>${!current ? '<small>Aktuell</small>' : ''}</button>`,
    ...folders.map(name => `<button class="folder-choice-v3${current === name ? ' active' : ''}" data-action="move-game-folder" data-id="${game.id}" data-folder="${escapeHtml(name)}"><span>📁</span><strong>${escapeHtml(name)}</strong>${current === name ? '<small>Aktuell</small>' : ''}</button>`)
  ].join('');
  modal(`
    <p class="eyebrow">Spiel verschieben</p>
    <h3>${escapeHtml(game.title)}</h3>
    <p class="section-muted">Wähle den Zielordner.</p>
    <div class="folder-choice-grid-v3">${choices}</div>
    <div class="modal-actions"><button class="btn" data-modal="close">Abbrechen</button></div>`, false, true);
}

async function moveGame(game, folder) {
  await teacherGameMove(game.id, folder || null);
  state.teacherGames = await teacherGamesList();
  closeModal(true);
  renderTeacherGames();
  toast(folder ? `Spiel nach «${folder}» verschoben.` : 'Spiel zu «Ohne Ordner» verschoben.');
}

'''
t = t[:start] + new_block + t[end:]

t = t.replace("  $('#editor-game-folder').value = game?.folder || '';", "  $('#editor-game-folder').value = game?.folder || state.currentFolder || '';", 1)
t = t.replace(
"  [...new Set(state.teacherGames.map(item => String(item.folder || '').trim()).filter(Boolean))]",
"  [...new Set([\n    ...state.teacherFolders.map(item => String(item.name || '').trim()),\n    ...state.teacherGames.map(item => String(item.folder || '').trim())\n  ].filter(Boolean))]",
1)

t = t.replace("} from './backend-v3.js?v=20260926-analysis2';", "} from './backend-v3.js?v=20260927-folderexplorer1';", 1)
p.write_text(t, encoding='utf-8')

# ---------------- BACKEND ----------------
p = Path('js/backend-v3.js')
t = p.read_text(encoding='utf-8')
t = t.replace(
"export const teacherGameDelete = gameId => teacherRpc('wwm_teacher_game_delete', { p_game_id: gameId });\nexport const teacherHostGame",
"export const teacherGameDelete = gameId => teacherRpc('wwm_teacher_game_delete', { p_game_id: gameId });\nexport const teacherGameMove = (gameId, folder) => teacherRpc('wwm_teacher_game_move', { p_game_id: gameId, p_folder: folder });\nexport const teacherFoldersList = () => teacherRpc('wwm_teacher_folders_list');\nexport const teacherFolderCreate = name => teacherRpc('wwm_teacher_folder_create', { p_name: name });\nexport const teacherFolderDelete = folderId => teacherRpc('wwm_teacher_folder_delete', { p_folder_id: folderId });\nexport const teacherHostGame",
1)
p.write_text(t, encoding='utf-8')

# ---------------- INDEX ----------------
p = Path('index.html')
t = p.read_text(encoding='utf-8')
t = t.replace(
'            <button class="btn primary" data-action="teacher-new-game">Neues Spiel</button>',
'            <div class="teacher-actions"><button class="btn" data-action="teacher-new-folder">📁 Neuer Ordner</button><button class="btn primary" data-action="teacher-new-game">Neues Spiel</button></div>',
1)
t = t.replace('styles-v3.css?v=20260927-folders1', 'styles-v3.css?v=20260927-folderexplorer1', 1)
t = t.replace('js/app-v3.js?v=20260927-phonefolders1', 'js/app-v3.js?v=20260927-folderexplorer1', 1)
p.write_text(t, encoding='utf-8')

# ---------------- STYLES ----------------
p = Path('styles-v3.css')
t = p.read_text(encoding='utf-8')
t += r'''

/* Desktop-style game folder explorer */
#teacher-games{display:grid;gap:18px}.folder-grid-v3{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}.folder-card-v3{min-height:138px;border:1px solid rgba(112,132,255,.42);border-radius:20px;background:linear-gradient(180deg,rgba(15,20,82,.92),rgba(7,9,43,.96));color:#fff;padding:18px;text-align:left;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;transition:.16s ease}.folder-card-v3:hover{transform:translateY(-2px);border-color:var(--v3-orange);box-shadow:0 12px 30px rgba(0,0,25,.28)}.folder-icon-v3{font-size:42px;line-height:1;margin-bottom:16px}.folder-card-v3 strong{font-size:18px;overflow-wrap:anywhere}.folder-card-v3 small{margin-top:6px;color:var(--v3-muted)}.explorer-heading-v3{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px;color:#fff}.explorer-heading-v3 span{color:var(--v3-muted);font-size:12px}.folder-toolbar-v3{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid rgba(112,132,255,.2);padding-bottom:14px}.folder-path-v3{display:flex;align-items:center;gap:8px;min-width:0;flex:1;color:var(--v3-muted);font-size:13px}.folder-path-v3 strong{color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.folder-empty-v3{border:1px dashed rgba(112,132,255,.4);border-radius:20px;padding:38px;text-align:center;color:var(--v3-muted)}.folder-empty-v3>div{font-size:56px}.folder-empty-v3 strong{display:block;color:#fff;font-size:20px;margin:8px 0}.folder-empty-v3 p{margin:0 auto;max-width:520px;line-height:1.5}.folder-choice-grid-v3{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:16px}.folder-choice-v3{border:1px solid rgba(112,132,255,.35);border-radius:16px;background:rgba(8,12,58,.86);color:#fff;padding:16px;cursor:pointer;text-align:left;display:grid;grid-template-columns:auto 1fr;gap:8px 10px;align-items:center}.folder-choice-v3:hover{border-color:var(--v3-orange)}.folder-choice-v3.active{border-color:var(--v3-orange);background:rgba(255,157,47,.08)}.folder-choice-v3 span{font-size:28px;grid-row:1/3}.folder-choice-v3 small{color:var(--v3-orange)}.folder-field-label{margin-top:16px}.folder-field-hint{color:var(--v3-muted);font-size:12px;line-height:1.4;margin:7px 0 0}@media(max-width:720px){.folder-grid-v3{grid-template-columns:1fr 1fr}.folder-toolbar-v3{align-items:stretch}.folder-path-v3{order:-1;flex-basis:100%}}'''
p.write_text(t, encoding='utf-8')
