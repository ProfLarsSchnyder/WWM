from pathlib import Path

# ---------- app-v3.js ----------
p = Path('js/app-v3.js')
t = p.read_text(encoding='utf-8')

old = '''function renderTeacherGames() {
  const box = $('#teacher-games');
  box.replaceChildren();
  $('#teacher-empty').classList.toggle('hidden', state.teacherGames.length > 0);

  for (const game of state.teacherGames) {
    const card = document.createElement('article');
    card.className = 'game-card-v3';
    const questionCount = Array.isArray(game.questions) ? game.questions.length : 0;
    card.innerHTML = `
      <h3></h3>
      <div class="game-card-meta">${questionCount} Fragen · Code ${escapeHtml(game.joinCode || '------')} · geändert ${formatDate(game.updatedAt)}</div>
      <div class="game-card-actions">
        <button class="btn primary" data-action="game-beamer" data-id="${game.id}">Beamer</button>
        <button class="btn" data-action="game-code" data-id="${game.id}">Code anzeigen</button>
        <button class="btn" data-action="game-edit" data-id="${game.id}">Bearbeiten</button>
        <button class="btn" data-action="game-duplicate" data-id="${game.id}">Duplizieren</button>
        <button class="btn danger-btn" data-action="game-delete" data-id="${game.id}">Löschen</button>
      </div>`;
    card.querySelector('h3').textContent = game.title;
    box.append(card);
  }
}
'''
new = '''function renderTeacherGames() {
  const box = $('#teacher-games');
  box.replaceChildren();
  $('#teacher-empty').classList.toggle('hidden', state.teacherGames.length > 0);
  if (!state.teacherGames.length) return;

  const grouped = new Map();
  for (const game of state.teacherGames) {
    const folder = String(game.folder || '').trim();
    if (!grouped.has(folder)) grouped.set(folder, []);
    grouped.get(folder).push(game);
  }

  const folders = [...grouped.keys()].sort((a, b) => {
    if (!a && b) return 1;
    if (a && !b) return -1;
    return a.localeCompare(b, 'de-CH', { sensitivity: 'base' });
  });

  for (const folder of folders) {
    const section = document.createElement('section');
    section.className = 'folder-section-v3';

    const head = document.createElement('div');
    head.className = 'folder-head-v3';
    const title = document.createElement('h3');
    title.textContent = folder ? `📁 ${folder}` : '🗂️ Ohne Ordner';
    const count = document.createElement('span');
    const games = grouped.get(folder) || [];
    count.textContent = `${games.length} ${games.length === 1 ? 'Spiel' : 'Spiele'}`;
    head.append(title, count);

    const grid = document.createElement('div');
    grid.className = 'game-grid-v3';
    for (const game of games) grid.append(renderTeacherGameCard(game));

    section.append(head, grid);
    box.append(section);
  }
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
      <button class="btn" data-action="game-edit" data-id="${game.id}">Bearbeiten</button>
      <button class="btn" data-action="game-duplicate" data-id="${game.id}">Duplizieren</button>
      <button class="btn danger-btn" data-action="game-delete" data-id="${game.id}">Löschen</button>
    </div>`;
  card.querySelector('h3').textContent = game.title;
  return card;
}
'''
assert old in t, 'renderTeacherGames block not found'
t = t.replace(old, new, 1)

old = '''  const copy = {
    id: crypto.randomUUID(),
    title: `${game.title} Kopie`,
    questions: game.questions.map(question => ({ ...question, id: crypto.randomUUID(), wrong: [...question.wrong] }))
  };'''
new = '''  const copy = {
    id: crypto.randomUUID(),
    title: `${game.title} Kopie`,
    folder: game.folder || '',
    questions: game.questions.map(question => ({ ...question, id: crypto.randomUUID(), wrong: [...question.wrong] }))
  };'''
assert old in t, 'duplicate block not found'
t = t.replace(old, new, 1)

old = '''  $('#editor-v3-title').textContent = game ? 'Spiel bearbeiten' : 'Neues Spiel';
  $('#editor-game-title').value = game?.title || '';
  $('#editor-import-simple').value = '';'''
