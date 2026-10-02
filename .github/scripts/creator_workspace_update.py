
from pathlib import Path

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing pattern: {label}")
    return text.replace(old, new, 1)

# ---------------- backend ----------------
p = Path("js/backend-v3.js")
t = p.read_text(encoding="utf-8")
t = replace_once(
    t,
    "export const teacherFolderDelete = folderId => teacherRpc('wwm_teacher_folder_delete', { p_folder_id: folderId });\nexport const teacherHostGame",
    "export const teacherFolderDelete = folderId => teacherRpc('wwm_teacher_folder_delete', { p_folder_id: folderId });\n"
    "export const teacherCreatorsList = () => teacherRpc('wwm_teacher_creators_list');\n"
    "export const teacherCreatorEnsure = (name, color) => teacherRpc('wwm_teacher_creator_ensure', { p_name: name, p_color: color });\n"
    "export const teacherCreatorUpdate = (creatorId, name, color) => teacherRpc('wwm_teacher_creator_update', { p_creator_id: creatorId, p_name: name, p_color: color });\n"
    "export const teacherCreatorDelete = creatorId => teacherRpc('wwm_teacher_creator_delete', { p_creator_id: creatorId });\n"
    "export const teacherFolderSave = (folderId, name, creatorId) => teacherRpc('wwm_teacher_folder_save', { p_folder_id: folderId, p_name: name, p_creator_id: creatorId });\n"
    "export const teacherGameMoveStructure = (gameId, creatorId, folderId) => teacherRpc('wwm_teacher_game_move_structure', { p_game_id: gameId, p_creator_id: creatorId, p_folder_id: folderId });\n"
    "export const teacherHostGame",
    "backend creator exports"
)
p.write_text(t, encoding="utf-8")

# ---------------- app core ----------------
p = Path("js/app-core-v3.js")
t = p.read_text(encoding="utf-8")

t = replace_once(
    t,
    "  teacherGamesList, teacherGameSave, teacherGameDelete, teacherGameMove,\n"
    "  teacherFoldersList, teacherFolderCreate, teacherFolderDelete,\n"
    "  teacherStopHost, teacherDashboardGame, teacherResetAnalysis, teacherSessionHistory,",
    "  teacherGamesList, teacherGameSave, teacherGameDelete, teacherGameMove,\n"
    "  teacherFoldersList, teacherFolderCreate, teacherFolderDelete,\n"
    "  teacherCreatorsList, teacherCreatorEnsure, teacherCreatorUpdate, teacherCreatorDelete,\n"
    "  teacherFolderSave, teacherGameMoveStructure,\n"
    "  teacherStopHost, teacherDashboardGame, teacherResetAnalysis, teacherSessionHistory,",
    "app imports"
)
t = t.replace("} from './backend-v3.js?v=20260927-folderexplorer1';", "} from './backend-v3.js?v=20261002-creators1';", 1)

t = replace_once(
    t,
    "  teacherGames: [],\n  teacherFolders: [],\n  currentFolder: null,",
    "  teacherGames: [],\n  teacherFolders: [],\n  teacherCreators: [],\n  currentCreatorId: null,\n  currentFolderId: null,",
    "state creator fields"
)

t = replace_once(
    t,
    "  if (action === 'teacher-new-game') return openEditor();\n"
    "  if (action === 'teacher-new-folder') return createFolder();\n"
    "  if (action === 'folder-up') return openFolder(null);",
    "  if (action === 'teacher-new-game') return openEditor();\n"
    "  if (action === 'teacher-new-creator') return openCreatorDialog();\n"
    "  if (action === 'teacher-new-folder') return openFolderDialog();\n"
    "  if (action === 'creator-up') return openCreator(null);\n"
    "  if (action === 'folder-up') return openFolder(null);",
    "top actions"
)

t = replace_once(
    t,
    "  if (action === 'folder-open') return openFolder(button.dataset.folder || '');\n"
    "  if (action === 'folder-delete') return deleteFolder(button.dataset.folderId || '', button.dataset.folder || '');\n"
    "  if (action === 'game-move') {\n"
    "    const game = gameById(button.dataset.id);\n"
    "    if (game) showMoveGame(game);\n"
    "  }\n"
    "  if (action === 'move-game-folder') {\n"
    "    const game = gameById(button.dataset.id);\n"
    "    if (game) await moveGame(game, button.dataset.folder || '');\n"
    "  }",
    "  if (action === 'creator-open') return openCreator(button.dataset.creatorId || '__unassigned__');\n"
    "  if (action === 'creator-edit') {\n"
    "    const creator = creatorById(button.dataset.creatorId);\n"
    "    if (creator) return openCreatorDialog(creator);\n"
    "  }\n"
    "  if (action === 'creator-save') return saveCreatorDialog(button.dataset.creatorId || '');\n"
    "  if (action === 'creator-delete') return deleteCreator(button.dataset.creatorId || '');\n"
    "  if (action === 'folder-open') return openFolder(button.dataset.folderId || '');\n"
    "  if (action === 'folder-edit') {\n"
    "    const folder = folderById(button.dataset.folderId);\n"
    "    if (folder) return openFolderDialog(folder);\n"
    "  }\n"
    "  if (action === 'folder-save') return saveFolderDialog(button.dataset.folderId || '');\n"
    "  if (action === 'folder-delete') return deleteFolder(button.dataset.folderId || '');\n"
    "  if (action === 'game-move') {\n"
    "    const game = gameById(button.dataset.id);\n"
    "    if (game) showMoveGame(game);\n"
    "  }\n"
    "  if (action === 'move-game-structure') {\n"
    "    const game = gameById(button.dataset.id);\n"
    "    if (game) await moveGame(game, button.dataset.creatorId || '', button.dataset.folderId || '');\n"
    "  }",
    "structure actions"
)

