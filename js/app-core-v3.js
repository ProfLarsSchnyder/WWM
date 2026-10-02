import { parseSimpleText, parseCSV, parseJSON, validateQuestions, shuffleAnswers } from './importer.js';
import {
  playCue, playCueSegment, startLoop, stopAll, stopLoop, stopForeground,
  pauseLoop, resumeLoop, setAudioEnabled, isAudioEnabled,
  questionTrack
} from './audio.js';
import {
  isBackendConfigured, teacherToken, teacherLogin, teacherLogout,
  teacherGamesList, teacherGameSave, teacherGameDelete, teacherTrashList, teacherGameRestore, teacherGameMove,
  teacherFoldersList, teacherFolderCreate, teacherFolderDelete,
  teacherCreatorsList, teacherCreatorEnsure, teacherCreatorUpdate, teacherCreatorDelete,
  teacherFolderSave, teacherGameMoveStructure,
  teacherStopHost, teacherDashboardGame, teacherResetAnalysis, teacherSessionHistory,
  studentJoin, studentSession, studentGetQuestion, studentSubmitAnswer,
  studentUseJoker, studentHeartbeat, studentQuit, clearStudentSession,
  friendlyBackendError
} from './backend-v3.js?v=20261002-trash1';

const money = ["50 €","100 €","200 €","300 €","500 €","1'000 €","2'000 €","4'000 €","8'000 €","16'000 €","32'000 €","64'000 €","125'000 €","500'000 €","1'000'000 €"];
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const state = {
  teacherGames: [],
  teacherFolders: [],
  teacherCreators: [],
  currentCreatorId: null,
  currentFolderId: null,
  editorId: null,
  editorCreatedAt: null,
  editorQuestions: [],
  importMode: 'simple',
  dashboardTimer: null,
  dashboardGameId: null,
  heartbeatTimer: null,
  playSeq: 0,
  play: null,
  jokerBusy: false,
  lastAnswerResult: null
};

bind();
showScreen('mode');

function bind() {
  document.addEventListener('click', async event => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      event.preventDefault();
      try { await handleAction(actionButton.dataset.action, actionButton); }
      catch (error) { handleError(error); }
      return;
    }

    const modalButton = event.target.closest('[data-modal]');
    if (modalButton) {
      event.preventDefault();
      if (modalButton.dataset.modal === 'close') closeModal();
      if (modalButton.dataset.modal === 'close-joker') await closeJoker();
      return;
    }

    const answer = event.target.closest('.answer[data-key]');
    if (answer) selectAnswer(answer.dataset.key);
  });

  $('#teacher-login-form').addEventListener('submit', onTeacherLogin);
  $('#student-login-form').addEventListener('submit', onStudentJoin);
  $('#lock-answer').addEventListener('click', lockAnswer);
  $('#next-question').addEventListener('click', nextQuestion);
  $$('[data-joker]').forEach(button => button.addEventListener('click', () => useJoker(button.dataset.joker)));

  $('#modal').addEventListener('click', event => {
    if (event.target === $('#modal') && $('#modal').dataset.persistent !== '1') closeModal();
  });

  document.addEventListener('keydown', event => {
    if ($('#screen-game').classList.contains('active') && $('#modal').classList.contains('hidden')) {
      if (['1','2','3','4'].includes(event.key) && !state.play?.locked && !state.jokerBusy) {
        const key = ['A','B','C','D'][Number(event.key) - 1];
        document.querySelector(`.answer[data-key="${key}"]`)?.click();
      }
      if (event.key === 'Enter') {
        if (!state.play?.locked && state.play?.selected) lockAnswer();
        else if (state.play?.locked && !$('#next-question').classList.contains('hidden')) nextQuestion();
      }
      const key = event.key.toLowerCase();
      if (key === 'f') useJoker('fifty');
      if (key === 'p') useJoker('audience');
      if (key === 't') useJoker('phone');
      if (key === 'l') useJoker('teacher');
    }

    if ($('#screen-game-intro').classList.contains('active') && event.key === 'Enter') beginQuestions();
  });
}

async function handleAction(action, button) {
  if (action === 'open-teacher-login') return openTeacherLogin();
  if (action === 'open-student-login') return openStudentLogin();
  if (action === 'back-to-mode') return backToMode();
  if (action === 'teacher-logout') return logoutTeacher();
  if (action === 'teacher-refresh' || action === 'teacher-show-games') return openTeacherHome();
  if (action === 'teacher-new-game') return openEditor();
  if (action === 'teacher-new-creator') return openCreatorDialog();
  if (action === 'teacher-new-folder') return openFolderDialog();
  if (action === 'creator-up') return openCreator(null);
  if (action === 'folder-up') return openFolder(null);
  if (action === 'teacher-open-dashboard') return openDashboard();
  if (action === 'analysis-picker') return openDashboard();
  if (action === 'teacher-history') return openHistory();
  if (action === 'teacher-trash') return openTrash();
  if (action === 'editor-cancel') return openTeacherHome();
  if (action === 'editor-save') return saveEditor();
  if (action === 'editor-example') return loadEditorExample();
  if (action === 'editor-import') return importEditorQuestions();
  if (action === 'editor-add-question') return addEditorQuestion();
  if (action === 'host-refresh') return refreshDashboard();
  if (action === 'analysis-reset') return resetCurrentAnalysis();
  if (action === 'host-code-big') return showHostCode();
  if (action === 'host-stop') return stopHosting();
  if (action === 'host-back') return openTeacherHome();
  if (action === 'begin-questions') return beginQuestions();
  if (action === 'cancel-game-intro') return cancelGameIntro();
  if (action === 'toggle-audio') return toggleAudio();
  if (action === 'fullscreen') return toggleFullscreen();
  if (action === 'quit-game') return quitCurrentGame();
  if (action === 'result-primary') return resultPrimary();

  if (action === 'game-beamer') {
    const game = gameById(button.dataset.id);
    if (game) startBeamer(game);
  }
  if (action === 'game-code') {
    const game = gameById(button.dataset.id);
    if (game) showGameCode(game);
  }
  if (action === 'creator-open') return openCreator(button.dataset.creatorId || '__unassigned__');
  if (action === 'creator-edit') {
    const creator = creatorById(button.dataset.creatorId);
    if (creator) return openCreatorDialog(creator);
  }
  if (action === 'creator-save') return saveCreatorDialog(button.dataset.creatorId || '');
  if (action === 'creator-delete') return deleteCreator(button.dataset.creatorId || '');
  if (action === 'folder-open') return openFolder(button.dataset.folderId || '');
  if (action === 'folder-edit') {
    const folder = folderById(button.dataset.folderId);
    if (folder) return openFolderDialog(folder);
  }
  if (action === 'folder-save') return saveFolderDialog(button.dataset.folderId || '');
  if (action === 'folder-delete') return deleteFolder(button.dataset.folderId || '');
  if (action === 'game-move') {
    const game = gameById(button.dataset.id);
    if (game) showMoveGame(game);
  }
  if (action === 'move-game-structure') {
    const game = gameById(button.dataset.id);
    if (game) await moveGame(game, button.dataset.creatorId || '', button.dataset.folderId || '');
  }
  if (action === 'analysis-game') {
    const game = gameById(button.dataset.id);
    if (game) await openGameDashboard(game);
  }
  if (action === 'game-edit') {
    const game = gameById(button.dataset.id);
    if (game) openEditor(game);
  }
  if (action === 'game-duplicate') {
    const game = gameById(button.dataset.id);
    if (game) await duplicateGame(game);
  }
  if (action === 'game-delete') {
    const game = gameById(button.dataset.id);
    if (game) await deleteGame(game);
  }
  if (action === 'trash-restore') return restoreTrashGame(button.dataset.id || '');
}

