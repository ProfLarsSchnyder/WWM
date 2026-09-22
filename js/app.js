import { parseSimpleText, parseCSV, parseJSON, validateQuestions, shuffleAnswers } from "./importer.js";
import { initStorage, getBackend, listGames, getGame, saveGame, deleteGame, duplicateGame } from "./storage.js";
import { playClip, stopAll, stopLoop } from "./audio.js";

const money = [
  "50 €", "100 €", "200 €", "300 €", "500 €",
  "1'000 €", "2'000 €", "4'000 €", "8'000 €", "16'000 €",
  "32'000 €", "64'000 €", "125'000 €", "500'000 €", "1'000'000 €"
];

const demoQuestions = [
  q("Was bezeichnet das Zusammentreffen von Angebot und Nachfrage?", "Markt", "Budget", "Bilanz", "Monopol"),
  q("Was passiert ceteris paribus mit der nachgefragten Menge, wenn der Preis eines Gutes sinkt?", "Sie steigt", "Sie sinkt", "Sie bleibt zwingend gleich", "Das Angebot verschwindet"),
  q("Welches Gut ist typischerweise ein Substitut für Butter?", "Margarine", "Brot", "Salz", "Milch"),
  q("Welche Aussage beschreibt den Gleichgewichtspreis?", "Angebotsmenge und Nachfragemenge stimmen überein", "Angebot ist immer grösser als Nachfrage", "Nachfrage ist immer grösser als Angebot", "Der Staat legt ihn immer fest"),
  q("Was misst die Preiselastizität der Nachfrage?", "Die Reaktion der Nachfrage auf eine Preisänderung", "Die Produktionskosten", "Die Inflationsrate", "Die Höhe der Mehrwertsteuer"),
  q("Welcher Produktionsfaktor umfasst Maschinen und Gebäude?", "Kapital", "Arbeit", "Boden", "Konsum"),
  q("Welches Beispiel kann Marktversagen darstellen?", "Negative externe Effekte", "Vollständige Konkurrenz", "Sinkende Produktionskosten", "Hohe Konsumentenrente"),
  q("Welche Grösse gehört zum einfachen Wirtschaftskreislauf?", "Güterstrom", "Temperaturstrom", "Notenstrom", "Verkehrsstrom"),
  q("Was beschreibt Inflation am treffendsten?", "Ein anhaltender Anstieg des allgemeinen Preisniveaus", "Ein einzelner höherer Preis", "Sinkende Löhne in einem Unternehmen", "Mehr Exporte als Importe"),
  q("Was bewirkt ein gesetzlicher Höchstpreis direkt?", "Er begrenzt einen Preis nach oben", "Er begrenzt einen Preis nach unten", "Er verbietet die Nachfrage", "Er verdoppelt das Angebot"),
  q("Was entsteht typischerweise bei einem wirksamen Höchstpreis unter dem Gleichgewichtspreis?", "Ein Nachfrageüberschuss", "Ein Angebotsüberschuss", "Keine Veränderung", "Zwingend ein Monopol"),
  q("Welche Eigenschaft kann für ein öffentliches Gut typisch sein?", "Nichtausschliessbarkeit", "Vollständige Ausschliessbarkeit", "Immer ein hoher Marktpreis", "Produktion nur durch private Unternehmen"),
  q("Welche Veränderung verschiebt die Nachfrage nach einem normalen Gut nach rechts?", "Steigendes Einkommen", "Steigende Produktionskosten", "Sinkende Zahl der Konsumenten", "Technischer Fortschritt bei den Produzenten"),
  q("Wie gross ist die Preiselastizität bei vollkommen unelastischer Nachfrage betragsmässig?", "0", "1", "2", "Unendlich"),
  q("Was ist bei negativen externen Effekten ohne Korrektur typischerweise der Fall?", "Es wird gesellschaftlich zu viel produziert", "Es wird gesellschaftlich zu wenig produziert", "Der Marktpreis ist immer null", "Es entstehen keine privaten Kosten")
];

