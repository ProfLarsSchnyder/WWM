import { shuffleAnswers } from './importer.js';
import {
  playCue, startLoop, stopAll, stopLoop, stopForeground,
  pauseLoop, resumeLoop, setAudioEnabled, isAudioEnabled,
  isForegroundPlaying, questionTrack
} from './audio.js';
import { S,$,$$,money,sleep,screen,shuffleInPlace,toast } from './state-v2.js';

function choose(questions) {
  const copy = questions.map(question => ({ ...question, wrong: [...question.wrong] }));
  return copy.length <= 15 ? copy : shuffleInPlace(copy).slice(0,15);
}

export function startGame(game) {
  if (!game?.questions?.length) return toast('Dieses Spiel enthält keine Fragen.', true);

  stopAll();
  setAudioEnabled(true);
  $('#audio-toggle').textContent = '🔊';
  const seq = ++S.seq;
  Object.assign(S, {
    game,
    qs: choose(game.questions),
    i: 0,
    answers: [],
    sel: null,
    locked: false,
    finished: false,
    jokerBusy: false,
    name: '',
    introReady: false,
    jokers: { fifty:false, audience:false, phone:false, teacher:false }
  });

  $$('[data-joker]').forEach(button => button.classList.remove('used'));
  $('#intro-game-title').textContent = game.title;
  $('#contestant-name').value = '';
  $('#intro-audio-status').textContent = 'Das Intro läuft ...';
  $('#intro-progress-bar').style.width = '0%';
  $('#begin-questions').disabled = true;
  $('#begin-questions').classList.remove('ready');
  screen('game-intro');
  $('#contestant-name').focus();
  runIntro(seq);
}

async function runIntro(seq) {
  const durationMs = 31320;
  const startedAt = performance.now();
  const progressTimer = window.setInterval(() => {
    if (seq !== S.seq) return window.clearInterval(progressTimer);
    const progress = Math.min(98, (performance.now() - startedAt) / durationMs * 100);
    $('#intro-progress-bar').style.width = `${progress}%`;
  }, 150);

  const result = await playCue('intro');
  window.clearInterval(progressTimer);

  if (seq !== S.seq || !$('#screen-game-intro').classList.contains('active')) return;
  $('#intro-progress-bar').style.width = '100%';
  $('#intro-audio-status').textContent = result.reason === 'ended'
    ? 'Intro beendet. Der heisse Stuhl wartet.'
    : 'Bereit. Der heisse Stuhl wartet.';
  S.introReady = true;
  $('#begin-questions').disabled = false;
  $('#begin-questions').classList.add('ready');
}

export function cancelIntro() {
  ++S.seq;
  stopAll();
  S.finished = true;
  screen('home');
}

export function beginQuestions() {
  if (!S.game || !S.introReady) return;
  stopAll();
  S.name = $('#contestant-name').value.trim() || 'Kandidat/in';
  $('#game-title-display').textContent = S.game.title;
  $('#contestant-display').textContent = S.name;
  screen('game');
  renderQuestion();
}

function renderQuestion() {
  const question = S.qs[S.i];
  if (!question) return finish(true);

  stopAll();
  S.sel = null;
  S.locked = false;
  S.answers = shuffleAnswers(question);

  const questionElement = $('#question-text');
  questionElement.textContent = question.question;
  questionElement.classList.remove('enter');
  void questionElement.offsetWidth;
  questionElement.classList.add('enter');

  $('#question-progress').textContent = `Frage ${S.i + 1} von ${S.qs.length}`;
  $('#game-status').textContent = money[S.i];
  $('#lock-answer').disabled = true;
  $('#lock-answer').classList.remove('hidden');
  $('#next-question').classList.add('hidden');

  const box = $('#answers');
  box.replaceChildren();
  for (const answer of S.answers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    button.dataset.key = answer.key;
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.textContent = `${answer.key.toUpperCase()}:`;
    const text = document.createElement('span');
    text.textContent = answer.text;
    button.append(letter, text);
    button.onclick = () => select(answer.key);
    box.append(button);
  }

  ladder();
  startLoop(questionTrack(S.i));
}

function select(key) {
  if (S.locked || S.jokerBusy) return;
  const button = document.querySelector(`.answer[data-key="${key}"]`);
  if (!button || button.classList.contains('removed')) return;
  $$('.answer').forEach(answer => answer.classList.remove('selected'));
  button.classList.add('selected');
  S.sel = key;
  $('#lock-answer').disabled = false;
  $('#game-status').textContent = `Antwort ${key.toUpperCase()} ausgewählt`;
}

