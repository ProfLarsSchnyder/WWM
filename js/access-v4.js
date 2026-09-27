const api = window.__WWM_ACCESS_API;

if (api) {
  const state = {
    accessReady: false,
    studentLoading: false,
    teacherLoading: false,
    teacherGames: [],
    studentGames: [],
    lastStudentLoad: 0,
    lastTeacherLoad: 0
  };

  installStyles();
  patchStaticCopy();
  installObservers();
  window.setTimeout(refreshVisibleScreen, 0);

  function installStyles() {
    if (document.getElementById('wwm-access-v4-styles')) return;
    const style = document.createElement('style');
    style.id = 'wwm-access-v4-styles';
    style.textContent = `
      .wwm-code-ui-hidden { display:none !important; }
      .wwm-access-ready .host-code-card { display:none !important; }
      .wwm-access-ready .host-layout { grid-template-columns:minmax(0,1fr) !important; }
      .wwm-access-ready [data-action="game-code"], .wwm-access-ready [data-action="host-code-big"] { display:none !important; }

      .student-game-browser-v4 { margin-top:22px; display:grid; gap:22px; }
      .student-game-section-v4 { display:grid; gap:12px; }
      .student-game-section-head-v4 { display:flex; align-items:end; justify-content:space-between; gap:16px; }
      .student-game-section-head-v4 h3 { margin:0; font-size:19px; }
      .student-game-section-head-v4 p { margin:3px 0 0; color:#aeb8ef; font-size:13px; line-height:1.35; }
      .student-game-count-v4 { color:#8f9ce9; font-size:12px; white-space:nowrap; }
      .student-game-grid-v4 { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:11px; }
      .student-game-card-v4 { border:1px solid rgba(121,143,255,.36); border-radius:16px; background:linear-gradient(180deg,rgba(23,31,100,.9),rgba(8,12,54,.94)); padding:15px; display:grid; gap:10px; min-height:128px; box-shadow:inset 0 0 18px rgba(77,91,219,.09); }
      .student-game-card-v4.current { border-color:rgba(255,160,56,.62); box-shadow:0 0 18px rgba(255,146,44,.1),inset 0 0 18px rgba(255,146,44,.06); }
      .student-game-card-v4.fun { border-color:rgba(165,91,255,.55); }
      .student-game-card-v4 strong { font-size:16px; line-height:1.25; }
      .student-game-card-v4 small { color:#aeb8ef; }
      .student-game-card-v4 .btn { justify-self:start; margin-top:auto; }
      .student-game-empty-v4 { border:1px dashed rgba(121,143,255,.3); border-radius:15px; padding:14px 16px; color:#9ca8e8; font-size:13px; }
      .student-game-loading-v4 { text-align:center; padding:18px; color:#aeb8ef; }

      .access-controls-v4 { margin:12px 0 2px; padding:12px; border:1px solid rgba(121,143,255,.28); border-radius:14px; background:rgba(7,12,59,.42); display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr); gap:10px; }
      .access-control-v4 { display:grid; gap:5px; min-width:0; }
      .access-control-v4 span { color:#98a6ec; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
      .access-control-v4 select { width:100%; min-width:0; border:1px solid #5268cb; background:#090e43; color:#f8fbff; border-radius:10px; padding:9px 10px; font:inherit; font-size:13px; }
      .access-status-v4 { grid-column:1/-1; display:flex; align-items:center; gap:8px; color:#aeb8ef; font-size:12px; min-height:20px; }
      .access-dot-v4 { width:8px; height:8px; border-radius:999px; background:#6672a6; box-shadow:0 0 8px currentColor; }
      .access-status-v4[data-mode="active"] .access-dot-v4 { background:#ff9d34; color:#ff9d34; }
      .access-status-v4[data-mode="open"] .access-dot-v4 { background:#2ed47a; color:#2ed47a; }
      .access-status-v4[data-mode="hidden"] .access-dot-v4 { background:#7b84ac; color:#7b84ac; }
      .access-status-v4.saving { opacity:.6; }

      @media (max-width:700px) {
        .access-controls-v4 { grid-template-columns:1fr; }
        .access-status-v4 { grid-column:1; }
        .student-game-grid-v4 { grid-template-columns:1fr; }
      }
    `;
    document.head.append(style);
  }

  function patchStaticCopy() {
    const modeChoices = [...document.querySelectorAll('.mode-choice')];
    const studentChoice = modeChoices.find(button => button.dataset.action === 'open-student-login');
    const studentDescription = studentChoice?.querySelector('span:last-child');
    if (studentDescription) studentDescription.textContent = 'Name und Klasse eingeben und aus den freigeschalteten Quiz auswählen.';

    const teacherGamesNav = document.querySelector('[data-action="teacher-show-games"] span');
    if (teacherGamesNav) teacherGamesNav.textContent = 'Spiele bearbeiten, ordnen und für Lernende freischalten.';

    const teacherHeader = document.querySelector('#screen-teacher .teacher-brand p');
    if (teacherHeader) teacherHeader.textContent = 'Spiele verwalten, präsentieren und freigeben';
  }

  function installObservers() {
    const observer = new MutationObserver(() => refreshVisibleScreen());
    observer.observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });

    const modal = document.getElementById('modal-content');
    if (modal) {
      new MutationObserver(cleanCodeReferences).observe(modal, { subtree:true, childList:true });
    }
  }

  function refreshVisibleScreen() {
    patchStaticCopy();
    cleanCodeReferences();

    const studentScreen = document.getElementById('screen-student-login');
    if (studentScreen?.classList.contains('active')) prepareStudentBrowser();

    const teacherScreen = document.getElementById('screen-teacher');
    if (teacherScreen?.classList.contains('active')) decorateTeacherGames();
  }

  function cleanCodeReferences() {
    const codeInput = document.getElementById('student-code');
    const codeLabel = codeInput?.closest('label');
    if (state.accessReady) codeLabel?.classList.add('wwm-code-ui-hidden');

    document.querySelectorAll('[data-action="game-code"], [data-action="host-code-big"]').forEach(button => {
      if (state.accessReady) button.classList.add('wwm-code-ui-hidden');
    });

    document.querySelectorAll('.game-card-meta').forEach(meta => {
      if (!state.accessReady) return;
      const cleaned = meta.textContent.replace(/\s*·\s*Code\s+[^·]+/i, '').replace(/\s{2,}/g, ' ').trim();
      if (cleaned !== meta.textContent) meta.textContent = cleaned;
    });

    if (!state.accessReady) return;
    document.querySelectorAll('#modal-content small').forEach(small => {
      if (/^\s*Code\s+/i.test(small.textContent || '')) small.remove();
    });
  }

  async function prepareStudentBrowser() {
    const now = Date.now();
    if (state.studentLoading || now - state.lastStudentLoad < 600) return;
    state.studentLoading = true;
    state.lastStudentLoad = now;

    const form = document.getElementById('student-login-form');
    const errorBox = document.getElementById('student-login-error');
    if (!form) { state.studentLoading = false; return; }

    let browser = document.getElementById('student-game-browser-v4');
    if (!browser) {
      browser = document.createElement('div');
      browser.id = 'student-game-browser-v4';
      browser.className = 'student-game-browser-v4';
      errorBox?.before(browser);
    }
    browser.innerHTML = '<div class="student-game-loading-v4">Freigeschaltete Spiele werden geladen …</div>';

    try {
      const games = await api.studentGamesList();
      state.studentGames = Array.isArray(games) ? games : [];
      state.accessReady = true;
      document.body.classList.add('wwm-access-ready');
      convertStudentScreen();
      renderStudentGames(browser, state.studentGames);
      cleanCodeReferences();
    } catch (error) {
      state.accessReady = false;
      browser.remove();
      const codeInput = document.getElementById('student-code');
      codeInput?.closest('label')?.classList.remove('wwm-code-ui-hidden');
      console.warn('Neue Freischaltung ist noch nicht aktiv:', error);
    } finally {
      state.studentLoading = false;
    }
  }

  function convertStudentScreen() {
    const form = document.getElementById('student-login-form');
    const title = form?.querySelector('h2');
    if (title) title.textContent = 'Spiel auswählen';

    const codeInput = document.getElementById('student-code');
    if (codeInput) {
      codeInput.value = '';
      codeInput.maxLength = 64;
      codeInput.closest('label')?.classList.add('wwm-code-ui-hidden');
    }

    const submit = form?.querySelector('button[type="submit"]');
    if (submit) submit.classList.add('wwm-code-ui-hidden');
  }

  function renderStudentGames(container, games) {
    const current = games.filter(game => normCategory(game.category) === 'subject' && normAccess(game.accessMode) === 'active');
    const practice = games.filter(game => normCategory(game.category) === 'subject' && normAccess(game.accessMode) === 'open');
    const fun = games.filter(game => normCategory(game.category) === 'fun' && normAccess(game.accessMode) !== 'hidden');

    container.replaceChildren(
      buildStudentSection('Aktuell freigeschaltet', 'Das ist gerade im Unterricht verfügbar.', current, 'current'),
      buildStudentSection('Freies Üben', 'Diese fachlichen Quiz kannst du jederzeit wiederholen.', practice, 'practice'),
      buildStudentSection('Just for Fun', 'Quiz ohne Unterrichtsbezug, einfach zum Spielen.', fun, 'fun')
    );
  }

  function buildStudentSection(title, subtitle, games, style) {
    const section = document.createElement('section');
    section.className = 'student-game-section-v4';

    const head = document.createElement('div');
    head.className = 'student-game-section-head-v4';
    head.innerHTML = `<div><h3></h3><p></p></div><span class="student-game-count-v4"></span>`;
    head.querySelector('h3').textContent = title;
    head.querySelector('p').textContent = subtitle;
    head.querySelector('span').textContent = `${games.length} ${games.length === 1 ? 'Spiel' : 'Spiele'}`;
    section.append(head);

    if (!games.length) {
      const empty = document.createElement('div');
      empty.className = 'student-game-empty-v4';
      empty.textContent = style === 'current' ? 'Momentan ist hier noch kein Quiz freigeschaltet.' : 'Hier sind aktuell keine Spiele verfügbar.';
      section.append(empty);
      return section;
    }

    const grid = document.createElement('div');
    grid.className = 'student-game-grid-v4';
    for (const game of games) {
      const card = document.createElement('article');
      card.className = `student-game-card-v4 ${style}`;
      const count = Number(game.questionCount || 0);
      card.innerHTML = `<strong></strong><small>${count || '–'} Fragen</small><button type="button" class="btn primary">Spielen</button>`;
      card.querySelector('strong').textContent = game.title || 'Quiz';
      card.querySelector('button').addEventListener('click', () => chooseStudentGame(game));
      grid.append(card);
    }
    section.append(grid);
    return section;
  }

  function chooseStudentGame(game) {
    const name = document.getElementById('student-name');
    const className = document.getElementById('student-class');
    const code = document.getElementById('student-code');
    const error = document.getElementById('student-login-error');

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

    if (error) error.textContent = '';
    if (code) code.value = game.id;
    document.getElementById('student-login-form')?.requestSubmit();
  }

  async function decorateTeacherGames() {
    if (!api.teacherToken?.()) return;
    const now = Date.now();
    if (state.teacherLoading || now - state.lastTeacherLoad < 800) return;
    state.teacherLoading = true;
    state.lastTeacherLoad = now;

    try {
      const games = await api.teacherGamesList();
      if (!Array.isArray(games) || !games.some(game => 'accessMode' in game || 'category' in game)) return;
      state.teacherGames = games;
      state.accessReady = true;
      document.body.classList.add('wwm-access-ready');
      const byId = new Map(games.map(game => [String(game.id), game]));

      document.querySelectorAll('.game-card-v3').forEach(card => {
        const id = card.querySelector('[data-id]')?.dataset.id;
        const game = byId.get(String(id || ''));
        if (!game) return;
        decorateTeacherCard(card, game);
      });
      cleanCodeReferences();
    } catch (error) {
      console.warn('Zugriffssteuerung noch nicht verfügbar:', error);
    } finally {
      state.teacherLoading = false;
    }
  }

  function decorateTeacherCard(card, game) {
    if (card.dataset.accessV4 === '1') return;
    card.dataset.accessV4 = '1';

    const actions = card.querySelector('.game-card-actions');
    if (!actions) return;

    const category = normCategory(game.category);
    const access = normAccess(game.accessMode);

    const controls = document.createElement('div');
    controls.className = 'access-controls-v4';
    controls.innerHTML = `
      <label class="access-control-v4"><span>Bereich</span><select data-access-field="category">
        <option value="subject">Fachlich</option>
        <option value="fun">Just for Fun</option>
      </select></label>
      <label class="access-control-v4"><span>Zugriff</span><select data-access-field="mode">
        <option value="hidden">Versteckt</option>
        <option value="active">Aktuell freigeschaltet</option>
        <option value="open">Immer offen</option>
      </select></label>
      <div class="access-status-v4" data-mode="${access}"><i class="access-dot-v4"></i><span></span></div>`;

    const categorySelect = controls.querySelector('[data-access-field="category"]');
    const modeSelect = controls.querySelector('[data-access-field="mode"]');
    categorySelect.value = category;
    modeSelect.value = access;
    updateStatusText(controls);

    categorySelect.addEventListener('change', async () => {
      if (categorySelect.value === 'fun' && modeSelect.value === 'hidden') modeSelect.value = 'open';
      await saveAccess(game.id, controls, categorySelect.value, modeSelect.value);
    });
    modeSelect.addEventListener('change', () => saveAccess(game.id, controls, categorySelect.value, modeSelect.value));

    actions.before(controls);
  }

  async function saveAccess(gameId, controls, category, accessMode) {
    const status = controls.querySelector('.access-status-v4');
    const selects = controls.querySelectorAll('select');
    selects.forEach(select => select.disabled = true);
    status?.classList.add('saving');
    if (status) status.querySelector('span').textContent = 'Speichern …';

    try {
      await api.teacherSetGameAccess(gameId, category, accessMode);
      if (status) status.dataset.mode = accessMode;
      updateStatusText(controls);
    } catch (error) {
      console.error(error);
      if (status) status.querySelector('span').textContent = 'Konnte nicht gespeichert werden';
    } finally {
      selects.forEach(select => select.disabled = false);
      status?.classList.remove('saving');
    }
  }

  function updateStatusText(controls) {
    const category = controls.querySelector('[data-access-field="category"]')?.value || 'subject';
    const mode = controls.querySelector('[data-access-field="mode"]')?.value || 'hidden';
    const status = controls.querySelector('.access-status-v4');
    if (!status) return;
    status.dataset.mode = mode;
    const text = mode === 'hidden'
      ? 'Für Lernende nicht sichtbar'
      : category === 'fun'
        ? 'Im Bereich «Just for Fun» sichtbar'
        : mode === 'active'
          ? 'Unter «Aktuell freigeschaltet» sichtbar'
          : 'Unter «Freies Üben» sichtbar';
    status.querySelector('span').textContent = text;
  }

  function normCategory(value) {
    return String(value || '').toLowerCase() === 'fun' ? 'fun' : 'subject';
  }

  function normAccess(value) {
    const mode = String(value || '').toLowerCase();
    return ['hidden','active','open'].includes(mode) ? mode : 'hidden';
  }
}