const state = {
  editorGameId: null,
  editorCreatedAt: null,
  editorQuestions: [],
  importMode: "simple",
  game: null,
  gameQuestions: [],
  currentIndex: 0,
  currentAnswers: [],
  selectedKey: null,
  locked: false,
  gameFinished: false,
  jokers: { fifty: false, audience: false, phone: false, teacher: false }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

await initStorage();
bindGlobalActions();
bindImportTabs();
bindGameControls();
showScreen("home");

function q(question, correct, ...wrong) {
  return { id: crypto.randomUUID(), question, correct, wrong };
}

function bindGlobalActions() {
  document.addEventListener("click", async event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;

    try {
      if (action === "home") showScreen("home");
      if (action === "library") await renderLibrary();
      if (action === "new-game") openEditor();
      if (action === "quick-demo") startGame({ id: "demo", title: "Demo: Volkswirtschaft", questions: demoQuestions });
      if (action === "load-example") loadExample();
      if (action === "import-questions") importQuestions(false);
      if (action === "preview-import") previewImport();
      if (action === "save-game") await saveEditorGame();
      if (action === "add-question") addEditorQuestion();
      if (action === "fullscreen") toggleFullscreen();
      if (action === "restart-game") restartGame();
      if (action === "quit-game") quitGame();
    } catch (error) {
      console.error(error);
      toast(error.message || "Etwas ist schiefgelaufen.", true);
    }
  });
}

function bindImportTabs() {
  $$("[data-import-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      state.importMode = tab.dataset.importTab;
      $$("[data-import-tab]").forEach(item => item.classList.toggle("active", item === tab));
      $$("[data-import-pane]").forEach(pane => pane.classList.toggle("active", pane.dataset.importPane === state.importMode));
    });
  });
}

function bindGameControls() {
  $("#lock-answer").addEventListener("click", lockAnswer);
  $("#next-question").addEventListener("click", nextQuestion);

  $$("[data-joker]").forEach(button => {
    button.addEventListener("click", () => useJoker(button.dataset.joker));
  });

  $("#modal").addEventListener("click", event => {
    if (event.target === $("#modal")) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (!$("#screen-game").classList.contains("active")) return;
    if (!$("#modal").classList.contains("hidden")) {
      if (event.key === "Escape") closeModal();
      return;
    }

    if (["1", "2", "3", "4"].includes(event.key) && !state.locked) {
      const key = ["a", "b", "c", "d"][Number(event.key) - 1];
      const element = document.querySelector(`.answer[data-key="${key}"]`);
      if (element && !element.classList.contains("removed")) element.click();
    }

    if (event.key === "Enter") {
      if (!state.locked && state.selectedKey) lockAnswer();
      else if (state.locked && !$("#next-question").classList.contains("hidden")) nextQuestion();
    }

    const key = event.key.toLowerCase();
    if (key === "f") useJoker("fifty");
    if (key === "p") useJoker("audience");
    if (key === "t") useJoker("phone");
    if (key === "l") useJoker("teacher");
  });
}

