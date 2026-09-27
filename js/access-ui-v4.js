import { rpc, teacherToken } from './backend-v3.js?v=20260927-access5';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let accessReady = false;
let teacherGames = new Map();
let teacherLoading = false;
let lastTeacherLoad = 0;

installStyles();
installListeners();
void initialiseAccess();

async function initialiseAccess() {
  try {
    await rpc('wwm_student_games_list_v4');
    accessReady = true;
    document.body.classList.add('access-v4-ready');
    patchStaticCopy();
  } catch (error) {
    console.info('WWM Zugriffssystem v4 noch nicht aktiv. Alte Code-Oberfläche bleibt verfügbar.', error);
  }
}

function installListeners() {
  document.addEventListener('click', event => {
    if (!accessReady) return;

    const action = event.target.closest('[data-action]')?.dataset.action || '';
    if (action === 'open-student-login') {
      setTimeout(() => loadStudentBrowser(), 0);
    }

    if (
      action === 'teacher-refresh' ||
      action === 'teacher-show-games' ||
      action === 'folder-open' ||
      action === 'folder-up' ||
      action === 'game-move' ||
      action === 'move-game-folder' ||
      action === 'game-duplicate' ||
      action === 'game-delete' ||
      action === 'editor-save'
    ) {
      setTimeout(() => refreshTeacherAccess(true), 500);
    }
  });

  $('#teacher-login-form')?.addEventListener('submit', () => {
    if (!accessReady) return;
    setTimeout(() => refreshTeacherAccess(true), 650);
    setTimeout(() => refreshTeacherAccess(true), 1400);
  });

  $('#student-login-form')?.addEventListener('submit', event => {
    if (!accessReady) return;
    const code = $('#student-code')?.value.trim();
    if (!code) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.setInterval(() => {
    if (!accessReady || !$('#screen-teacher')?.classList.contains('active')) return;
    const undecorated = $$('.game-card-v3').some(card => !card.dataset.accessV4);
    if (undecorated) void refreshTeacherAccess();
  }, 900);
}

function installStyles() {
  const style = document.createElement('style');
  style.id = 'access-v4-styles';
  style.textContent = `
    .access-v4-ready [data-action="game-code"],
    .access-v4-ready [data-action="host-code-big"],
    .access-v4-ready .host-code-card { display:none !important; }
    .access-v4-ready .host-layout { grid-template-columns:minmax(0,1fr) !important; }
    .access-v4-hidden { display:none !important; }

    .student-access-browser { margin-top:22px; display:grid; gap:24px; }
    .student-access-section { display:grid; gap:11px; }
    .student-access-head { display:flex; justify-content:space-between; align-items:end; gap:14px; }
    .student-access-head h3 { margin:0; font-size:19px; }
    .student-access-head p { margin:3px 0 0; color:#aeb8ef; font-size:13px; line-height:1.35; }
    .student-access-count { color:#8f9ce9; font-size:12px; white-space:nowrap; }
    .student-access-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:11px; }
    .student-access-card { border:1px solid rgba(121,143,255,.36); border-radius:16px; background:linear-gradient(180deg,rgba(23,31,100,.9),rgba(8,12,54,.94)); padding:15px; min-height:126px; display:grid; gap:9px; box-shadow:inset 0 0 18px rgba(77,91,219,.08); }
    .student-access-card.current { border-color:rgba(255,160,56,.62); box-shadow:0 0 18px rgba(255,146,44,.1),inset 0 0 18px rgba(255,146,44,.06); }
    .student-access-card.fun { border-color:rgba(165,91,255,.55); }
    .student-access-card strong { font-size:16px; line-height:1.25; }
    .student-access-card small { color:#aeb8ef; }
    .student-access-card .btn { justify-self:start; margin-top:auto; }
    .student-access-empty { border:1px dashed rgba(121,143,255,.3); border-radius:15px; padding:14px 16px; color:#9ca8e8; font-size:13px; }
    .student-access-loading { padding:18px; text-align:center; color:#aeb8ef; }

    .teacher-access-box { margin:12px 0 2px; padding:12px; border:1px solid rgba(121,143,255,.28); border-radius:14px; background:rgba(7,12,59,.42); display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr); gap:10px; }
    .teacher-access-field { display:grid; gap:5px; min-width:0; }
    .teacher-access-field span { color:#98a6ec; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
    .teacher-access-field select { width:100%; min-width:0; border:1px solid #5268cb; background:#090e43; color:#f8fbff; border-radius:10px; padding:9px 10px; font:inherit; font-size:13px; }
    .teacher-access-status { grid-column:1/-1; min-height:20px; display:flex; align-items:center; gap:8px; color:#aeb8ef; font-size:12px; }
    .teacher-access-dot { width:8px; height:8px; border-radius:999px; background:#7b84ac; box-shadow:0 0 8px currentColor; }
    .teacher-access-status[data-mode="active"] .teacher-access-dot { background:#ff9d34; color:#ff9d34; }
    .teacher-access-status[data-mode="open"] .teacher-access-dot { background:#2ed47a; color:#2ed47a; }
    .teacher-access-status[data-mode="hidden"] .teacher-access-dot { background:#7b84ac; color:#7b84ac; }
    .teacher-access-status.saving { opacity:.55; }

    @media (max-width:700px) {
      .student-access-grid { grid-template-columns:1fr; }
      .teacher-access-box { grid-template-columns:1fr; }
      .teacher-access-status { grid-column:1; }
    }
  `;
  document.head.append(style);
}

function patchStaticCopy() {
  const studentChoice = $('[data-action="open-student-login"] span:last-child');
  if (studentChoice) studentChoice.textContent = 'Name und Klasse eingeben und aus den freigeschalteten Quiz auswählen.';

  const teacherGamesText = $('[data-action="teacher-show-games"] span');
  if (teacherGamesText) teacherGamesText.textContent = 'Spiele bearbeiten, ordnen und für Lernende freischalten.';
}

async function loadStudentBrowser() {
  if (!accessReady) return;
  const form = $('#student-login-form');
  if (!form) return;

  const title = form.querySelector('h2');
  if (title) title.textContent = 'Spiel auswählen';

  const codeInput = $('#student-code');
  codeInput?.closest('label')?.classList.add('access-v4-hidden');
  form.querySelector('button[type="submit"]')?.classList.add('access-v4-hidden');

  let browser = $('#student-access-browser');
  if (!browser) {
    browser = document.createElement('div');
    browser.id = 'student-access-browser';
    browser.className = 'student-access-browser';
    $('#student-login-error')?.before(browser);
  }
  browser.innerHTML = '<div class="student-access-loading">Freigeschaltete Spiele werden geladen …</div>';

  try {
    const games = await rpc('wwm_student_games_list_v4');
    renderStudentGames(browser, Array.isArray(games) ? games : []);
  } catch (error) {
    console.error(error);
    browser.innerHTML = '<div class="student-access-empty">Die Spiele konnten gerade nicht geladen werden. Bitte Seite neu laden.</div>';
  }
}

function renderStudentGames(container, games) {
  const current = games.filter(game => category(game) === 'subject' && accessMode(game) === 'active');
  const practice = games.filter(game => category(game) === 'subject' && accessMode(game) === 'open');
  const fun = games.filter(game => category(game) === 'fun');

  container.replaceChildren(
    studentSection('Aktuell freigeschaltet', 'Das ist gerade im Unterricht verfügbar.', current, 'current'),
    studentSection('Freies Üben', 'Diese fachlichen Quiz kannst du jederzeit wiederholen.', practice, 'practice'),
    studentSection('Just for Fun', 'Quiz ohne Unterrichtsbezug, einfach zum Spielen.', fun, 'fun')
  );
}

function studentSection(title, subtitle, games, style) {
  const section = document.createElement('section');
  section.className = 'student-access-section';

  const head = document.createElement('div');
  head.className = 'student-access-head';
  head.innerHTML = '<div><h3></h3><p></p></div><span class="student-access-count"></span>';
  head.querySelector('h3').textContent = title;
  head.querySelector('p').textContent = subtitle;
  head.querySelector('span').textContent = `${games.length} ${games.length === 1 ? 'Spiel' : 'Spiele'}`;
  section.append(head);

  if (!games.length) {
    const empty = document.createElement('div');
    empty.className = 'student-access-empty';
    empty.textContent = style === 'current' ? 'Momentan ist kein Quiz für den Unterricht freigeschaltet.' : 'Hier sind aktuell keine Spiele verfügbar.';
    section.append(empty);
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'student-access-grid';
  for (const game of games) {
    const card = document.createElement('article');
    card.className = `student-access-card ${style}`;
    card.innerHTML = '<strong></strong><small></small><button type="button" class="btn primary">Spielen</button>';
    card.querySelector('strong').textContent = game.title || 'Quiz';
    card.querySelector('small').textContent = `${Number(game.questionCount || 0)} Fragen`;
    card.querySelector('button').addEventListener('click', () => startVisibleGame(game));
    grid.append(card);
  }
  section.append(grid);
  return section;
}

function startVisibleGame(game) {
  const name = $('#student-name');
  const className = $('#student-class');
  const code = $('#student-code');
  const error = $('#student-login-error');

  if (!name?.value.trim()) {
    if (error) error.textContent = 'Bitte zuerst deinen Namen eingeben.';
    name?.focus();
    return;
  }
  if (!className?.value.trim()) {
    if (error) error.textContent = 'Bitte zuerst deine Klasse eingeben.';
    className?.focus();
    return;
  }
  if (!game.id) {
    if (error) error.textContent = 'Dieses Spiel kann gerade nicht gestartet werden. Bitte Seite neu laden.';
    return;
  }

  if (error) error.textContent = '';
  code.value = String(game.id).trim();
  $('#student-login-form')?.requestSubmit();
}

async function refreshTeacherAccess(force = false) {
  if (!accessReady || !teacherToken() || !$('#screen-teacher')?.classList.contains('active')) return;
  const now = Date.now();
  if (teacherLoading || (!force && now - lastTeacherLoad < 700)) return;
  teacherLoading = true;
  lastTeacherLoad = now;

  try {
    const games = await rpc('wwm_teacher_games_list', { p_token: teacherToken() });
    teacherGames = new Map((Array.isArray(games) ? games : []).map(game => [String(game.id), game]));
    decorateTeacherCards();
  } catch (error) {
    console.error('Zugriffseinstellungen konnten nicht geladen werden.', error);
  } finally {
    teacherLoading = false;
  }
}

function decorateTeacherCards() {
  for (const card of $$('.game-card-v3')) {
    if (card.dataset.accessV4) continue;
    const id = card.querySelector('[data-id]')?.dataset.id;
    const game = teacherGames.get(String(id || ''));
    if (!game) continue;

    card.dataset.accessV4 = '1';
    const meta = card.querySelector('.game-card-meta');
    if (meta) meta.textContent = meta.textContent.replace(/\s*·\s*Code\s+[^·]+/i, '').replace(/\s{2,}/g, ' ').trim();

    const actions = card.querySelector('.game-card-actions');
    if (!actions) continue;

    const box = document.createElement('div');
    box.className = 'teacher-access-box';
    box.innerHTML = `
      <label class="teacher-access-field"><span>Bereich</span><select data-access-category>
        <option value="subject">Fachlich</option>
        <option value="fun">Just for Fun</option>
      </select></label>
      <label class="teacher-access-field"><span>Zugriff</span><select data-access-mode>
        <option value="hidden">Versteckt</option>
        <option value="active">Aktuell freigeschaltet</option>
        <option value="open">Immer offen</option>
      </select></label>
      <div class="teacher-access-status"><i class="teacher-access-dot"></i><span></span></div>`;

    const categorySelect = box.querySelector('[data-access-category]');
    const modeSelect = box.querySelector('[data-access-mode]');
    categorySelect.value = category(game);
    modeSelect.value = accessMode(game);
    updateTeacherStatus(box);

    categorySelect.addEventListener('change', () => saveTeacherAccess(game.id, box));
    modeSelect.addEventListener('change', () => saveTeacherAccess(game.id, box));
    actions.before(box);
  }
}

async function saveTeacherAccess(gameId, box) {
  const categoryValue = box.querySelector('[data-access-category]').value;
  const modeValue = box.querySelector('[data-access-mode]').value;
  const status = box.querySelector('.teacher-access-status');
  const selects = box.querySelectorAll('select');

  selects.forEach(select => select.disabled = true);
  status.classList.add('saving');
  status.querySelector('span').textContent = 'Speichern …';

  try {
    const result = await rpc('wwm_teacher_game_access_set', {
      p_token: teacherToken(),
      p_game_id: gameId,
      p_category: categoryValue,
      p_access_mode: modeValue
    });
    const existing = teacherGames.get(String(gameId)) || {};
    teacherGames.set(String(gameId), { ...existing, category: result.category, accessMode: result.accessMode });
    updateTeacherStatus(box);
  } catch (error) {
    console.error(error);
    status.querySelector('span').textContent = 'Konnte nicht gespeichert werden';
  } finally {
    status.classList.remove('saving');
    selects.forEach(select => select.disabled = false);
  }
}

function updateTeacherStatus(box) {
  const categoryValue = box.querySelector('[data-access-category]').value;
  const modeValue = box.querySelector('[data-access-mode]').value;
  const status = box.querySelector('.teacher-access-status');
  status.dataset.mode = modeValue;

  if (modeValue === 'hidden') status.querySelector('span').textContent = 'Für Lernende nicht sichtbar';
  else if (categoryValue === 'fun') status.querySelector('span').textContent = 'Unter «Just for Fun» sichtbar';
  else if (modeValue === 'active') status.querySelector('span').textContent = 'Unter «Aktuell freigeschaltet» sichtbar';
  else status.querySelector('span').textContent = 'Unter «Freies Üben» sichtbar';
}

function category(game) {
  return String(game?.category || '').toLowerCase() === 'fun' ? 'fun' : 'subject';
}

function accessMode(game) {
  const value = String(game?.accessMode || '').toLowerCase();
  return ['hidden', 'active', 'open'].includes(value) ? value : 'hidden';
}