export async function lockAnswer() {
  if (!S.sel || S.locked || S.jokerBusy) return;
  S.locked = true;
  const seq = S.seq;
  $$('.answer').forEach(answer => answer.classList.add('locked'));
  $('#lock-answer').disabled = true;
  $('#game-status').textContent = 'Antwort ist eingeloggt ...';

  if (S.i >= 10) {
    stopLoop();
    await playCue(S.i === 14 ? 'lock-million' : 'lock-high');
  } else {
    await sleep(1250);
  }

  if (seq === S.seq && !S.finished) await reveal(seq);
}

async function reveal(seq) {
  if (seq !== S.seq || S.finished) return;

  stopLoop();
  stopForeground();

  const correct = S.answers.find(answer => answer.correct);
  const chosen = S.answers.find(answer => answer.key === S.sel);
  const correctElement = document.querySelector(`.answer[data-key="${correct.key}"]`);
  const chosenElement = document.querySelector(`.answer[data-key="${chosen.key}"]`);
  correctElement?.classList.add('correct');

  if (!chosen.correct) {
    chosenElement?.classList.remove('selected');
    chosenElement?.classList.add('wrong');
    $('#game-status').textContent = `Leider falsch. Richtig ist ${correct.key.toUpperCase()}.`;
    await playCue(S.i === 14 ? 'wrong-million' : 'wrong');
    if (seq === S.seq) finish(false);
    return;
  }

  chosenElement?.classList.remove('selected');
  $('#game-status').textContent = `Richtig, ${money[S.i]}!`;
  $('#lock-answer').classList.add('hidden');

  let cue = 'correct-low';
  if (S.i === 4) cue = 'safe1';
  else if (S.i === 9) cue = 'safe2';
  else if (S.i >= 10 && S.i < 14) cue = 'correct-high';
  else if (S.i === 14) cue = 'correct-million';

  await playCue(cue);
  if (seq !== S.seq || S.finished) return;

  if (S.i >= S.qs.length - 1 || S.i >= 14) finish(true);
  else $('#next-question').classList.remove('hidden');
}

export function nextQuestion() {
  if (!S.locked || S.finished || S.jokerBusy) return;
  stopAll();
  S.i += 1;
  renderQuestion();
}

function ladder() {
  const box = $('#money-ladder');
  box.replaceChildren();
  for (let index = 14; index >= 0; index--) {
    const step = document.createElement('div');
    step.className = 'money-step';
    if ([4,9,14].includes(index)) step.classList.add('safe');
    if (index === S.i && !S.finished) step.classList.add('active');
    if (index < S.i) step.classList.add('done');
    step.innerHTML = `<span class="n">${index + 1}</span><span>${money[index]}</span>`;
    box.append(step);
  }
}

export async function useJoker(type) {
  if (!S.game || S.finished || S.locked || S.jokerBusy || S.jokers[type]) return;
  S.jokers[type] = true;
  document.querySelector(`[data-joker="${type}"]`)?.classList.add('used');
  pauseLoop();
  S.jokerBusy = true;
  const seq = S.seq;

  if (type === 'fifty') await fifty(seq);
  if (type === 'audience') await audience(seq);
  if (type === 'phone') await phone(seq);
  if (type === 'teacher') await teacher(seq);
}

async function fifty(seq) {
  const wrongKeys = shuffleInPlace(S.answers.filter(answer => !answer.correct).map(answer => answer.key));
  const cue = playCue('joker-fifty');
  await sleep(isAudioEnabled() ? 1350 : 150);
  if (seq !== S.seq) return;

  const removedKeys = wrongKeys.slice(0,2);
  removedKeys.forEach(key => {
    document.querySelector(`.answer[data-key="${key}"]`)?.classList.add('removed');
  });
  if (removedKeys.includes(S.sel)) {
    S.sel = null;
    $$('.answer').forEach(answer => answer.classList.remove('selected'));
    $('#lock-answer').disabled = true;
  }
  $('#game-status').textContent = '50:50 Joker eingesetzt';

  await cue;
  if (seq !== S.seq) return;
  S.jokerBusy = false;
  await resumeLoop();
}

function activeAnswerKeys() {
  return S.answers.filter(answer => {
    const element = document.querySelector(`.answer[data-key="${answer.key}"]`);
    return !element?.classList.contains('removed');
  }).map(answer => answer.key);
}

function audienceValues() {
  const correct = S.answers.find(answer => answer.correct);
  const keys = ['a','b','c','d'];
  const active = new Set(activeAnswerKeys());
  const raw = keys.map(key => active.has(key) ? 8 + Math.random() * 16 : 0);
  const correctIndex = keys.indexOf(correct.key);
  raw[correctIndex] += 56 - S.i / 14 * 28 + Math.random() * 8;
  const total = raw.reduce((a,b) => a+b,0);
  const values = raw.map(value => value ? Math.round(value / total * 100) : 0);
  values[correctIndex] += 100 - values.reduce((a,b) => a+b,0);
  return values;
}