function showScreen(name) {
  $$(".screen").forEach(screen => screen.classList.remove("active"));
  $(`#screen-${name}`).classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function renderLibrary() {
  showScreen("library");
  const games = await listGames();
  const list = $("#library-list");
  list.replaceChildren();
  $("#library-empty").classList.toggle("hidden", games.length > 0);

  for (const game of games) {
    const card = document.createElement("article");
    card.className = "game-card";

    const title = document.createElement("h3");
    title.textContent = game.title;

    const meta = document.createElement("div");
    meta.className = "game-card-meta";
    const date = game.updatedAt ? new Date(game.updatedAt).toLocaleDateString("de-CH") : "";
    meta.textContent = `${game.questions.length} Fragen${date ? ` · zuletzt geändert ${date}` : ""}`;

    const actions = document.createElement("div");
    actions.className = "game-card-actions";
    actions.append(
      libraryButton("Spielen", "primary", () => startGame(game)),
      libraryButton("Bearbeiten", "", () => openEditor(game)),
      libraryButton("Duplizieren", "", async () => {
        await duplicateGame(game.id);
        toast("Spiel dupliziert.");
        await renderLibrary();
      }),
      libraryButton("Löschen", "", async () => {
        if (!confirm(`«${game.title}» wirklich löschen?`)) return;
        await deleteGame(game.id);
        await renderLibrary();
      })
    );

    card.append(title, meta, actions);
    list.append(card);
  }
}

function libraryButton(text, extraClass, onClick) {
  const button = document.createElement("button");
  button.className = `btn small ${extraClass}`.trim();
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function openEditor(game = null) {
  state.editorGameId = game?.id ?? null;
  state.editorCreatedAt = game?.createdAt ?? null;
  state.editorQuestions = (game?.questions ?? []).map(question => ({
    id: question.id || crypto.randomUUID(),
    question: question.question,
    correct: question.correct,
    wrong: [...question.wrong]
  }));

  $("#game-title").value = game?.title ?? "";
  $("#editor-heading").textContent = game ? "Spiel bearbeiten" : "Neues Spiel";
  $("#simple-import").value = "";
  $("#csv-import").value = "";
  $("#json-import").value = "";
  renderEditorQuestions();
  showScreen("editor");
}

function addEditorQuestion(question = q("", "", "", "", "")) {
  syncEditorFromDOM();
  state.editorQuestions.push(question);
  renderEditorQuestions();
  requestAnimationFrame(() => {
    const cards = $$(".question-card");
    cards.at(-1)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderEditorQuestions() {
  const list = $("#question-list");
  list.replaceChildren();
  $("#question-count").textContent = state.editorQuestions.length;

  state.editorQuestions.forEach((question, index) => {
    const fragment = $("#question-editor-template").content.cloneNode(true);
    const card = fragment.querySelector(".question-card");
    card.dataset.index = index;
    card.querySelector(".question-number").textContent = `Frage ${index + 1}`;
    card.querySelector('[data-field="question"]').value = question.question;
    card.querySelector('[data-field="correct"]').value = question.correct;
    card.querySelector('[data-field="wrong0"]').value = question.wrong[0] ?? "";
    card.querySelector('[data-field="wrong1"]').value = question.wrong[1] ?? "";
    card.querySelector('[data-field="wrong2"]').value = question.wrong[2] ?? "";

    card.querySelectorAll("[data-q-action]").forEach(button => {
      button.addEventListener("click", () => handleQuestionAction(index, button.dataset.qAction));
    });

    list.append(fragment);
  });
}

function handleQuestionAction(index, action) {
  syncEditorFromDOM();
  if (action === "delete") state.editorQuestions.splice(index, 1);
  if (action === "up" && index > 0) [state.editorQuestions[index - 1], state.editorQuestions[index]] = [state.editorQuestions[index], state.editorQuestions[index - 1]];
  if (action === "down" && index < state.editorQuestions.length - 1) [state.editorQuestions[index + 1], state.editorQuestions[index]] = [state.editorQuestions[index], state.editorQuestions[index + 1]];
  renderEditorQuestions();
}

function syncEditorFromDOM() {
  const cards = $$(".question-card");
  if (!cards.length) return;
  state.editorQuestions = cards.map((card, index) => ({
    id: state.editorQuestions[index]?.id ?? crypto.randomUUID(),
    question: card.querySelector('[data-field="question"]').value.trim(),
    correct: card.querySelector('[data-field="correct"]').value.trim(),
    wrong: [0, 1, 2].map(i => card.querySelector(`[data-field="wrong${i}"]`).value.trim())
  }));
}

function parseActiveImport() {
  if (state.importMode === "simple") return parseSimpleText($("#simple-import").value);
  if (state.importMode === "csv") return parseCSV($("#csv-import").value);
  return parseJSON($("#json-import").value);
}

function importQuestions(previewOnly = false) {
  const imported = parseActiveImport();
  if (!imported.length) throw new Error("Keine Fragen erkannt.");
  if (previewOnly) return imported;

  syncEditorFromDOM();
  let shouldReplace = state.editorQuestions.length === 0;
  if (!shouldReplace) shouldReplace = confirm(`${imported.length} Fragen erkannt. OK ersetzt die bisherigen Fragen, Abbrechen hängt sie an.`);
  state.editorQuestions = shouldReplace ? imported : [...state.editorQuestions, ...imported];
  renderEditorQuestions();
  toast(`${imported.length} Fragen übernommen.`);
}

function previewImport() {
  const imported = importQuestions(true);
  showModal(`
    <h3>Import erkannt</h3>
    <div class="joker-message">${imported.length} vollständige Fragen wurden erkannt.</div>
    <div class="modal-actions"><button class="btn primary" data-modal="close">Schliessen</button></div>
  `);
}

function loadExample() {
  state.importMode = "simple";
  $$("[data-import-tab]").forEach(item => item.classList.toggle("active", item.dataset.importTab === "simple"));
  $$("[data-import-pane]").forEach(pane => pane.classList.toggle("active", pane.dataset.importPane === "simple"));
  $("#simple-import").value = `Frage: Was versteht man unter Inflation?\nRichtig: Anstieg des allgemeinen Preisniveaus\nFalsch: Rückgang der Arbeitslosigkeit\nFalsch: Zunahme des realen BIP\nFalsch: Sinkende Staatsausgaben\n\nFrage: Was ist ein Substitutionsgut zu Butter?\nRichtig: Margarine\nFalsch: Brot\nFalsch: Salz\nFalsch: Milch`;
}

async function saveEditorGame() {
  syncEditorFromDOM();
  const title = $("#game-title").value.trim();
  if (!title) throw new Error("Bitte gib dem Spiel einen Titel.");
  const questions = validateQuestions(state.editorQuestions);
  if (!questions.length) throw new Error("Das Spiel braucht mindestens eine Frage.");

  const saved = await saveGame({
    id: state.editorGameId || crypto.randomUUID(),
    createdAt: state.editorCreatedAt,
    title,
    questions
  });

  state.editorGameId = saved.id;
  state.editorCreatedAt = saved.createdAt;
  toast(`Gespeichert, ${getBackend() === "supabase" ? "in Supabase" : "lokal im Browser"}.`);
  await renderLibrary();
}

function startGame(game) {
  if (!game?.questions?.length) {
    toast("Dieses Spiel enthält keine Fragen.", true);
    return;
  }

  stopAll();
  state.game = game;
  state.gameQuestions = selectQuestions(game.questions);
  state.currentIndex = 0;
  state.currentAnswers = [];
  state.selectedKey = null;
  state.locked = false;
  state.gameFinished = false;
  state.jokers = { fifty: false, audience: false, phone: false, teacher: false };
  $("#game-title-display").textContent = game.title;
  $$("[data-joker]").forEach(button => button.classList.remove("used"));
  showScreen("game");
  renderQuestion();
}

function selectQuestions(questions) {
  const copy = questions.map(question => ({ ...question, wrong: [...question.wrong] }));
  if (copy.length <= 15) return copy;
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 15);
}

function renderQuestion() {
  const question = state.gameQuestions[state.currentIndex];
  if (!question) return finishGame(true);

  state.selectedKey = null;
  state.locked = false;
  state.currentAnswers = shuffleAnswers(question);

  $("#question-text").textContent = question.question;
  $("#question-progress").textContent = `Frage ${state.currentIndex + 1} von ${state.gameQuestions.length}`;
  $("#game-status").textContent = `Aktuelle Gewinnstufe: ${money[state.currentIndex] ?? "Finale"}`;
  $("#lock-answer").disabled = true;
  $("#lock-answer").classList.remove("hidden");
  $("#next-question").classList.add("hidden");

  const container = $("#answers");
  container.replaceChildren();

  for (const answer of state.currentAnswers) {
    const element = document.createElement("div");
    element.className = "answer";
    element.dataset.key = answer.key;

    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.textContent = `${answer.key.toUpperCase()}:`;

    const text = document.createElement("span");
    text.textContent = answer.text;

    element.append(letter, text);
    element.addEventListener("click", () => selectAnswer(answer.key));
    container.append(element);
  }

  renderMoneyLadder();
  playClip("question");
}

function selectAnswer(key) {
  if (state.locked) return;
  const target = document.querySelector(`.answer[data-key="${key}"]`);
  if (!target || target.classList.contains("removed")) return;

  $$(".answer").forEach(answer => answer.classList.remove("selected"));
  target.classList.add("selected");
  state.selectedKey = key;
  $("#lock-answer").disabled = false;
  $("#game-status").textContent = `Antwort ${key.toUpperCase()} ausgewählt`;
  playClip("selected");
}

function lockAnswer() {
  if (!state.selectedKey || state.locked) return;
  state.locked = true;
  $$(".answer").forEach(answer => answer.classList.add("locked"));
  $("#lock-answer").disabled = true;
  $("#game-status").textContent = "Antwort ist eingeloggt ...";
  stopLoop();
  playClip("locked");
  window.setTimeout(revealAnswer, 900);
}

function revealAnswer() {
  const correct = state.currentAnswers.find(answer => answer.correct);
  const chosen = state.currentAnswers.find(answer => answer.key === state.selectedKey);
  const correctElement = document.querySelector(`.answer[data-key="${correct.key}"]`);
  const chosenElement = document.querySelector(`.answer[data-key="${chosen.key}"]`);

  correctElement?.classList.add("correct");

  if (!chosen.correct) {
    chosenElement?.classList.remove("selected");
    chosenElement?.classList.add("wrong");
    $("#game-status").textContent = `Leider falsch. Richtig ist ${correct.key.toUpperCase()}.`;
    playClip("wrong");
    window.setTimeout(() => finishGame(false), 1800);
    return;
  }

  chosenElement?.classList.remove("selected");
  $("#game-status").textContent = `Richtig, ${money[state.currentIndex]}!`;
  playClip("correct");
  $("#lock-answer").classList.add("hidden");

  if (state.currentIndex >= state.gameQuestions.length - 1 || state.currentIndex >= 14) {
    window.setTimeout(() => finishGame(true), 1500);
  } else {
    $("#next-question").classList.remove("hidden");
  }
}

function nextQuestion() {
  if (!state.locked || state.gameFinished) return;
  state.currentIndex += 1;
  renderQuestion();
}

function renderMoneyLadder() {
  const ladder = $("#money-ladder");
  ladder.replaceChildren();

  for (let i = 14; i >= 0; i--) {
    const step = document.createElement("div");
    step.className = "money-step";
    if ([4, 9, 14].includes(i)) step.classList.add("safe");
    if (i === state.currentIndex && !state.gameFinished) step.classList.add("active");
    if (i < state.currentIndex) step.classList.add("done");

    const number = document.createElement("span");
    number.className = "n";
    number.textContent = i + 1;
    const amount = document.createElement("span");
    amount.textContent = money[i];
    step.append(number, amount);
    ladder.append(step);
  }
}

function useJoker(type) {
  if (!state.game || state.gameFinished || state.locked || state.jokers[type]) return;
  state.jokers[type] = true;
  document.querySelector(`[data-joker="${type}"]`)?.classList.add("used");
  playClip(`joker-${type}`);

  if (type === "fifty") useFifty();
  if (type === "audience") useAudience();
  if (type === "phone") usePhone();
  if (type === "teacher") useTeacher();
}

function useFifty() {
  const wrongKeys = state.currentAnswers.filter(answer => !answer.correct).map(answer => answer.key);
  shuffleInPlace(wrongKeys);
  wrongKeys.slice(0, 2).forEach(key => document.querySelector(`.answer[data-key="${key}"]`)?.classList.add("removed"));
  $("#game-status").textContent = "50:50 Joker eingesetzt";
}

function useAudience() {
  const correct = state.currentAnswers.find(answer => answer.correct);
  const correctIndex = ["a", "b", "c", "d"].indexOf(correct.key);
  const difficulty = state.currentIndex / 14;
  const correctBoost = 52 - difficulty * 25 + Math.random() * 10;
  const raw = [8 + Math.random() * 16, 8 + Math.random() * 16, 8 + Math.random() * 16, 8 + Math.random() * 16];
  raw[correctIndex] += correctBoost;
  const total = raw.reduce((sum, value) => sum + value, 0);
  const values = raw.map(value => Math.round(value / total * 100));
  values[correctIndex] += 100 - values.reduce((sum, value) => sum + value, 0);

  const bars = values.map((value, index) => `
    <div class="audience-col">
      <div class="audience-value">${value}%</div>
      <div class="audience-bar" style="height:${Math.max(8, value * 2.15)}px"></div>
      <div class="audience-letter">${"ABCD"[index]}</div>
    </div>
  `).join("");

  showModal(`
    <h3>Publikumsjoker</h3>
    <div class="audience-chart">${bars}</div>
    <div class="modal-actions"><button class="btn primary" data-modal="close">Zurück zur Frage</button></div>
  `);
}

function usePhone() {
  const correct = state.currentAnswers.find(answer => answer.correct);
  const wrong = state.currentAnswers.filter(answer => !answer.correct);
  const reliability = Math.max(.48, .84 - state.currentIndex * .023);
  const guess = Math.random() < reliability ? correct : wrong[Math.floor(Math.random() * wrong.length)];
  const confidence = guess.correct ? Math.round(64 + Math.random() * 28) : Math.round(46 + Math.random() * 24);

  showModal(`
    <h3>Telefonjoker</h3>
    <div class="joker-message">«Ich würde auf <strong style="color:#ff9c2f">${guess.key.toUpperCase()}</strong> gehen. Ich bin ungefähr zu <strong>${confidence}%</strong> sicher.»</div>
    <div class="modal-actions"><button class="btn primary" data-modal="close">Danke!</button></div>
  `);
}

function useTeacher() {
  showModal(`
    <div class="teacher-screen">
      <div class="teacher-badge">L</div>
      <h3>Lehrerjoker</h3>
      <div class="joker-message">Das Spiel ist pausiert. Die Lehrperson darf jetzt einen mündlichen Hinweis geben.</div>
      <div class="modal-actions"><button class="btn primary" data-modal="close">Hinweis erhalten, weiterspielen</button></div>
    </div>
  `);
}

function finishGame(won) {
  if (state.gameFinished) return;
  state.gameFinished = true;
  stopAll();

  let amount = "0 €";
  if (won) {
    amount = money[Math.min(state.currentIndex, 14)];
  } else if (state.currentIndex >= 10) {
    amount = money[9];
  } else if (state.currentIndex >= 5) {
    amount = money[4];
  }

  const title = won ? "Geschafft!" : "Spiel beendet";
  const text = won
    ? `Du hast ${amount} erreicht.`
    : `Du gehst mit ${amount} nach Hause.`;

  showModal(`
    <h3>${title}</h3>
    <div class="joker-message">${text}</div>
    <div class="modal-actions">
      <button class="btn" data-modal="restart">Noch einmal</button>
      <button class="btn primary" data-modal="home">Zum Start</button>
    </div>
  `, { persistent: true });
  playClip(won ? "win" : "game-over");
}

function restartGame() {
  if (state.game) startGame(state.game);
}

function quitGame() {
  if (!confirm("Spiel wirklich beenden?")) return;
  stopAll();
  state.gameFinished = true;
  showScreen("home");
}

function showModal(html, { persistent = false } = {}) {
  const modal = $("#modal");
  const content = $("#modal-content");
  content.innerHTML = html;
  modal.classList.remove("hidden");
  modal.dataset.persistent = persistent ? "1" : "0";

  content.querySelectorAll("[data-modal]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.modal;
      if (action === "close") closeModal();
      if (action === "restart") { closeModal(true); restartGame(); }
      if (action === "home") { closeModal(true); showScreen("home"); }
    });
  });
}

function closeModal(force = false) {
  const modal = $("#modal");
  if (!force && modal.dataset.persistent === "1") return;
  modal.classList.add("hidden");
  modal.dataset.persistent = "0";
  $("#modal-content").replaceChildren();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function toast(message, error = false) {
  const existing = document.querySelector(".toast");
  existing?.remove();
  const element = document.createElement("div");
  element.className = `toast${error ? " error" : ""}`;
  element.textContent = message;
  document.body.append(element);
  window.setTimeout(() => element.remove(), 3200);
}