old = """async function openTeacherHome() {
  if (!teacherToken()) return openTeacherLogin();
  const [games, folders] = await Promise.all([teacherGamesList(), teacherFoldersList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.currentFolder = null;
  renderTeacherGames();
  showScreen('teacher');
}"""
new = """async function openTeacherHome() {
  if (!teacherToken()) return openTeacherLogin();
  const [games, folders, creators] = await Promise.all([
    teacherGamesList(),
    teacherFoldersList(),
    teacherCreatorsList()
  ]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.teacherCreators = creators || [];
  state.currentCreatorId = null;
  state.currentFolderId = null;
  renderTeacherGames();
  showScreen('teacher');
}"""
t = replace_once(t, old, new, "openTeacherHome")

start = t.index("function renderTeacherGames() {")
end = t.index("function formatDate(value) {", start)
if start < 0 or end < 0:
    raise SystemExit("Could not find explorer block")

new_explorer = r'''function creatorById(id) {
  return state.teacherCreators.find(creator => String(creator.id) === String(id));
}

function folderById(id) {
  return state.teacherFolders.find(folder => String(folder.id) === String(id));
}

function normalizeCreatorColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#6f83ff';
}

function creatorIdValue(value) {
  return value && value !== '__unassigned__' ? String(value) : '';
}

function gameCreatorId(game) {
  return String(game?.creatorId || '');
}

function gameFolderId(game) {
  return String(game?.folderId || '');
}

function folderCreatorId(folder) {
  return String(folder?.creatorId || '');
}

function renderTeacherGames() {
  const box = $('#teacher-games');
  box.replaceChildren();

  if (state.currentCreatorId == null) {
    $('#teacher-section-title').textContent = 'Meine Spiele';
    $('#teacher-section-subtitle').textContent = `${state.teacherGames.length} gespeicherte Spiele · ${state.teacherCreators.length} Creator`;
    $('#teacher-empty').classList.toggle('hidden', state.teacherGames.length > 0 || state.teacherCreators.length > 0 || state.teacherFolders.length > 0);

    const creatorGrid = document.createElement('div');
    creatorGrid.className = 'creator-grid-v4';

    for (const creator of state.teacherCreators) {
      const creatorGames = state.teacherGames.filter(game => gameCreatorId(game) === String(creator.id));
      const creatorFolders = state.teacherFolders.filter(folder => folderCreatorId(folder) === String(creator.id));
      creatorGrid.append(renderCreatorCard(creator, creatorGames.length, creatorFolders.length));
    }

    const unassignedGames = state.teacherGames.filter(game => !gameCreatorId(game));
    const unassignedFolders = state.teacherFolders.filter(folder => !folderCreatorId(folder));
    if (unassignedGames.length || unassignedFolders.length) {
      creatorGrid.append(renderCreatorCard(null, unassignedGames.length, unassignedFolders.length));
    }

    if (creatorGrid.children.length) box.append(creatorGrid);

    if (!creatorGrid.children.length && !state.teacherGames.length) {
      const empty = document.createElement('div');
      empty.className = 'folder-empty-v3';
      empty.innerHTML = '<div>👤</div><strong>Noch keine Creator</strong><p>Erstelle einen Creator und ordne danach Ordner und Spiele diesem Bereich zu.</p>';
      box.append(empty);
    }
    return;
  }

  const creatorId = creatorIdValue(state.currentCreatorId);
  const creator = creatorById(creatorId);
  const currentFolder = state.currentFolderId ? folderById(state.currentFolderId) : null;
  const color = creator ? normalizeCreatorColor(creator.color) : '#69739f';

  if (!currentFolder) {
    $('#teacher-section-title').textContent = creator ? `Creator: ${creator.name}` : 'Ohne Creator';
    const creatorGames = state.teacherGames.filter(game => gameCreatorId(game) === creatorId);
    const folders = state.teacherFolders.filter(folder => folderCreatorId(folder) === creatorId);
    $('#teacher-section-subtitle').textContent = `${creatorGames.length} ${creatorGames.length === 1 ? 'Spiel' : 'Spiele'} · ${folders.length} Ordner`;
    $('#teacher-empty').classList.add('hidden');

    const toolbar = document.createElement('div');
    toolbar.className = 'folder-toolbar-v3 creator-toolbar-v4';
    toolbar.style.setProperty('--creator-color', color);
    toolbar.innerHTML = `
      <button class="btn" data-action="creator-up">← Alle Creator</button>
      <div class="creator-path-v4"><i></i><strong>${escapeHtml(creator?.name || 'Ohne Creator')}</strong></div>
      ${creator ? `<button class="btn" data-action="creator-edit" data-creator-id="${creator.id}">Creator bearbeiten</button>` : ''}
      <button class="btn" data-action="teacher-new-folder">📁 Neuer Ordner</button>`;
    box.append(toolbar);

    if (folders.length) {
      const folderGrid = document.createElement('div');
      folderGrid.className = 'folder-grid-v3';
      for (const folder of folders) folderGrid.append(renderFolderCard(folder, color));
      box.append(folderGrid);
    }

    const looseGames = creatorGames.filter(game => !gameFolderId(game));
    if (looseGames.length) {
      const heading = document.createElement('div');
      heading.className = 'explorer-heading-v3';
      heading.innerHTML = '<strong>Spiele ohne Ordner</strong><span></span>';
      heading.querySelector('span').textContent = `${looseGames.length} ${looseGames.length === 1 ? 'Spiel' : 'Spiele'}`;
      box.append(heading);
      const grid = document.createElement('div');
      grid.className = 'game-grid-v3';
      for (const game of looseGames) grid.append(renderTeacherGameCard(game));
      box.append(grid);
    }

    if (!folders.length && !looseGames.length) {
      const empty = document.createElement('div');
      empty.className = 'folder-empty-v3';
      empty.innerHTML = '<div>📂</div><strong>Dieser Creator Bereich ist leer</strong><p>Erstelle einen Ordner oder ein neues Spiel.</p>';
      box.append(empty);
    }
    return;
  }

  const folderGames = state.teacherGames.filter(game => gameFolderId(game) === String(currentFolder.id));
  $('#teacher-section-title').textContent = `📁 ${currentFolder.name}`;
  $('#teacher-section-subtitle').textContent = `${folderGames.length} ${folderGames.length === 1 ? 'Spiel' : 'Spiele'} · ${creator?.name || 'Ohne Creator'}`;
  $('#teacher-empty').classList.add('hidden');

  const toolbar = document.createElement('div');
  toolbar.className = 'folder-toolbar-v3';
  toolbar.innerHTML = `
    <button class="btn" data-action="folder-up">← ${escapeHtml(creator?.name || 'Ohne Creator')}</button>
    <div class="folder-path-v3"><span>${escapeHtml(creator?.name || 'Ohne Creator')}</span><b>›</b><strong>${escapeHtml(currentFolder.name)}</strong></div>
    <button class="btn" data-action="folder-edit" data-folder-id="${currentFolder.id}">Ordner bearbeiten</button>
    <button class="btn danger-btn" data-action="folder-delete" data-folder-id="${currentFolder.id}">Ordner löschen</button>`;
  box.append(toolbar);

  if (!folderGames.length) {
    const empty = document.createElement('div');
    empty.className = 'folder-empty-v3';
    empty.innerHTML = '<div>📂</div><strong>Dieser Ordner ist leer</strong><p>Verschiebe ein bestehendes Spiel hierher oder erstelle ein neues Spiel.</p>';
    box.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'game-grid-v3';
  for (const game of folderGames) grid.append(renderTeacherGameCard(game));
  box.append(grid);
}

function renderCreatorCard(creator, gameCount, folderCount) {
  const id = creator?.id || '__unassigned__';
  const color = normalizeCreatorColor(creator?.color || '#69739f');
  const card = document.createElement('article');
  card.className = 'creator-card-v4';
  card.style.setProperty('--creator-color', color);
  card.innerHTML = `
    <button type="button" class="creator-open-v4" data-action="creator-open" data-creator-id="${id}">
      <span class="creator-avatar-v4">${creator ? 'C' : '—'}</span>
      <span class="creator-copy-v4"><strong></strong><small>${folderCount} Ordner · ${gameCount} ${gameCount === 1 ? 'Spiel' : 'Spiele'}</small></span>
    </button>
    ${creator ? `<button class="btn small creator-edit-v4" data-action="creator-edit" data-creator-id="${creator.id}">Bearbeiten</button>` : ''}`;
  card.querySelector('.creator-copy-v4 strong').textContent = creator?.name || 'Ohne Creator';
  return card;
}

function renderFolderCard(folder, fallbackColor) {
  const color = normalizeCreatorColor(folder.creatorColor || fallbackColor || '#69739f');
  const count = state.teacherGames.filter(game => gameFolderId(game) === String(folder.id)).length;
  const card = document.createElement('article');
  card.className = 'folder-card-v4';
  card.style.setProperty('--creator-color', color);
  card.innerHTML = `
    <button type="button" class="folder-open-v4" data-action="folder-open" data-folder-id="${folder.id}">
      <span class="folder-icon-v4">▰</span>
      <strong></strong>
      <small>${count} ${count === 1 ? 'Spiel' : 'Spiele'}</small>
    </button>
    <button class="btn small" data-action="folder-edit" data-folder-id="${folder.id}">Bearbeiten</button>`;
  card.querySelector('.folder-open-v4 strong').textContent = folder.name || 'Ordner';
  return card;
}

function renderTeacherGameCard(game) {
  const card = document.createElement('article');
  card.className = 'game-card-v3';
  const questionCount = Array.isArray(game.questions) ? game.questions.length : 0;
  const creator = creatorById(gameCreatorId(game));
  const folder = folderById(gameFolderId(game));
  const color = normalizeCreatorColor(game.creatorColor || creator?.color || '#69739f');
  card.style.setProperty('--creator-color', color);
  card.innerHTML = `
    <div class="game-creator-line-v4"><i></i><span></span></div>
    <h3></h3>
    <div class="game-card-meta">${questionCount} Fragen · geändert ${formatDate(game.updatedAt)}</div>
    <div class="game-card-actions">
      <button class="btn primary" data-action="game-beamer" data-id="${game.id}">Beamer</button>
      <button class="btn" data-action="game-move" data-id="${game.id}">📁 Verschieben</button>
      <button class="btn" data-action="game-edit" data-id="${game.id}">Bearbeiten</button>
      <button class="btn" data-action="game-duplicate" data-id="${game.id}">Duplizieren</button>
      <button class="btn danger-btn" data-action="game-delete" data-id="${game.id}">Löschen</button>
    </div>`;
  card.querySelector('h3').textContent = game.title;
  card.querySelector('.game-creator-line-v4 span').textContent = `${creator?.name || 'Ohne Creator'}${folder ? ` · ${folder.name}` : ''}`;
  return card;
}

function openCreator(id) {
  state.currentCreatorId = id == null ? null : String(id);
  state.currentFolderId = null;
  renderTeacherGames();
}

function openFolder(id) {
  if (!id) {
    state.currentFolderId = null;
    renderTeacherGames();
    return;
  }
  const folder = folderById(id);
  if (!folder) return;
  state.currentCreatorId = folderCreatorId(folder) || '__unassigned__';
  state.currentFolderId = String(folder.id);
  renderTeacherGames();
}

function openCreatorDialog(creator = null) {
  const color = normalizeCreatorColor(creator?.color || '#6f83ff');
  modal(`
    <p class="eyebrow">Creator</p>
    <h3>${creator ? 'Creator bearbeiten' : 'Neuen Creator erstellen'}</h3>
    <label class="field-label">Name</label>
    <input id="creator-dialog-name" class="text-input" maxlength="80" value="${escapeHtml(creator?.name || '')}" placeholder="z. B. Lars">
    <label class="field-label creator-color-label-v4">Farbe</label>
    <div class="creator-color-picker-v4">
      <input id="creator-dialog-color" type="color" value="${color}">
      <span>Diese Farbe wird für den Creator und seine Ordner verwendet.</span>
    </div>
    <div class="modal-actions">
      ${creator ? `<button class="btn danger-btn" data-action="creator-delete" data-creator-id="${creator.id}">Creator löschen</button>` : ''}
      <button class="btn" data-modal="close">Abbrechen</button>
      <button class="btn primary" data-action="creator-save" data-creator-id="${creator?.id || ''}">Speichern</button>
    </div>`, false, false);
  setTimeout(() => $('#creator-dialog-name')?.focus(), 20);
}

async function saveCreatorDialog(creatorId = '') {
  const name = $('#creator-dialog-name')?.value.trim() || '';
  const color = normalizeCreatorColor($('#creator-dialog-color')?.value);
  if (!name) throw new Error('Bitte einen Creator Namen eingeben.');

  const creator = creatorId
    ? await teacherCreatorUpdate(creatorId, name, color)
    : await teacherCreatorEnsure(name, color);

  const [games, folders, creators] = await Promise.all([teacherGamesList(), teacherFoldersList(), teacherCreatorsList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.teacherCreators = creators || [];
  state.currentCreatorId = creator?.id || creatorId || null;
  state.currentFolderId = null;
  closeModal(true);
  renderTeacherGames();
  toast(`Creator «${creator?.name || name}» gespeichert.`);
}

async function deleteCreator(creatorId) {
  const creator = creatorById(creatorId);
  if (!creator) return;
  if (!confirm(`Creator «${creator.name}» wirklich löschen? Ordner und Spiele bleiben erhalten und werden zu «Ohne Creator» verschoben.`)) return;
  await teacherCreatorDelete(creatorId);
  const [games, folders, creators] = await Promise.all([teacherGamesList(), teacherFoldersList(), teacherCreatorsList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.teacherCreators = creators || [];
  state.currentCreatorId = null;
  state.currentFolderId = null;
  closeModal(true);
  renderTeacherGames();
  toast('Creator gelöscht. Ordner und Spiele bleiben erhalten.');
}

function openFolderDialog(folder = null) {
  const currentCreatorId = folder?.creatorId || creatorIdValue(state.currentCreatorId);
  const creatorOptions = [
    '<option value="">Ohne Creator</option>',
    ...state.teacherCreators.map(creator => `<option value="${creator.id}"${String(creator.id) === String(currentCreatorId) ? ' selected' : ''}>${escapeHtml(creator.name)}</option>`)
  ].join('');

  modal(`
    <p class="eyebrow">Ordner</p>
    <h3>${folder ? 'Ordner bearbeiten' : 'Neuen Ordner erstellen'}</h3>
    <label class="field-label">Name</label>
    <input id="folder-dialog-name" class="text-input" maxlength="80" value="${escapeHtml(folder?.name || '')}" placeholder="z. B. VWL">
    <label class="field-label creator-color-label-v4">Creator</label>
    <select id="folder-dialog-creator" class="text-input">${creatorOptions}</select>
    <div class="modal-actions">
      <button class="btn" data-modal="close">Abbrechen</button>
      <button class="btn primary" data-action="folder-save" data-folder-id="${folder?.id || ''}">Speichern</button>
    </div>`, false, false);
  setTimeout(() => $('#folder-dialog-name')?.focus(), 20);
}

async function saveFolderDialog(folderId = '') {
  const name = $('#folder-dialog-name')?.value.trim() || '';
  const creatorId = $('#folder-dialog-creator')?.value || '';
  if (!name) throw new Error('Bitte einen Ordnernamen eingeben.');

  const folder = await teacherFolderSave(folderId || null, name, creatorId || null);
  const [games, folders, creators] = await Promise.all([teacherGamesList(), teacherFoldersList(), teacherCreatorsList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.teacherCreators = creators || [];
  state.currentCreatorId = folder?.creatorId || '__unassigned__';
  state.currentFolderId = folder?.id || folderId || null;
  closeModal(true);
  renderTeacherGames();
  toast(`Ordner «${folder?.name || name}» gespeichert.`);
}

async function deleteFolder(folderId) {
  const folder = folderById(folderId);
  if (!folder) return;
  const count = state.teacherGames.filter(game => gameFolderId(game) === String(folderId)).length;
  const extra = count ? ` Die ${count} ${count === 1 ? 'Spiel' : 'Spiele'} bleiben beim gleichen Creator, aber ohne Ordner.` : '';
  if (!confirm(`Ordner «${folder.name}» wirklich löschen?${extra}`)) return;
  await teacherFolderDelete(folderId);
  const [games, folders, creators] = await Promise.all([teacherGamesList(), teacherFoldersList(), teacherCreatorsList()]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.teacherCreators = creators || [];
  state.currentCreatorId = folderCreatorId(folder) || '__unassigned__';
  state.currentFolderId = null;
  renderTeacherGames();
  toast('Ordner gelöscht. Spiele bleiben erhalten.');
}

function showMoveGame(game) {
  const choices = [];

  choices.push(`<button class="folder-choice-v3${!gameCreatorId(game) && !gameFolderId(game) ? ' active' : ''}" data-action="move-game-structure" data-id="${game.id}" data-creator-id="" data-folder-id=""><span>🗂️</span><strong>Ohne Creator</strong><small>Ohne Ordner</small></button>`);

  for (const folder of state.teacherFolders.filter(folder => !folderCreatorId(folder))) {
    choices.push(`<button class="folder-choice-v3${gameFolderId(game) === String(folder.id) ? ' active' : ''}" data-action="move-game-structure" data-id="${game.id}" data-creator-id="" data-folder-id="${folder.id}"><span>📁</span><strong>${escapeHtml(folder.name)}</strong><small>Ohne Creator</small></button>`);
  }

  for (const creator of state.teacherCreators) {
    const activeRoot = gameCreatorId(game) === String(creator.id) && !gameFolderId(game);
    choices.push(`<button class="folder-choice-v3${activeRoot ? ' active' : ''}" data-action="move-game-structure" data-id="${game.id}" data-creator-id="${creator.id}" data-folder-id=""><span style="color:${normalizeCreatorColor(creator.color)}">●</span><strong>${escapeHtml(creator.name)}</strong><small>Ohne Ordner</small></button>`);
    for (const folder of state.teacherFolders.filter(item => folderCreatorId(item) === String(creator.id))) {
      choices.push(`<button class="folder-choice-v3${gameFolderId(game) === String(folder.id) ? ' active' : ''}" data-action="move-game-structure" data-id="${game.id}" data-creator-id="${creator.id}" data-folder-id="${folder.id}"><span>📁</span><strong>${escapeHtml(folder.name)}</strong><small>${escapeHtml(creator.name)}</small></button>`);
    }
  }

  modal(`
    <p class="eyebrow">Spiel verschieben</p>
    <h3>${escapeHtml(game.title)}</h3>
    <p class="section-muted">Wähle einen Creator Bereich oder einen Ordner.</p>
    <div class="folder-choice-grid-v3">${choices.join('')}</div>
    <div class="modal-actions"><button class="btn" data-modal="close">Abbrechen</button></div>`, false, true);
}

async function moveGame(game, creatorId, folderId) {
  await teacherGameMoveStructure(game.id, creatorId || null, folderId || null);
  state.teacherGames = await teacherGamesList();
  closeModal(true);
  renderTeacherGames();
  const creator = creatorById(creatorId);
  const folder = folderById(folderId);
  toast(folder ? `Spiel nach «${folder.name}» verschoben.` : creator ? `Spiel zu «${creator.name}» verschoben.` : 'Spiel zu «Ohne Creator» verschoben.');
}

'''

