import { initStorage } from './storage.js';
import { S,$,$$,demo,screen,toast } from './state-v2.js';
import { library,openEditor,addQuestion,doImport,previewImport,loadExample,saveEditor } from './editor-v2.js';
import { startGame,beginQuestions,cancelIntro,lockAnswer,nextQuestion,useJoker,quit,closeModal,toggleAudio } from './game-v2.js';
import { stopAll } from './audio.js';
import { initCloudUI } from './cloud-ui.js';

await initStorage();
bind();
initCloudUI();
screen('home');

function bind() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    try {
      const action = button.dataset.action;
      if (action === 'home') home();
      if (action === 'library') await library(startGame);
      if (action === 'new-game') openEditor();
      if (action === 'quick-demo') startGame({ id:'demo', title:'Demo: Volkswirtschaft', questions:demo });
      if (action === 'begin-questions') beginQuestions();
      if (action === 'cancel-game-intro') cancelIntro();
      if (action === 'load-example') loadExample();
      if (action === 'import-questions') doImport();
      if (action === 'preview-import') previewImport();
      if (action === 'save-game') await saveEditor(startGame);
      if (action === 'add-question') addQuestion();
      if (action === 'fullscreen') toggleFullscreen();
      if (action === 'quit-game') quit();
      if (action === 'toggle-audio') toggleAudio();
    } catch (error) {
      console.error(error);
      toast(error.message || 'Etwas ist schiefgelaufen.', true);
    }
  });

  $$('[data-import-tab]').forEach(tab => {
    tab.onclick = () => {
      S.importMode = tab.dataset.importTab;
      $$('[data-import-tab]').forEach(item => item.classList.toggle('active', item === tab));
      $$('[data-import-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.importPane === S.importMode));
    };
  });

  $('#lock-answer').onclick = lockAnswer;
  $('#next-question').onclick = nextQuestion;
  $$('[data-joker]').forEach(button => button.onclick = () => useJoker(button.dataset.joker));
  $('#modal').onclick = event => {
    if (event.target === $('#modal') && $('#modal').dataset.persistent !== '1') closeModal();
  };

  document.addEventListener('keydown', event => {
    if ($('#screen-game-intro').classList.contains('active')) {
      if (event.key === 'Enter' && S.introReady) beginQuestions();
      if (event.key === 'Escape') cancelIntro();
      return;
    }

    if (!$('#screen-game').classList.contains('active') || !$('#modal').classList.contains('hidden')) return;

    if (['1','2','3','4'].includes(event.key) && !S.locked && !S.jokerBusy) {
      const key = ['a','b','c','d'][Number(event.key) - 1];
      document.querySelector(`.answer[data-key="${key}"]`)?.click();
    }

    if (event.key === 'Enter') {
      if (!S.locked && S.sel) lockAnswer();
      else if (S.locked && !$('#next-question').classList.contains('hidden')) nextQuestion();
    }

    const key = event.key.toLowerCase();
    if (key === 'f') useJoker('fifty');
    if (key === 'p') useJoker('audience');
    if (key === 't') useJoker('phone');
    if (key === 'l') useJoker('teacher');
  });
}

function home() {
  ++S.seq;
  stopAll();
  S.finished = true;
  S.jokerBusy = false;
  screen('home');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