function audienceBars(values) {
  return values.map((value,index) => `
    <div class="audience-col">
      <div class="audience-value">${value}%</div>
      <div class="audience-bar" style="height:${Math.max(8,value*2.15)}px"></div>
      <div class="audience-letter">${'ABCD'[index]}</div>
    </div>`).join('');
}

async function audience(seq) {
  const values = audienceValues();
  const bars = audienceBars(values);

  modal(`<div class="joker-phase">
    <div class="phase-icon">👥</div>
    <h3>Publikumsjoker</h3>
    <div class="phase-copy">Die Frage geht ans Publikum.</div>
    <div class="audience-wait"><span></span><span></span><span></span><span></span></div>
  </div>`, true);

  const cue = playCue('joker-audience');
  await sleep(isAudioEnabled() ? 4200 : 180);
  if (seq !== S.seq) return;

  modal(`<div class="joker-phase">
    <div class="phase-icon">👥</div>
    <h3>Publikumsjoker</h3>
    <div class="phase-copy">Jetzt wird abgestimmt ...</div>
    <div class="audience-wait"><span></span><span></span><span></span><span></span></div>
  </div>`, true);

  await sleep(isAudioEnabled() && isForegroundPlaying() ? 15800 : 180);
  if (seq !== S.seq) return;

  modal(`<div class="joker-phase">
    <div class="phase-icon">👥</div>
    <h3>Publikumsjoker</h3>
    <div class="phase-copy">Die letzten Stimmen kommen rein ...</div>
    <div class="audience-wait closing"><span></span><span></span><span></span><span></span></div>
  </div>`, true);

  await sleep(isAudioEnabled() && isForegroundPlaying() ? 7600 : 180);
  if (seq !== S.seq) return;

  modal(`<h3>Das Publikum hat gewählt</h3>
    <div class="audience-chart">${bars}</div>
    <div class="phase-copy">Das Ergebnis steht fest.</div>`, true);

  await cue;
  if (seq !== S.seq) return;

  modal(`<h3>Das Publikum hat gewählt</h3>
    <div class="audience-chart">${bars}</div>
    <div class="modal-actions"><button class="btn primary" data-modal="close-joker">Zurück zur Frage</button></div>`, true);
}