t = t[:start] + new_explorer + t[end:]

old = """async function duplicateGame(game) {
  const copy = {
    id: crypto.randomUUID(),
    title: `${game.title} Kopie`,
    folder: game.folder || '',
    questions: game.questions.map(question => ({ ...question, id: crypto.randomUUID(), wrong: [...question.wrong] }))
  };
  await teacherGameSave(copy);
  toast('Spiel dupliziert.');
  await openTeacherHome();
}"""
new = """async function duplicateGame(game) {
  const copy = {
    id: crypto.randomUUID(),
    title: `${game.title} Kopie`,
    creatorId: game.creatorId || null,
    folderId: game.folderId || null,
    questions: game.questions.map(question => ({ ...question, id: crypto.randomUUID(), wrong: [...question.wrong] }))
  };
  await teacherGameSave(copy);
  toast('Spiel dupliziert.');
  await openTeacherHome();
}"""
t = replace_once(t, old, new, "duplicateGame")

editor_start = t.index("function openEditor(game = null) {")
editor_end = t.index("function bindImportTabs()", editor_start)
if editor_start < 0 or editor_end < 0:
    raise SystemExit("Could not find editor block")

editor_block = r'''function creatorByName(name) {
  const value = String(name || '').trim().toLocaleLowerCase('de-CH');
  return state.teacherCreators.find(creator => String(creator.name || '').trim().toLocaleLowerCase('de-CH') === value);
}

function refreshEditorFolderOptions(selectedFolderId = '') {
  const select = $('#editor-game-folder-select');
  if (!select) return;
  const creator = creatorByName($('#editor-game-creator')?.value);
  const creatorId = creator?.id || '';
  const folders = state.teacherFolders.filter(folder => folderCreatorId(folder) === String(creatorId));
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Ohne Ordner';
  select.append(empty);
  for (const folder of folders.slice().sort((a,b) => String(a.name).localeCompare(String(b.name),'de-CH',{sensitivity:'base'}))) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    select.append(option);
  }
  if ([...select.options].some(option => option.value === String(selectedFolderId || ''))) {
    select.value = String(selectedFolderId || '');
  }
}

function syncEditorCreatorFields() {
  const input = $('#editor-game-creator');
  const color = $('#editor-creator-color');
  const creator = creatorByName(input?.value);
  if (creator && color) color.value = normalizeCreatorColor(creator.color);
  refreshEditorFolderOptions();
}

function openEditor(game = null) {
  state.editorId = game?.id || null;
  state.editorCreatedAt = game?.createdAt || null;
  state.editorQuestions = (game?.questions || []).map(question => ({
    ...question,
    id: question.id || crypto.randomUUID(),
    wrong: [...(question.wrong || [])]
  }));
  state.importMode = 'simple';
  $('#editor-v3-title').textContent = game ? 'Spiel bearbeiten' : 'Neues Spiel';
  $('#editor-game-title').value = game?.title || '';

  const currentCreator = game
    ? creatorById(game.creatorId)
    : creatorById(creatorIdValue(state.currentCreatorId));
  $('#editor-game-creator').value = game?.creatorName || currentCreator?.name || '';
  $('#editor-creator-color').value = normalizeCreatorColor(game?.creatorColor || currentCreator?.color || '#6f83ff');

  const creatorSuggestions = $('#editor-creator-suggestions');
  creatorSuggestions.replaceChildren();
  for (const creator of state.teacherCreators.slice().sort((a,b) => String(a.name).localeCompare(String(b.name),'de-CH',{sensitivity:'base'}))) {
    const option = document.createElement('option');
    option.value = creator.name;
    creatorSuggestions.append(option);
  }

  refreshEditorFolderOptions(game?.folderId || state.currentFolderId || '');
  $('#editor-game-creator').oninput = syncEditorCreatorFields;
  $('#editor-game-creator').onchange = syncEditorCreatorFields;

  $('#editor-import-simple').value = '';
  $('#editor-import-csv').value = '';
  $('#editor-import-json').value = '';
  $$('[data-import-v3]').forEach(button => button.classList.toggle('active', button.dataset.importV3 === 'simple'));
  $$('[data-import-pane-v3]').forEach(pane => pane.classList.toggle('active', pane.dataset.importPaneV3 === 'simple'));
  bindImportTabs();
  renderEditorQuestions();
  showScreen('editor-v3');
}

'''
t = t[:editor_start] + editor_block + t[editor_end:]