new = '''  $('#editor-v3-title').textContent = game ? 'Spiel bearbeiten' : 'Neues Spiel';
  $('#editor-game-title').value = game?.title || '';
  $('#editor-game-folder').value = game?.folder || '';
  const folderSuggestions = $('#editor-folder-suggestions');
  folderSuggestions.replaceChildren();
  [...new Set(state.teacherGames.map(item => String(item.folder || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de-CH', { sensitivity: 'base' }))
    .forEach(folder => {
      const option = document.createElement('option');
      option.value = folder;
      folderSuggestions.append(option);
    });
  $('#editor-import-simple').value = '';'''
assert old in t, 'openEditor title block not found'
t = t.replace(old, new, 1)

old = '''  const title = $('#editor-game-title').value.trim();
  if (!title) throw new Error('Bitte gib dem Spiel einen Titel.');
  const questions = validateQuestions(state.editorQuestions);'''
new = '''  const title = $('#editor-game-title').value.trim();
  const folder = $('#editor-game-folder').value.trim();
  if (!title) throw new Error('Bitte gib dem Spiel einen Titel.');
  const questions = validateQuestions(state.editorQuestions);'''
assert old in t, 'saveEditor title block not found'
t = t.replace(old, new, 1)

old = '''    createdAt: state.editorCreatedAt || undefined,
    title,
    questions
  });'''
new = '''    createdAt: state.editorCreatedAt || undefined,
    title,
    folder,
    questions
  });'''
assert old in t, 'save payload block not found'
t = t.replace(old, new, 1)

start = t.index('async function usePhone(seq) {')
end = t.index('\nfunction phonePhase(text, remaining)', start)
new_phone = r'''function phoneConversationScript(result) {
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
'''
t = t[:start] + new_phone + t[end:]
p.write_text(t, encoding='utf-8')

# ---------- index.html ----------
p = Path('index.html')
t = p.read_text(encoding='utf-8')
t = t.replace('<div id="teacher-games" class="game-grid-v3"></div>', '<div id="teacher-games" class="folder-list-v3"></div>', 1)
old = '''            <label class="field-label" for="editor-game-title">Titel des Spiels</label>
            <input id="editor-game-title" class="text-input" type="text" placeholder="z. B. Angebot und Nachfrage">

            <div class="import-tabs-v3">'''
new = '''            <label class="field-label" for="editor-game-title">Titel des Spiels</label>
            <input id="editor-game-title" class="text-input" type="text" placeholder="z. B. Angebot und Nachfrage">

            <label class="field-label folder-field-label" for="editor-game-folder">Ordner <span class="section-muted">optional</span></label>
            <input id="editor-game-folder" class="text-input" type="text" maxlength="80" list="editor-folder-suggestions" placeholder="z. B. VWL, Recht oder Prüfungen">
            <datalist id="editor-folder-suggestions"></datalist>
            <p class="folder-field-hint">Bestehenden Ordner auswählen oder einen neuen Namen eingeben. Ohne Eintrag bleibt das Spiel unter «Ohne Ordner».</p>

            <div class="import-tabs-v3">'''
assert old in t, 'editor title area not found'
t = t.replace(old, new, 1)
t = t.replace('styles-v3.css?v=20260926-phone3', 'styles-v3.css?v=20260927-folders1')
t = t.replace('js/app-v3.js?v=20260926-analysis3', 'js/app-v3.js?v=20260927-phonefolders1')
p.write_text(t, encoding='utf-8')

# ---------- styles-v3.css ----------
p = Path('styles-v3.css')
t = p.read_text(encoding='utf-8')
addon = '''

/* Teacher folders */
.folder-list-v3{display:grid;gap:22px}
.folder-section-v3{display:grid;gap:11px}
.folder-head-v3{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 3px}
.folder-head-v3 h3{margin:0;font-size:18px;color:#eef1ff}
.folder-head-v3 span{font-size:12px;color:var(--v3-muted);font-weight:800}
.folder-field-label{margin-top:14px;display:block}
.folder-field-hint{margin:7px 0 0;color:var(--v3-muted);font-size:12px;line-height:1.4}
'''
if '/* Teacher folders */' not in t:
    t += addon
p.write_text(t, encoding='utf-8')