function showScreen(name) {
  $$('.screen').forEach(screen => screen.classList.remove('active'));
  $(`#screen-${name}`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name !== 'host') stopDashboardPolling();
}

function toast(message, error = false) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 3500);
}

function handleError(error, { student = false } = {}) {
  console.error(error);
  toast(friendlyBackendError(error, { student }), true);
}

function openTeacherLogin() {
  stopAll();
  $('#teacher-pin').value = '';
  $('#teacher-login-error').textContent = '';
  showScreen('teacher-login');
  setTimeout(() => $('#teacher-pin').focus(), 30);
}

function openStudentLogin() {
  stopAll();
  $('#student-login-error').textContent = '';
  showScreen('student-login');
  setTimeout(() => $('#student-name').focus(), 30);
}

function backToMode() {
  stopAll();
  stopHeartbeat();
  state.play = null;
  state.jokerBusy = false;
  showScreen('mode');
}

async function onTeacherLogin(event) {
  event.preventDefault();
  const pin = $('#teacher-pin').value.trim();
  const errorBox = $('#teacher-login-error');
  errorBox.textContent = '';
  if (!pin) return errorBox.textContent = 'Bitte Passwort eingeben.';
  try {
    await teacherLogin(pin);
    await openTeacherHome();
  } catch (error) {
    errorBox.textContent = friendlyBackendError(error);
  }
}

async function logoutTeacher() {
  stopDashboardPolling();
  try { await teacherLogout(); } catch {}
  backToMode();
}

async function openTeacherHome() {
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
}

function gameById(id) {
  return state.teacherGames.find(game => game.id === id);
}