old = """async function saveEditor() {
  syncEditorQuestions();
  const title = $('#editor-game-title').value.trim();
  const folder = $('#editor-game-folder').value.trim();
  if (!title) throw new Error('Bitte gib dem Spiel einen Titel.');
  const questions = validateQuestions(state.editorQuestions);
  if (!questions.length) throw new Error('Das Spiel braucht mindestens eine vollständige Frage.');
  await teacherGameSave({
    id: state.editorId || crypto.randomUUID(),
    createdAt: state.editorCreatedAt || undefined,
    title,
    folder,
    questions
  });
  toast('Spiel gespeichert.');
  await openTeacherHome();
}"""
new = """async function saveEditor() {
  syncEditorQuestions();
  const title = $('#editor-game-title').value.trim();
  const creatorName = $('#editor-game-creator').value.trim();
  const creatorColorValue = normalizeCreatorColor($('#editor-creator-color').value);
  const folderId = $('#editor-game-folder-select').value || null;
  if (!title) throw new Error('Bitte gib dem Spiel einen Titel.');
  const questions = validateQuestions(state.editorQuestions);
  if (!questions.length) throw new Error('Das Spiel braucht mindestens eine vollständige Frage.');

  let creatorId = null;
  if (creatorName) {
    const creator = await teacherCreatorEnsure(creatorName, creatorColorValue);
    creatorId = creator?.id || null;
  }

  await teacherGameSave({
    id: state.editorId || crypto.randomUUID(),
    createdAt: state.editorCreatedAt || undefined,
    title,
    creatorId,
    folderId,
    questions
  });
  toast('Spiel gespeichert.');
  await openTeacherHome();
}"""
t = replace_once(t, old, new, "saveEditor")