function phoneAdvice() {
  const active = new Set(activeAnswerKeys());
  const available = S.answers.filter(answer => active.has(answer.key));
  const correct = available.find(answer => answer.correct) || S.answers.find(answer => answer.correct);
  const wrong = available.filter(answer => !answer.correct);
  const reliability = Math.max(.50, .86 - S.i * .022);
  const guess = !wrong.length || Math.random() < reliability ? correct : wrong[Math.floor(Math.random() * wrong.length)];
  const alternatives = available.filter(answer => answer.key !== guess.key);
  const other = alternatives[Math.floor(Math.random() * alternatives.length)] || guess;

  const confident = [
    `«Mein erster Gedanke ist <strong>${guess.key.toUpperCase()}</strong>. Je länger ich darüber nachdenke, desto besser passt diese Antwort.»`,
    `«${other.key.toUpperCase()} würde ich eher streichen. Für mich spricht deutlich mehr für <strong>${guess.key.toUpperCase()}</strong>.»`,
    `«Ich würde mich festlegen: <strong>${guess.key.toUpperCase()}</strong>. Das erscheint mir von den vier Möglichkeiten am schlüssigsten.»`
  ];
  const unsure = [
    `«Ich schwanke noch etwas. ${other.key.toUpperCase()} überzeugt mich nicht, spontan würde ich <strong>${guess.key.toUpperCase()}</strong> nehmen.»`,
    `«Ganz sicher bin ich nicht, aber mein Bauchgefühl geht zu <strong>${guess.key.toUpperCase()}</strong>.»`,
    `«Ich kann es nicht garantieren. Wenn ich mich entscheiden müsste, wäre es <strong>${guess.key.toUpperCase()}</strong>.»`
  ];
  const pool = guess.correct ? confident : unsure;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function phone(seq) {
  const advice = phoneAdvice();

  modal(`<div class="joker-phase">
    <div class="phase-icon">💬</div>
    <h3>Telefonjoker</h3>
    <div class="phone-words"><em>Die Frage wird weitergegeben. Der Joker hört genau zu ...</em></div>
  </div>`, true);

  const cue = playCue('joker-phone');
  await sleep(isAudioEnabled() ? 4800 : 180);
  if (seq !== S.seq) return;

  modal(`<div class="joker-phase">
    <div class="phase-icon">💬</div>
    <h3>Telefonjoker</h3>
    <div class="phone-words"><em>«Okay ... gib mir einen Moment. Ich sortiere die vier Möglichkeiten.»</em></div>
  </div>`, true);

  await sleep(isAudioEnabled() && isForegroundPlaying() ? 10400 : 180);
  if (seq !== S.seq) return;

  modal(`<div class="joker-phase">
    <div class="phase-icon">💬</div>
    <h3>Telefonjoker</h3>
    <div class="phone-words"><em>«Zwei Antworten wirken auf mich eher unwahrscheinlich. Ich denke noch kurz nach ...»</em></div>
  </div>`, true);

  await sleep(isAudioEnabled() && isForegroundPlaying() ? 11800 : 180);
  if (seq !== S.seq) return;

  modal(`<div class="joker-phase">
    <div class="phase-icon">💬</div>
    <h3>Der Tipp</h3>
    <div class="phone-words"><em>${advice}</em></div>
  </div>`, true);

  await cue;
  if (seq !== S.seq) return;

  modal(`<div class="joker-phase">
    <div class="phase-icon">💬</div>
    <h3>Der Tipp</h3>
    <div class="phone-words"><em>${advice}</em></div>
    <div class="modal-actions"><button class="btn primary" data-modal="close-joker">Zurück zur Frage</button></div>
  </div>`, true);
}

async function teacher(seq) {
  modal(`<div class="teacher-screen">
    <div class="teacher-badge">L</div>
    <h3>Lehrerjoker</h3>
    <div class="joker-message">Der Lehrerjoker wird aktiviert ...</div>
  </div>`, true);

  await playCue('joker-teacher');
  if (seq !== S.seq) return;

  modal(`<div class="teacher-screen">
    <div class="teacher-badge">L</div>
    <h3>Lehrerjoker</h3>
    <div class="joker-message">Jetzt ist die Lehrperson dran und darf einen mündlichen Hinweis geben.</div>
    <div class="modal-actions"><button class="btn primary" data-modal="close-joker">Weiterspielen</button></div>
  </div>`, true);
}

async function closeJoker() {
  stopForeground();
  S.jokerBusy = false;
  closeModal(true);
  if (!S.locked && !S.finished) await resumeLoop();
}

function finish(won) {
  if (S.finished) return;
  S.finished = true;
  stopAll();

  let amount = '0 €';
  if (won) amount = money[Math.min(S.i,14)];
  else if (S.i >= 10) amount = money[9];
  else if (S.i >= 5) amount = money[4];

  modal(`<img src="assets/logo/wwm-logo-sharp.webp" alt="" class="end-logo">
    <h3>${won ? 'Geschafft!' : 'Spiel beendet'}</h3>
    <div class="joker-message">${won ? `${S.name} hat ${amount} erreicht.` : `${S.name} geht mit ${amount} nach Hause.`}</div>
    <div class="modal-actions">
      <button class="btn" data-modal="restart">Noch einmal</button>
      <button class="btn primary" data-modal="home">Zum Start</button>
    </div>`, true);

  playCue('outro');
}

export function quit() {
  if (!confirm('Spiel wirklich beenden?')) return;
  ++S.seq;
  stopAll();
  S.finished = true;
  S.jokerBusy = false;
  screen('home');
}

function modal(html, persistent = false) {
  const backdrop = $('#modal');
  const content = $('#modal-content');
  content.innerHTML = html;
  backdrop.classList.remove('hidden');
  backdrop.dataset.persistent = persistent ? '1' : '0';

  content.querySelectorAll('[data-modal]').forEach(button => {
    button.onclick = () => {
      const action = button.dataset.modal;
      if (action === 'close') closeModal();
      if (action === 'close-joker') closeJoker();
      if (action === 'restart') {
        closeModal(true);
        startGame(S.game);
      }
      if (action === 'home') {
        ++S.seq;
        closeModal(true);
        stopAll();
        S.jokerBusy = false;
        screen('home');
      }
    };
  });
}

export function closeModal(force = false) {
  const backdrop = $('#modal');
  if (!force && backdrop.dataset.persistent === '1') return;
  backdrop.classList.add('hidden');
  backdrop.dataset.persistent = '0';
  $('#modal-content').replaceChildren();
}

export function toggleAudio() {
  const on = setAudioEnabled(!isAudioEnabled());
  $('#audio-toggle').textContent = on ? '🔊' : '🔇';
  if (on && $('#screen-game').classList.contains('active') && !S.finished && !S.locked && !S.jokerBusy) {
    startLoop(questionTrack(S.i));
  }
}