function creatorById(id) {
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

function formatDate(value) {
  if (!value) return 'heute';
  try { return new Date(value).toLocaleDateString('de-CH'); }
  catch { return ''; }
}

async function duplicateGame(game) {
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
}

async function deleteGame(game) {
  if (!confirm(`«${game.title}» in den Papierkorb verschieben? Bereits gestartete Lernende können das Spiel weiterhin fertigspielen.`)) return;
  await teacherGameDelete(game.id);
  toast('Spiel in den Papierkorb verschoben.');
  await openTeacherHome();
}

async function openTrash() {
  const items = await teacherTrashList();
  const rows = (items || []).map(item => {
    const meta = [item.creatorName || 'Ohne Creator', item.folderName].filter(Boolean).join(' · ');
    const deleted = item.deletedAt ? new Date(item.deletedAt).toLocaleString('de-CH') : '';
    const sameTitleActive = state.teacherGames.some(game =>
      String(game.title || '').trim().toLocaleLowerCase('de-CH') ===
      String(item.title || '').trim().toLocaleLowerCase('de-CH')
    );
    return `
      <div class="trash-row-v4">
        <div class="trash-main-v4">
          <strong>${escapeHtml(item.title || 'Spiel')}</strong>
          <small>${escapeHtml(meta)} · ${Number(item.questionCount || 0)} Fragen${deleted ? ` · Papierkorb seit ${escapeHtml(deleted)}` : ''}</small>
          ${sameTitleActive ? '<span class="trash-warning-v4">Es gibt bereits ein aktives Spiel mit demselben Namen.</span>' : ''}
        </div>
        <button class="btn primary" data-action="trash-restore" data-id="${item.id}" data-title="${escapeHtml(item.title || 'Spiel')}">Wiederherstellen</button>
      </div>`;
  }).join('');

  modal(`
    <p class="eyebrow">Papierkorb</p>
    <h3>Gelöschte Spiele</h3>
    <p class="section-muted">Spiele werden nie endgültig gelöscht. Du kannst sie jederzeit wiederherstellen.</p>
    <div class="trash-list-v4">${rows || '<div class="empty-state"><p>Der Papierkorb ist leer.</p></div>'}</div>
    <div class="modal-actions"><button class="btn" data-modal="close">Schliessen</button></div>`, false, true);
}

async function restoreTrashGame(gameId) {
  if (!gameId) return;

  const trash = await teacherTrashList();
  const item = (trash || []).find(entry => String(entry.id) === String(gameId));
  const sameTitleActive = item && state.teacherGames.some(game =>
    String(game.title || '').trim().toLocaleLowerCase('de-CH') ===
    String(item.title || '').trim().toLocaleLowerCase('de-CH')
  );

  if (sameTitleActive) {
    const ok = confirm(`Es gibt bereits ein aktives Spiel namens «${item.title}». Das Spiel im Papierkorb ist eine andere gespeicherte Version. Trotzdem zusätzlich wiederherstellen?`);
    if (!ok) return;
  }

  await teacherGameRestore(gameId);

  const [games, folders, creators] = await Promise.all([
    teacherGamesList(),
    teacherFoldersList(),
    teacherCreatorsList()
  ]);
  state.teacherGames = games || [];
  state.teacherFolders = folders || [];
  state.teacherCreators = creators || [];

  renderTeacherGames();
  toast('Spiel wiederhergestellt.');
  await openTrash();
}

function creatorByName(name) {
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

function bindImportTabs() {
  $$('[data-import-v3]').forEach(button => {
    button.onclick = () => {
      state.importMode = button.dataset.importV3;
      $$('[data-import-v3]').forEach(item => item.classList.toggle('active', item === button));
      $$('[data-import-pane-v3]').forEach(pane => pane.classList.toggle('active', pane.dataset.importPaneV3 === state.importMode));
    };
  });
}

function syncEditorQuestions() {
  const cards = $$('.question-card-v3');
  if (!cards.length) return;
  state.editorQuestions = cards.map((card, index) => ({
    id: state.editorQuestions[index]?.id || crypto.randomUUID(),
    question: card.querySelector('[data-field="question"]').value.trim(),
    correct: card.querySelector('[data-field="correct"]').value.trim(),
    wrong: [0,1,2].map(i => card.querySelector(`[data-field="wrong${i}"]`).value.trim())
  }));
}

function renderEditorQuestions() {
  const box = $('#editor-question-list');
  box.replaceChildren();
  $('#editor-question-count').textContent = state.editorQuestions.length;

  state.editorQuestions.forEach((question, index) => {
    const card = document.createElement('article');
    card.className = 'question-card-v3';
    card.innerHTML = `
      <header>
        <strong>Frage ${index + 1}</strong>
        <div class="question-tools-v3">
          <button class="btn" type="button" data-q-action="up">↑</button>
          <button class="btn" type="button" data-q-action="down">↓</button>
          <button class="btn danger-btn" type="button" data-q-action="delete">×</button>
        </div>
      </header>
      <textarea data-field="question" placeholder="Frage"></textarea>
      <div class="answer-editor-grid">
        <label class="correct-field">Richtige Antwort<input data-field="correct" type="text"></label>
        <label>Falsch 1<input data-field="wrong0" type="text"></label>
        <label>Falsch 2<input data-field="wrong1" type="text"></label>
        <label>Falsch 3<input data-field="wrong2" type="text"></label>
      </div>`;
    card.querySelector('[data-field="question"]').value = question.question || '';
    card.querySelector('[data-field="correct"]').value = question.correct || '';
    [0,1,2].forEach(i => card.querySelector(`[data-field="wrong${i}"]`).value = question.wrong?.[i] || '');
    card.querySelectorAll('[data-q-action]').forEach(button => {
      button.onclick = () => {
        syncEditorQuestions();
        const action = button.dataset.qAction;
        if (action === 'delete') state.editorQuestions.splice(index, 1);
        if (action === 'up' && index > 0) [state.editorQuestions[index - 1], state.editorQuestions[index]] = [state.editorQuestions[index], state.editorQuestions[index - 1]];
        if (action === 'down' && index < state.editorQuestions.length - 1) [state.editorQuestions[index + 1], state.editorQuestions[index]] = [state.editorQuestions[index], state.editorQuestions[index + 1]];
        renderEditorQuestions();
      };
    });
    box.append(card);
  });
}

function addEditorQuestion() {
  syncEditorQuestions();
  state.editorQuestions.push({ id: crypto.randomUUID(), question: '', correct: '', wrong: ['', '', ''] });
  renderEditorQuestions();
  $('#editor-question-list').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function editorParsedQuestions() {
  if (state.importMode === 'simple') return parseSimpleText($('#editor-import-simple').value);
  if (state.importMode === 'csv') return parseCSV($('#editor-import-csv').value);
  return parseJSON($('#editor-import-json').value);
}

function importEditorQuestions() {
  const incoming = editorParsedQuestions();
  if (!incoming.length) throw new Error('Keine vollständigen Fragen erkannt.');
  syncEditorQuestions();
  const replace = !state.editorQuestions.length || confirm(`${incoming.length} Fragen erkannt. OK ersetzt die bisherigen Fragen, Abbrechen hängt sie an.`);
  state.editorQuestions = replace ? incoming : [...state.editorQuestions, ...incoming];
  renderEditorQuestions();
  toast(`${incoming.length} Fragen übernommen.`);
}

function loadEditorExample() {
  state.importMode = 'simple';
  $$('[data-import-v3]').forEach(button => button.classList.toggle('active', button.dataset.importV3 === 'simple'));
  $$('[data-import-pane-v3]').forEach(pane => pane.classList.toggle('active', pane.dataset.importPaneV3 === 'simple'));
  $('#editor-import-simple').value = `Was versteht man unter Inflation?\nAnstieg des allgemeinen Preisniveaus\nSinkende Arbeitslosigkeit\nSteigendes reales BIP\nSinkende Staatsausgaben\n\nWas ist ein Substitutionsgut zu Butter?\nMargarine\nBrot\nMilch\nSalz`;
}

async function saveEditor() {
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
}

function showGameCode(game) {
  const code = game.joinCode || '------';
  modal(`
    <div class="code-presenter-modal">
      <div class="code-presenter-label">Spielcode</div>
      <div class="code-presenter-code">${escapeHtml(code)}</div>
      <div class="code-presenter-title">${escapeHtml(game.title || 'Spiel')}</div>
      <div class="code-presenter-hint">Dieser Code bleibt dauerhaft gültig. Lernende können das Spiel jederzeit im Lernendenmodus starten.</div>
      <div class="modal-actions">
        <button class="btn" data-action="fullscreen">Vollbild</button>
        <button class="btn primary" data-modal="close">Schliessen</button>
      </div>
    </div>`, false, true);
}

function showHostCode() {
  const code = $('#host-join-code').textContent.trim() || '------';
  const title = $('#host-title').textContent.trim() || $('#host-game-name').textContent.trim() || 'Gehostetes Spiel';
  modal(`
    <div class="code-presenter-modal">
      <div class="code-presenter-label">Spielcode</div>
      <div class="code-presenter-code">${escapeHtml(code)}</div>
      <div class="code-presenter-title">${escapeHtml(title)}</div>
      <div class="code-presenter-hint">Lernendenmodus öffnen · Name und Klasse eingeben · Code verwenden</div>
      <div class="modal-actions">
        <button class="btn" data-action="fullscreen">Vollbild</button>
        <button class="btn primary" data-modal="close">Schliessen</button>
      </div>
    </div>`, false, true);
}

async function openDashboard() {
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
}

async function openGameDashboard(game) {
  closeModal(true);
  state.dashboardGameId = game.id;
  const dashboard = await teacherDashboardGame(game.id);
  showScreen('host');
  renderDashboard(dashboard);
  startDashboardPolling();
}

function startDashboardPolling() {
  stopDashboardPolling();
  state.dashboardTimer = window.setInterval(() => {
    if ($('#screen-host').classList.contains('active')) refreshDashboard().catch(error => handleError(error));
  }, 30000);
}

function stopDashboardPolling() {
  if (state.dashboardTimer) clearInterval(state.dashboardTimer);
  state.dashboardTimer = null;
}

async function refreshDashboard() {
  if (!state.dashboardGameId) return openDashboard();
  const data = await teacherDashboardGame(state.dashboardGameId);
  renderDashboard(data);
}

async function resetCurrentAnalysis() {
  if (!state.dashboardGameId) return;
  const game = gameById(state.dashboardGameId);
  const title = game?.title || 'dieses Spiel';
  if (!confirm(`Live Analyse für «${title}» zurücksetzen? Die bisherige Auswertung bleibt im Verlauf erhalten, die Live Analyse startet leer.`)) return;
  await teacherResetAnalysis(state.dashboardGameId);
  toast('Live Analyse zurückgesetzt.');
  await refreshDashboard();
}

function renderDashboard(data) {
  const session = data.session || {};
  const summary = data.summary || {};
  $('#host-game-name').textContent = session.title || 'Spielanalyse';
  $('#host-title').textContent = session.title || '';
  $('#metric-total').textContent = summary.total ?? 0;
  $('#metric-online').textContent = summary.online ?? 0;
  $('#metric-active').textContent = summary.active ?? 0;
  $('#metric-completed').textContent = summary.completed ?? 0;
  $('#metric-eliminated').textContent = summary.eliminated ?? 0;
  $('#metric-average').textContent = summary.averageQuestion ?? 0;
  $('#host-last-refresh').textContent = `Zuletzt ${new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  const body = $('#dashboard-participants');
  body.replaceChildren();
  const participants = data.participants || [];
  if (!participants.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="7" style="text-align:center;color:#aeb8ef;padding:28px">Noch keine Lernenden beigetreten.</td>';
    body.append(row);
  }

  for (const p of participants) {
    const used = p.jokersUsed || {};
    const usedCount = ['fifty','audience','phone','teacher'].filter(key => used[key]).length;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td></td><td></td>
      <td>${p.questionNumber || 0} / ${session.questionCount || 0}</td>
      <td>${p.correctCount ?? 0}</td>
      <td>${4 - usedCount} übrig</td>
      <td>${statusText(p.status)}</td>
      <td><span class="status-pill ${p.online ? 'online' : 'offline'}">${p.online ? 'online' : 'offline'}</span></td>`;
    row.children[0].textContent = p.name || '';
    row.children[1].textContent = p.class || '';
    body.append(row);
  }

  const questionBox = $('#dashboard-questions');
  questionBox.replaceChildren();
  for (const q of data.questions || []) {
    const rate = q.correctRate == null ? 0 : Number(q.correctRate);
    const card = document.createElement('article');
    card.className = 'qstat';
    card.innerHTML = `
      <div class="qstat-head"><strong>Frage ${q.number}</strong><span>${q.attempts} Antworten</span></div>
      <p></p>
      <div class="qstat-head"><span>${q.correct} richtig</span><span>${q.correctRate == null ? '–' : `${q.correctRate}%`}</span></div>
      <div class="rate-bar"><span style="width:${Math.max(0, Math.min(100, rate))}%"></span></div>`;
    card.querySelector('p').textContent = q.question || '';
    questionBox.append(card);
  }
}

function statusText(status) {
  if (status === 'active') return 'spielt';
  if (status === 'completed') return 'beendet';
  if (status === 'eliminated') return 'ausgeschieden';
  if (status === 'quit') return 'abgebrochen';
  return status || '';
}

async function stopHosting() {
  if (!confirm('Hosting wirklich beenden? Lernende können danach nicht mehr neu beitreten.')) return;
  await teacherStopHost();
  stopDashboardPolling();
  toast('Hosting beendet.');
  await openTeacherHome();
}

async function openHistory() {
  const items = await teacherSessionHistory();
  const rows = (items || []).map(item => `
    <div class="history-row">
      <div><strong>${escapeHtml(item.title || 'Spiel')}</strong><br><small>${new Date(item.startedAt).toLocaleString('de-CH')}</small></div>
      <span>${item.participants || 0} Teilnehmende</span>
      <span>${item.status === 'active' ? 'aktiv' : 'beendet'}</span>
    </div>`).join('');
  modal(`
    <p class="eyebrow">Lehrermodus</p>
    <h3>Vergangene Durchläufe</h3>
    <div class="history-list">${rows || '<div class="empty-state"><p>Noch keine Durchläufe.</p></div>'}</div>
    <div class="modal-actions"><button class="btn primary" data-modal="close">Schliessen</button></div>`, false, true);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
}

async function onStudentJoin(event) {
  event.preventDefault();
  const name = $('#student-name').value.trim();
  const className = $('#student-class').value.trim();
  const code = $('#student-code').value.trim().toUpperCase();
  const errorBox = $('#student-login-error');
  errorBox.textContent = '';
  if (!name || !className || !code) return errorBox.textContent = 'Bitte Name, Klasse und Spielcode eingeben.';

  try {
    clearStudentSession();
    const session = await studentJoin(code, name, className);
    startStudentIntro(session);
  } catch (error) {
    errorBox.textContent = friendlyBackendError(error, { student: true });
  }
}

function chooseQuestions(questions) {
  const copy = questions.map(q => ({ ...q, wrong: [...q.wrong] }));
  if (copy.length <= 15) return copy;
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 15);
}

function basePlayState(mode) {
  return {
    mode,
    index: 0,
    selected: null,
    locked: false,
    answers: [],
    finished: false,
    jokers: { fifty:false, audience:false, phone:false, teacher:false },
    questionStartedAt: performance.now()
  };
}

function startBeamer(game) {
  stopAll();
  stopHeartbeat();
  const play = basePlayState('beamer');
  Object.assign(play, { game, questions: chooseQuestions(game.questions), title: game.title, name: '' });
  state.play = play;
  prepareIntro({ title: game.title, student: false });
}

function startStudentIntro(session) {
  stopAll();
  const play = basePlayState('student');
  Object.assign(play, {
    title: session.title,
    name: session.studentName,
    className: session.className,
    questionCount: session.questionCount,
    index: session.currentQuestionIndex || 0
  });
  state.play = play;
  prepareIntro({ title: session.title, student: true, name: session.studentName, className: session.className });
}

function prepareIntro({ title, student, name = '', className = '' }) {
  const seq = ++state.playSeq;
  $('#intro-game-title').textContent = title || 'Bereit?';
  $('#intro-copy').textContent = '';
  $('#intro-student-chip').classList.toggle('hidden', !student);
  $('#contestant-label').classList.toggle('hidden', student);
  $('#contestant-name').classList.toggle('hidden', student);
  if (student) {
    $('#intro-student-chip').textContent = `${name} · ${className}`;
    $('#contestant-name').value = name;
  } else {
    $('#contestant-name').value = '';
    $('#intro-copy').textContent = 'Das Spiel kann jederzeit gestartet werden.';
  }
  $('#begin-questions').disabled = false;
  $('#begin-questions').classList.add('ready');
  showScreen('game-intro');
  if (!student) setTimeout(() => $('#contestant-name').focus(), 40);
  playCue('intro').then(() => {
    if (seq !== state.playSeq) return;
  });
}

async function beginQuestions() {
  if (!state.play) return;
  ++state.playSeq;
  stopAll();
  state.play.name = state.play.mode === 'beamer' ? ($('#contestant-name').value.trim() || 'Kandidat/in') : state.play.name;
  $('#game-title-display').textContent = state.play.title || 'Unterrichtsquiz';
  $('#contestant-display').textContent = state.play.mode === 'student' ? `${state.play.name} · ${state.play.className}` : state.play.name;
  $('#game-mode-badge').textContent = state.play.mode === 'student' ? 'Lernendenmodus' : 'Beamer Modus';
  $('#screen-game').dataset.mode = state.play.mode;
  $$('[data-joker]').forEach(button => button.classList.toggle('used', Boolean(state.play.jokers[button.dataset.joker])));
  showScreen('game');
  if (state.play.mode === 'student') startHeartbeat();
  await renderCurrentQuestion();
}

async function cancelGameIntro() {
  ++state.playSeq;
  stopAll();
  if (state.play?.mode === 'student') {
    try { await studentQuit(); } catch {}
    clearStudentSession();
    state.play = null;
    return openStudentLogin();
  }
  state.play = null;
  return openTeacherHome();
}

async function renderCurrentQuestion() {
  if (!state.play || state.play.finished) return;
  stopAll();
  state.jokerBusy = false;
  state.play.selected = null;
  state.play.locked = false;
  state.lastAnswerResult = null;
  state.play.questionStartedAt = performance.now();

  let questionText = '';
  let answers = [];
  let count = 0;

  if (state.play.mode === 'beamer') {
    const question = state.play.questions[state.play.index];
    if (!question) return finishGame(true);
    const shuffled = shuffleAnswers(question);
    answers = shuffled.map(answer => ({ key: answer.key.toUpperCase(), text: answer.text, correct: answer.correct }));
    questionText = question.question;
    count = state.play.questions.length;
  } else {
    const payload = await studentGetQuestion(state.play.index);
    answers = (payload.answers || []).map(answer => ({ key: String(answer.key).toUpperCase(), text: answer.text }));
    questionText = payload.question;
    count = state.play.questionCount;
  }

  state.play.answers = answers;
  $('#question-text').textContent = questionText;
  $('#question-text').classList.remove('enter');
  void $('#question-text').offsetWidth;
  $('#question-text').classList.add('enter');
  $('#question-progress').textContent = `Frage ${state.play.index + 1} von ${count}`;
  $('#game-status').textContent = amountForIndex(state.play.index);
  $('#lock-answer').disabled = true;
  $('#lock-answer').classList.remove('hidden');
  $('#next-question').classList.add('hidden');

  const box = $('#answers');
  box.replaceChildren();
  for (const answer of answers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    button.dataset.key = answer.key;
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.textContent = `${answer.key}:`;
    const text = document.createElement('span');
    text.textContent = answer.text;
    button.append(letter, text);
    box.append(button);
  }

  renderMoneyLadder();
  await startLoop(questionTrack(Math.min(state.play.index, 14)));
}

function amountForIndex(index) {
  return money[Math.min(Math.max(index, 0), 14)];
}

function answerRevealDelay(index) {
  if (index <= 4) return 1000;      // 50–500
  if (index <= 8) return 1500;      // 1'000–8'000
  if (index === 9) return 2000;     // 16'000
  if (index === 10) return 2500;    // 32'000
  if (index === 11) return 3000;    // 64'000
  if (index === 12) return 3500;    // 125'000
  if (index === 13) return 4500;    // 500'000
  return 6000;                       // 1'000'000
}

function selectAnswer(key) {
  if (!state.play || state.play.locked || state.jokerBusy) return;
  const button = document.querySelector(`.answer[data-key="${key}"]`);
  if (!button || button.classList.contains('removed')) return;
  $$('.answer').forEach(answer => answer.classList.remove('selected'));
  button.classList.add('selected');
  state.play.selected = key;
  $('#lock-answer').disabled = false;
  $('#game-status').textContent = `Antwort ${key} ausgewählt`;
}

async function lockAnswer() {
  if (!state.play?.selected || state.play.locked || state.jokerBusy) return;
  state.play.locked = true;
  const seq = state.playSeq;
  $$('.answer').forEach(answer => answer.classList.add('locked'));
  $('#lock-answer').disabled = true;
  $('#game-status').textContent = 'Antwort ist eingeloggt ...';

  let serverPromise = null;
  if (state.play.mode === 'student') {
    const responseMs = Math.max(0, Math.round(performance.now() - state.play.questionStartedAt));
    serverPromise = studentSubmitAnswer(state.play.index, state.play.selected, responseMs);
  }

  const revealDelay = answerRevealDelay(state.play.index);

  // From 32'000 upwards the suspense sound is strictly bounded to the
  // configured reveal delay. Audio must never decide when the answer appears.
  if (state.play.index >= 10) {
    stopLoop();
    const suspenseCue = state.play.index === 14 ? 'lock-million' : 'lock-high';
    const suspenseSeconds = revealDelay / 1000;
    void playCueSegment(suspenseCue, 0, suspenseSeconds);
  }

  await sleep(revealDelay);

  if (seq !== state.playSeq || state.play.finished) return;

  if (state.play.mode === 'beamer') {
    await revealAnswer(null);
    return;
  }

  try {
    const result = await Promise.race([
      serverPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Antwortübermittlung dauert zu lange. Bitte nochmals versuchen.')), 8000))
    ]);
    if (seq !== state.playSeq || state.play.finished) return;
    await revealAnswer(result);
  } catch (error) {
    stopForeground();
    state.play.locked = false;
    $$('.answer').forEach(answer => answer.classList.remove('locked'));
    $('#lock-answer').disabled = false;
    $('#game-status').textContent = 'Antwort konnte nicht ausgewertet werden. Bitte nochmals versuchen.';
    handleError(error, { student: true });
  }
}

async function revealAnswer(serverResult = null) {
  stopLoop();
  stopForeground();
  const selectedKey = state.play.selected;
  let correctKey;
  let isCorrect;

  if (state.play.mode === 'beamer') {
    const correct = state.play.answers.find(answer => answer.correct);
    correctKey = correct.key;
    isCorrect = selectedKey === correctKey;
  } else {
    correctKey = String(serverResult.correctKey).toUpperCase();
    isCorrect = Boolean(serverResult.correct);
    state.lastAnswerResult = serverResult;
  }

  const correctElement = document.querySelector(`.answer[data-key="${correctKey}"]`);
  const chosenElement = document.querySelector(`.answer[data-key="${selectedKey}"]`);
  correctElement?.classList.add('correct');

  if (!isCorrect) {
    chosenElement?.classList.remove('selected');
    chosenElement?.classList.add('wrong');
    $('#game-status').textContent = `Leider falsch. Richtig ist ${correctKey}.`;
    await playCue(state.play.index === 14 ? 'wrong-million' : 'wrong');
    return finishGame(false);
  }

  chosenElement?.classList.remove('selected');
  $('#game-status').textContent = `Richtig, ${amountForIndex(state.play.index)}!`;
  $('#lock-answer').classList.add('hidden');

  let cue = 'correct-low';
  if (state.play.index === 4) cue = 'safe1';
  else if (state.play.index === 9) cue = 'safe1';
  else if (state.play.index >= 10 && state.play.index < 14) cue = 'correct-high';
  else if (state.play.index >= 14) cue = 'correct-million';

  const isFinal = state.play.mode === 'student'
    ? serverResult.status === 'completed'
    : state.play.index >= state.play.questions.length - 1 || state.play.index >= 14;

  if (!isFinal) {
    $('#next-question').classList.remove('hidden');
    playCue(cue);
    return;
  }

  await playCue(cue);
  finishGame(true);
}

async function nextQuestion() {
  if (!state.play?.locked || state.play.finished || state.jokerBusy) return;
  stopAll();
  if (state.play.mode === 'student') {
    state.play.index = state.lastAnswerResult?.nextQuestionIndex ?? (state.play.index + 1);
  } else {
    state.play.index += 1;
  }
  await renderCurrentQuestion();
}

function renderMoneyLadder() {
  const box = $('#money-ladder');
  box.replaceChildren();
  for (let index = 14; index >= 0; index--) {
    const step = document.createElement('div');
    step.className = 'money-step';
    if ([4,9,14].includes(index)) step.classList.add('safe');
    if (index === Math.min(state.play.index, 14) && !state.play.finished) step.classList.add('active');
    if (index < Math.min(state.play.index, 14)) step.classList.add('done');
    step.innerHTML = `<span class="n">${index + 1}</span><span>${money[index]}</span>`;
    box.append(step);
  }
}

async function useJoker(type) {
  if (!state.play || state.play.finished || state.play.locked || state.jokerBusy || state.play.jokers[type]) return;
  state.play.jokers[type] = true;
  document.querySelector(`[data-joker="${type}"]`)?.classList.add('used');
  pauseLoop();
  state.jokerBusy = true;
  const seq = state.playSeq;

  try {
    if (type === 'fifty') await useFifty(seq);
    if (type === 'audience') await useAudience(seq);
    if (type === 'phone') await usePhone(seq);
    if (type === 'teacher') await useTeacher(seq);
  } catch (error) {
    state.play.jokers[type] = false;
    document.querySelector(`[data-joker="${type}"]`)?.classList.remove('used');
    state.jokerBusy = false;
    await resumeLoop();
    handleError(error, { student: state.play.mode === 'student' });
  }
}

async function jokerResult(type) {
  if (state.play.mode === 'student') return studentUseJoker(type);
  if (type === 'fifty') {
    const wrong = state.play.answers.filter(answer => !answer.correct).map(answer => answer.key);
    shuffleArray(wrong);
    return { type, removedKeys: wrong.slice(0, 2) };
  }
  if (type === 'audience') return { type, percentages: localAudiencePercentages() };
  if (type === 'phone') return localPhoneResult();
  return { type: 'teacher', message: 'Die Lehrperson gibt einen Hinweis.' };
}

async function useFifty(seq) {
  const result = await jokerResult('fifty');
  const cue = playCue('joker-fifty');
  await sleep(isAudioEnabled() ? 1050 : 120);
  if (seq !== state.playSeq) return;
  for (const key of result.removedKeys || []) document.querySelector(`.answer[data-key="${key}"]`)?.classList.add('removed');
  if ((result.removedKeys || []).includes(state.play.selected)) {
    state.play.selected = null;
    $$('.answer').forEach(answer => answer.classList.remove('selected'));
    $('#lock-answer').disabled = true;
  }
  $('#game-status').textContent = '50:50 Joker eingesetzt';
  state.jokerBusy = false;

  // The cue may continue, but the candidate can already select an answer.
  cue.then(async () => {
    if (seq !== state.playSeq || !state.play || state.play.locked || state.play.finished || state.jokerBusy) return;
    await resumeLoop();
  });
}

function localAudiencePercentages() {
  const correct = state.play.answers.find(answer => answer.correct)?.key;
  const keys = ['A','B','C','D'];
  const active = keys.filter(key => !document.querySelector(`.answer[data-key="${key}"]`)?.classList.contains('removed'));
  const raw = Object.fromEntries(keys.map(key => [key, active.includes(key) ? 8 + Math.random() * 15 : 0]));
  raw[correct] += Math.max(28, 58 - state.play.index * 1.7) + Math.random() * 10;
  const total = Object.values(raw).reduce((a,b) => a+b, 0);
  const out = {};
  let running = 0;
  keys.forEach((key, index) => {
    if (index === 3) out[key] = 100 - running;
    else {
      out[key] = raw[key] ? Math.round(raw[key] / total * 100) : 0;
      running += out[key];
    }
  });
  return out;
}

async function useAudience(seq) {
  const resultPromise = jokerResult('audience').then(result => ({ result }), error => ({ error }));
  const audioPromise = playCueSegment('joker-audience', 26, 32.5);

  modal(`
    <div class="joker-phase compact-joker-phase">
      <div class="phase-icon">👥</div>
      <h3>Publikumsjoker</h3>
      <div class="phase-copy">Das Publikum stimmt ab.</div>
      <div class="audience-stage"><div class="audience-live-bars"><span></span><span></span><span></span><span></span></div></div>
      <div class="joker-clock joker-countdown"><strong>7</strong> Sekunden</div>
    </div>`, true);

  for (let remaining = 7; remaining >= 1; remaining--) {
    const clock = document.querySelector('.joker-countdown strong');
    if (clock) clock.textContent = String(remaining);
    await sleep(remaining === 1 ? 500 : 1000);
    if (seq !== state.playSeq) return;
  }

  await audioPromise;
  if (seq !== state.playSeq) return;
  const packet = await resultPromise;
  if (packet.error) throw packet.error;
  const percentages = packet.result.percentages || {};

  modal(`
    <div class="joker-result-pop">
      <div class="phase-icon">👥</div>
      <h3>Das Publikum hat gewählt</h3>
      <div class="audience-chart">${audienceBars(percentages)}</div>
      <div class="modal-actions"><button class="btn primary" data-modal="close-joker">Zurück zur Frage</button></div>
    </div>`, true);
}

function audienceBars(percentages) {
  return ['A','B','C','D'].map(key => {
    const value = Number(percentages[key] ?? 0);
    return `<div class="audience-col"><div class="audience-value">${value}%</div><div class="audience-bar" style="height:${Math.max(8, value * 2.15)}px"></div><div class="audience-letter">${key}</div></div>`;
  }).join('');
}

function phoneOutcomeProbabilities(index) {
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

function localPhoneResult() {
  const correct = state.play.answers.find(answer => answer.correct);
  const activeAnswers = state.play.answers.filter(answer => !document.querySelector(`.answer[data-key="${answer.key}"]`)?.classList.contains('removed'));
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

function phoneConversationScript(result) {
  const outcome = ['certain', 'between', 'unknown'].includes(result?.outcome) ? result.outcome : 'unknown';
  const scripts = {
    certain: [
      ['«Okay, gib mir kurz einen Moment ...»', '«Ja, das kommt mir bekannt vor. Ich glaube, ich habe es.»', '«Doch, jetzt bin ich mir ziemlich sicher.»'],
      ['«Puh, kurz nachdenken ...»', '«Ich habe gerade eine Erinnerung dazu im Kopf.»', '«Ja, ich würde mich jetzt festlegen.»'],
      ['«Warte kurz, ich gehe die Antworten einzeln durch.»', '«Eine davon passt für mich deutlich besser als die anderen.»', '«Ja, jetzt bin ich überzeugt.»'],
      ['«Moment, das müsste ich eigentlich wissen ...»', '«Ja, jetzt fällt es mir wieder ein.»', '«Ich bin mir ziemlich sicher, dass ich die Lösung habe.»'],
      ['«Lass mich ganz kurz überlegen.»', '«Okay, ich glaube, ich weiss, worauf die Frage hinauswill.»', '«Ja, ich habe eine klare Antwort.»'],
      ['«Nicht sofort sagen, ich will sicher sein ...»', '«Doch, das kenne ich. Ich prüfe es nur noch einmal.»', '«Passt. Ich würde mich eindeutig festlegen.»'],
      ['«Interessant, warte kurz ...»', '«Jetzt klingelt etwas bei mir.»', '«Ja, das ist für mich jetzt klar.»'],
      ['«Ich sortiere das gerade im Kopf.»', '«Eine Antwort ergibt für mich wirklich Sinn.»', '«Okay, ich bin mir sicher genug, um sie dir zu nennen.»']
    ],
    between: [
      ['«Hm, die Frage ist knifflig ...»', '«Zwei Antworten kommen für mich ernsthaft infrage.»', '«Ich komme zwischen den beiden nicht eindeutig weiter.»'],
      ['«Warte, ich versuche es einzugrenzen.»', '«Ich kann zwei Möglichkeiten ausschliessen, aber bei den anderen beiden hänge ich.»', '«Puh, ich würde zwischen zwei Antworten bleiben.»'],
      ['«Spontan sehe ich zwei plausible Antworten.»', '«Ich gehe beide noch einmal gegeneinander durch.»', '«Nein, eindeutig wird es für mich leider nicht.»'],
      ['«Das ist schwieriger als gedacht.»', '«Ich habe zwei Kandidaten, die beide passen könnten.»', '«Ich möchte dir keinen der beiden als sicher verkaufen.»'],
      ['«Okay, kurz logisch herleiten ...»', '«Damit komme ich immerhin auf zwei Antworten.»', '«Weiter kann ich es leider nicht sauber eingrenzen.»'],
      ['«Ich bin nicht ganz sicher, aber ich kann etwas reduzieren.»', '«Zwei Antworten bleiben bei mir übrig.»', '«Zwischen diesen beiden schwanke ich weiterhin.»'],
      ['«Moment, ich kenne das Thema nur halbwegs.»', '«Bei zwei Antworten sehe ich gute Argumente.»', '«Ich kann mich ehrlich gesagt nicht für eine entscheiden.»'],
      ['«Lass mich überlegen ...»', '«Ich habe zwei klare Favoriten.»', '«Mehr als diese zwei kann ich dir leider nicht zuverlässig sagen.»']
    ],
    unknown: [
      ['«Oh je, das ist nicht gerade mein Gebiet ...»', '«Ich versuche es herzuleiten, aber mir fehlt der entscheidende Anhaltspunkt.»', '«Nein, ich möchte jetzt nicht einfach raten.»'],
      ['«Puh, spontan sagt mir das leider gar nichts.»', '«Ich suche gerade irgendeinen Ansatz, aber ich komme nicht weiter.»', '«Ich wäre bei einem Tipp wirklich nur am Raten.»'],
      ['«Da erwischst du mich gerade auf dem falschen Fuss.»', '«Ich kann keine Antwort seriös begründen.»', '«Nein, ich möchte dich hier nicht in die falsche Richtung schicken.»'],
      ['«Moment ... vielleicht kann ich es irgendwie ableiten.»', '«Hm, nein. Ich finde keinen verlässlichen Hinweis.»', '«Ich muss ehrlich sein, ich weiss es nicht.»'],
      ['«Das Thema liegt mir leider überhaupt nicht.»', '«Ich gehe die Antworten durch, aber keine löst bei mir etwas aus.»', '«Ich würde lieber nichts behaupten, als dir einen Zufallstipp zu geben.»'],
      ['«Uff, schwierige Frage für mich.»', '«Ich probiere gerade Ausschlussverfahren, aber selbst das hilft mir nicht.»', '«Tut mir leid, ich komme auf keine verlässliche Lösung.»'],
      ['«Ich habe gerade wirklich keinen ersten Impuls.»', '«Auch nach dem Durchgehen bin ich nicht schlauer.»', '«Ich kann dir diesmal leider nicht helfen.»'],
      ['«Warte kurz, vielleicht fällt mir noch etwas ein ...»', '«Nein, da kommt leider nichts Verlässliches.»', '«Ich sage lieber offen, dass ich es nicht weiss.»']
    ]
  };
  const pool = scripts[outcome];
  return pool[Math.floor(Math.random() * pool.length)];
}

function phoneFinalText(result) {
  const outcome = ['certain', 'between', 'unknown'].includes(result?.outcome) ? result.outcome : 'unknown';
  if (outcome === 'between' && Array.isArray(result.keys) && result.keys.length >= 2) {
    const a = escapeHtml(String(result.keys[0]).toUpperCase());
    const b = escapeHtml(String(result.keys[1]).toUpperCase());
    const variants = [
      `«Ich schwanke zwischen <strong>${a}</strong> und <strong>${b}</strong>. Mehr kann ich leider nicht eingrenzen.»`,
      `«Für mich bleiben <strong>${a}</strong> und <strong>${b}</strong> übrig. Eine davon müsste es sein.»`,
      `«Ich würde mich auf <strong>${a}</strong> oder <strong>${b}</strong> beschränken, aber ich kann dir nicht ehrlich sagen, welche von beiden.»`,
      `«Zwei Antworten halte ich für realistisch: <strong>${a}</strong> und <strong>${b}</strong>. Weiter komme ich leider nicht.»`,
      `«Mein Tipp hilft dir nur teilweise: Ich sehe es zwischen <strong>${a}</strong> und <strong>${b}</strong>.»`
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  if (outcome === 'unknown') {
    const variants = [
      '«Tut mir leid, ich weiss es wirklich nicht. Ich möchte dich hier nicht in die falsche Richtung schicken.»',
      '«Ich muss passen. Alles, was ich jetzt sagen würde, wäre reines Raten.»',
      '«Sorry, ich komme auf keine Antwort, hinter der ich stehen könnte.»',
      '«Ich kann dir diesmal leider keinen seriösen Tipp geben. Ich weiss es nicht.»',
      '«Da bin ich raus. Lieber sage ich ehrlich, dass ich keine Ahnung habe.»'
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  const key = escapeHtml(String(result.guessKey || '').toUpperCase());
  const variants = [
    `«Ich bin mir sicher: Die richtige Antwort ist <strong>${key}</strong>.»`,
    `«Ja, ich würde mich klar auf <strong>${key}</strong> festlegen.»`,
    `«Für mich ist es eindeutig <strong>${key}</strong>.»`,
    `«Ich nehme <strong>${key}</strong>. Da bin ich mir wirklich sicher.»`,
    `«Mein klarer Tipp ist <strong>${key}</strong>.»`
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

async function usePhone(seq) {
  modal(`
    <div class="joker-phase">
      <div class="phase-icon">☎</div>
      <h3>Telefonjoker</h3>
      <div class="phone-process">«Hallo? Ja, stell die Frage kurz ...»</div>
      <div class="joker-clock">Verbindung wird hergestellt ...</div>
    </div>`, true);

  const packet = await jokerResult('phone').then(result => ({ result }), error => ({ error }));
  if (packet.error) throw packet.error;
  if (seq !== state.playSeq) return;

  const result = packet.result;
  const script = phoneConversationScript(result);
  const audioPromise = playCueSegment('joker-phone', 21, 40);

  phonePhase(script[0], 19);

  for (let remaining = 19; remaining >= 1; remaining--) {
    if (remaining === 12) phonePhase(script[1], remaining);
    if (remaining === 6) phonePhase(script[2], remaining);
    const clock = document.querySelector('.joker-countdown strong');
    if (clock) clock.textContent = String(remaining);
    await sleep(1000);
    if (seq !== state.playSeq) return;
  }

  await audioPromise;
  if (seq !== state.playSeq) return;
  const phoneText = phoneFinalText(result);

  modal(`
    <div class="joker-result-pop">
      <div class="phase-icon">☎</div>
      <h3>Der Tipp</h3>
      <div class="phone-process final-phone-tip">${phoneText}</div>
      <div class="modal-actions"><button class="btn primary" data-modal="close-joker">Zurück zur Frage</button></div>
    </div>`, true);
}

function phonePhase(text, remaining) {
  modal(`
    <div class="joker-phase">
      <div class="phase-icon">☎</div>
      <h3>Telefonjoker</h3>
      <div class="phone-process">${text}</div>
      <div class="joker-clock joker-countdown"><strong>${remaining}</strong> Sekunden</div>
    </div>`, true);
}

async function useTeacher(seq) {
  await jokerResult('teacher');
  modal(`
    <div class="teacher-screen">
      <div class="teacher-badge">L</div>
      <h3>Lehrerjoker</h3>
      <div class="joker-message">${state.play.mode === 'student' ? 'Bitte die Lehrperson um einen Hinweis.' : 'Die Lehrperson darf jetzt einen mündlichen Hinweis geben.'}</div>
      <div class="modal-actions"><button class="btn primary" data-modal="close-joker">Weiterspielen</button></div>
    </div>`, true);
  playCue('joker-teacher');
  if (seq !== state.playSeq) return;
}

async function closeJoker() {
  stopForeground();
  closeModal(true);
  state.jokerBusy = false;
  if (state.play && !state.play.locked && !state.play.finished) await resumeLoop();
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function modal(html, persistent = false, wide = false) {
  $('#modal-content').classList.toggle('wide', wide);
  $('#modal-content').innerHTML = html;
  $('#modal').dataset.persistent = persistent ? '1' : '0';
  $('#modal').classList.remove('hidden');
}

function closeModal(force = false) {
  if (!force && $('#modal').dataset.persistent === '1') return;
  $('#modal').classList.add('hidden');
  $('#modal').dataset.persistent = '0';
  $('#modal-content').classList.remove('wide');
}

function finishGame(won) {
  if (!state.play || state.play.finished) return;
  state.play.finished = true;
  stopAll();
  stopHeartbeat();
  closeModal(true);

  let amountIndex;
  if (won) amountIndex = Math.min(state.play.index, 14);
  else if (state.play.index >= 10) amountIndex = 9;
  else if (state.play.index >= 5) amountIndex = 4;
  else amountIndex = -1;

  const card = document.querySelector('.result-card');
  const screen = document.querySelector('.result-screen');
  const finalWinner = won && amountIndex === 14;
  card?.classList.toggle('winner', won);
  card?.classList.toggle('million-winner', finalWinner);
  card?.classList.toggle('lost', !won);
  screen?.classList.toggle('winner-screen', won);
  document.querySelector('.winner-confetti')?.remove();

  if (won && card) {
    const confetti = document.createElement('div');
    confetti.className = 'winner-confetti';
    for (let i = 0; i < 34; i++) {
      const piece = document.createElement('span');
      piece.style.setProperty('--x', `${4 + Math.random() * 92}%`);
      piece.style.setProperty('--delay', `${Math.random() * 1.8}s`);
      piece.style.setProperty('--dur', `${2.3 + Math.random() * 2.1}s`);
      piece.style.setProperty('--rot', `${Math.floor(Math.random() * 360)}deg`);
      confetti.append(piece);
    }
    card.prepend(confetti);
  }

  const playerName = state.play.name && state.play.name !== 'Kandidat/in' ? state.play.name : '';
  $('#result-kicker').textContent = won ? (finalWinner ? '🏆 MILLIONÄR! 🏆' : '🏆 GESCHAFFT! 🏆') : 'Spiel beendet';
  $('#result-money').textContent = amountIndex >= 0 ? money[amountIndex] : '0 €';
  $('#result-copy').textContent = state.play.mode === 'student'
    ? (won ? `${playerName ? playerName + ', du' : 'Du'} hast das Spiel erfolgreich beendet!` : 'Danke fürs Mitspielen.')
    : (won ? `${playerName ? playerName + ' hat' : 'Der Kandidat oder die Kandidatin hat'} es geschafft!` : 'Die sichere Gewinnstufe.');
  $('#result-primary').textContent = state.play.mode === 'student' ? 'Zur Startseite' : 'Zurück zum Lehrermodus';
  showScreen('result');
  if (won) playCue('outro');
}

async function resultPrimary() {
  const mode = state.play?.mode;
  if (mode === 'student') {
    clearStudentSession();
    state.play = null;
    return backToMode();
  }
  state.play = null;
  return openTeacherHome();
}

async function quitCurrentGame() {
  if (!state.play) return backToMode();
  if (!confirm('Spiel wirklich beenden?')) return;
  ++state.playSeq;
  stopAll();
  stopHeartbeat();
  if (state.play.mode === 'student') {
    try { await studentQuit(); } catch {}
    clearStudentSession();
    state.play = null;
    return backToMode();
  }
  state.play = null;
  return openTeacherHome();
}

function startHeartbeat() {
  stopHeartbeat();
  studentHeartbeat().catch(() => {});
  state.heartbeatTimer = window.setInterval(() => {
    if (state.play?.mode === 'student' && !state.play.finished) studentHeartbeat().catch(() => {});
  }, 30000);
}

function stopHeartbeat() {
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = null;
}

function toggleAudio() {
  const enabled = !isAudioEnabled();
  setAudioEnabled(enabled);
  $('#audio-toggle').textContent = enabled ? '🔊' : '🔇';
  if (enabled && state.play && $('#screen-game').classList.contains('active') && !state.play.locked && !state.jokerBusy) startLoop(questionTrack(Math.min(state.play.index, 14)), { restart:false });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

// Keep the learner screen free of technical setup information.
if (!isBackendConfigured()) {
  console.info('WWM v3: Supabase configuration is still empty. Add Project URL and Publishable Key in js/config-v3.js.');
}