old = """async function openDashboard() {
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
}"""
new = """async function openDashboard() {
  stopDashboardPolling();
  if (!state.teacherGames.length) {
    const [games, folders, creators] = await Promise.all([teacherGamesList(), teacherFoldersList(), teacherCreatorsList()]);
    state.teacherGames = games || [];
    state.teacherFolders = folders || [];
    state.teacherCreators = creators || [];
  }

  const rows = state.teacherGames.map(game => {
    const creator = creatorById(game.creatorId);
    const folder = folderById(game.folderId);
    const meta = [creator?.name || 'Ohne Creator', folder?.name].filter(Boolean).join(' · ');
    const color = normalizeCreatorColor(game.creatorColor || creator?.color || '#69739f');
    return `
      <div class="history-row analysis-row-v4">
        <div><strong>${escapeHtml(game.title || 'Spiel')}</strong><br><small><i style="background:${color}"></i>${escapeHtml(meta)}</small></div>
        <span>${Array.isArray(game.questions) ? game.questions.length : 0} Fragen</span>
        <button class="btn primary small" data-action="analysis-game" data-id="${game.id}">Analyse öffnen</button>
      </div>`;
  }).join('');

  modal(`
    <p class="eyebrow">Live Analyse</p>
    <h3>Spiel auswählen</h3>
    <p class="section-muted">Wähle das Spiel, dessen Lernstände und Ergebnisse du sehen möchtest.</p>
    <div class="history-list">${rows || '<div class="empty-state"><p>Noch keine Spiele vorhanden.</p></div>'}</div>
    <div class="modal-actions"><button class="btn" data-modal="close">Schliessen</button></div>`, false, true);
}"""
t = replace_once(t, old, new, "openDashboard")
t = t.replace("  $('#host-join-code').textContent = session.joinCode || '------';\n", "", 1)

p.write_text(t, encoding="utf-8")

# ---------------- access layer ----------------
p = Path("js/access-ui-v4.js")
t = p.read_text(encoding="utf-8")
t = t.replace("backend-v3.js?v=20260927-access5", "backend-v3.js?v=20261002-creators1")
p.write_text(t, encoding="utf-8")

# ---------------- bootstrap ----------------
p = Path("js/app-v3.js")
t = p.read_text(encoding="utf-8")
t = t.replace("app-core-v3.js?v=20260927-access4", "app-core-v3.js?v=20261002-creators1")
t = t.replace("access-ui-v4.js?v=20261002-access6", "access-ui-v4.js?v=20261002-creators1")
t = t.replace("access-ui-v4.js?v=20260927-access5", "access-ui-v4.js?v=20261002-creators1")
p.write_text(t, encoding="utf-8")

# ---------------- index ----------------
p = Path("index.html")
t = p.read_text(encoding="utf-8")
import re
t = re.sub(r'\s*<script type="importmap">[\s\S]*?</script>', '', t, count=1)
t = t.replace(
    '<button class="nav-card" data-action="teacher-show-games"><strong>🎯 Meine Spiele</strong><span>Beamer, Spielcode, Bearbeiten, Duplizieren und Löschen.</span></button>',
    '<button class="nav-card" data-action="teacher-show-games"><strong>🎯 Meine Spiele</strong><span>Creator, Ordner, Beamer, Bearbeiten, Duplizieren und Freigaben.</span></button>'
)
t = t.replace(
    '<div class="teacher-actions"><button class="btn" data-action="teacher-new-folder">📁 Neuer Ordner</button><button class="btn primary" data-action="teacher-new-game">Neues Spiel</button></div>',
    '<div class="teacher-actions"><button class="btn" data-action="teacher-new-creator">＋ Creator</button><button class="btn" data-action="teacher-new-folder">📁 Neuer Ordner</button><button class="btn primary" data-action="teacher-new-game">Neues Spiel</button></div>'
)
old = '''            <label class="field-label folder-field-label" for="editor-game-folder">Ordner <span class="section-muted">optional</span></label>
            <input id="editor-game-folder" class="text-input" type="text" maxlength="80" list="editor-folder-suggestions" placeholder="z. B. VWL, Recht oder Prüfungen">
            <datalist id="editor-folder-suggestions"></datalist>
            <p class="folder-field-hint">Bestehenden Ordner auswählen oder einen neuen Namen eingeben. Ohne Eintrag bleibt das Spiel unter «Ohne Ordner».</p>'''
new = '''            <label class="field-label folder-field-label" for="editor-game-creator">Creator <span class="section-muted">optional</span></label>
            <input id="editor-game-creator" class="text-input" type="text" maxlength="80" list="editor-creator-suggestions" placeholder="Bestehenden Creator wählen oder neuen Namen eingeben">
            <datalist id="editor-creator-suggestions"></datalist>
            <div class="editor-creator-color-v4">
              <label for="editor-creator-color">Creator Farbe</label>
              <input id="editor-creator-color" type="color" value="#6f83ff">
            </div>
            <p class="folder-field-hint">Bei einem neuen Namen wird beim Speichern automatisch ein neuer Creator angelegt.</p>

            <label class="field-label folder-field-label" for="editor-game-folder-select">Ordner <span class="section-muted">optional</span></label>
            <select id="editor-game-folder-select" class="text-input"><option value="">Ohne Ordner</option></select>'''
t = replace_once(t, old, new, "editor creator fields")
t = t.replace(
    '            <label>Spielcode<input id="student-code" class="text-input code-input" maxlength="64" autocomplete="off" placeholder="CODE"></label>',
    '            <input id="student-code" type="hidden" value="">'
)
t = t.replace(
    '            <button class="btn primary" type="submit">Beitreten</button>',
    '            <button class="btn primary hidden" type="submit" aria-hidden="true" tabindex="-1">Beitreten</button>'
)
t = t.replace('<aside class="host-code-card">', '<aside class="host-code-card hidden">', 1)
t = t.replace('src="js/app-v3.js?v=20261002-access6"', 'src="js/app-v3.js?v=20261002-creators1"')
p.write_text(t, encoding="utf-8")

# ---------------- styles ----------------
p = Path("styles-v3.css")
t = p.read_text(encoding="utf-8")
t += r'''

/* Creator workspaces */
.creator-grid-v4{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.creator-card-v4{position:relative;border:1px solid var(--creator-color);border-radius:22px;overflow:hidden;background:linear-gradient(145deg,rgba(20,25,90,.96),#07092e 72%);box-shadow:inset 0 3px 0 var(--creator-color),0 12px 32px rgba(0,0,25,.18)}
.creator-open-v4{width:100%;min-height:150px;border:0;background:linear-gradient(135deg,var(--creator-color),transparent 58%);background-blend-mode:soft-light;color:#fff;text-align:left;padding:20px 20px 52px;cursor:pointer;display:flex;align-items:center;gap:15px}
.creator-open-v4:hover{filter:brightness(1.08)}
.creator-avatar-v4{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;flex:0 0 auto;background:var(--creator-color);color:#fff;font-size:25px;font-weight:1000;box-shadow:0 0 24px var(--creator-color)}
.creator-copy-v4{display:grid;gap:6px;min-width:0}.creator-copy-v4 strong{font-size:21px;overflow-wrap:anywhere}.creator-copy-v4 small{color:#d1d6f5}
.creator-edit-v4{position:absolute;right:14px;bottom:14px}
.creator-toolbar-v4{border-left:4px solid var(--creator-color,#69739f);padding-left:12px}.creator-path-v4{display:flex;align-items:center;gap:9px;flex:1}.creator-path-v4 i,.game-creator-line-v4 i,.analysis-row-v4 small i{width:10px;height:10px;border-radius:999px;display:inline-block;background:var(--creator-color,#69739f);box-shadow:0 0 10px var(--creator-color,#69739f)}
.creator-path-v4 i{width:14px;height:14px}.creator-path-v4 strong{font-size:15px}
.folder-card-v4{position:relative;border:1px solid var(--creator-color);border-radius:20px;overflow:hidden;background:linear-gradient(145deg,rgba(17,22,82,.95),#07092d 75%);box-shadow:inset 0 3px 0 var(--creator-color)}
.folder-open-v4{width:100%;min-height:138px;border:0;background:linear-gradient(135deg,var(--creator-color),transparent 68%);background-blend-mode:soft-light;color:#fff;padding:18px 18px 50px;text-align:left;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start}
.folder-open-v4:hover{filter:brightness(1.08)}.folder-open-v4 strong{font-size:18px;margin-top:12px}.folder-open-v4 small{color:#d1d6f5;margin-top:5px}
.folder-card-v4>.btn{position:absolute;right:12px;bottom:12px}.folder-icon-v4{font-size:42px;line-height:.8;color:var(--creator-color);filter:drop-shadow(0 0 8px var(--creator-color));transform:skewX(-7deg)}
.game-card-v3{border-top-color:var(--creator-color,#6e84ff)}.game-creator-line-v4{display:flex;align-items:center;gap:7px;color:#aeb8ef;font-size:11px;font-weight:800}.game-creator-line-v4 i{background:var(--creator-color,#69739f)}
.creator-color-label-v4{margin-top:15px}.creator-color-picker-v4,.editor-creator-color-v4{display:flex;align-items:center;gap:12px;margin-top:7px}.creator-color-picker-v4 input,.editor-creator-color-v4 input{width:58px;height:42px;border:0;background:transparent;padding:0;cursor:pointer}.creator-color-picker-v4 span,.editor-creator-color-v4 label{color:var(--v3-muted);font-size:12px}
.editor-creator-color-v4{margin:9px 0 2px}.editor-creator-color-v4 label{font-weight:800}
.analysis-row-v4 small{display:inline-flex;align-items:center;gap:7px}.analysis-row-v4 small i{box-shadow:none}
#screen-host .host-code-card{display:none!important}#screen-host .host-layout{grid-template-columns:minmax(0,1fr)!important}
@media(max-width:720px){.creator-grid-v4{grid-template-columns:1fr}.creator-open-v4{min-height:125px}}
'''
p.write_text(t, encoding="utf-8")
