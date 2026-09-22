import { initStorage } from './storage.js';
import { S,$,$$,demo,screen,toast } from './state-v2.js';
import { library,openEditor,addQuestion,doImport,previewImport,loadExample,saveEditor } from './editor-v2.js';
import { startGame,beginQuestions,cancelIntro,lockAnswer,nextQuestion,useJoker,quit,closeModal,toggleAudio } from './game-v2.js';
import { stopAll } from './audio.js';

await initStorage();
bind();screen('home');

function bind(){
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;try{const a=b.dataset.action;if(a==='home')home();if(a==='library')await library(startGame);if(a==='new-game')openEditor();if(a==='quick-demo')startGame({id:'demo',title:'Demo: Volkswirtschaft',questions:demo});if(a==='begin-questions')beginQuestions();if(a==='cancel-game-intro')cancelIntro();if(a==='load-example')loadExample();if(a==='import-questions')doImport();if(a==='preview-import')previewImport();if(a==='save-game')await saveEditor(startGame);if(a==='add-question')addQuestion();if(a==='fullscreen')toggleFullscreen();if(a==='quit-game')quit();if(a==='toggle-audio')toggleAudio();}catch(err){console.error(err);toast(err.message||'Etwas ist schiefgelaufen.',true);}});
 $$('[data-import-tab]').forEach(t=>t.onclick=()=>{S.importMode=t.dataset.importTab;$$('[data-import-tab]').forEach(x=>x.classList.toggle('active',x===t));$$('[data-import-pane]').forEach(x=>x.classList.toggle('active',x.dataset.importPane===S.importMode));});
 $('#lock-answer').onclick=lockAnswer;$('#next-question').onclick=nextQuestion;$$('[data-joker]').forEach(b=>b.onclick=()=>useJoker(b.dataset.joker));$('#modal').onclick=e=>{if(e.target===$('#modal')&&$('#modal').dataset.persistent!=='1')closeModal();};
 document.addEventListener('keydown',e=>{if(!$('#screen-game').classList.contains('active')||!$('#modal').classList.contains('hidden'))return;if(['1','2','3','4'].includes(e.key)&&!S.locked){const k=['a','b','c','d'][+e.key-1];document.querySelector(`.answer[data-key="${k}"]`)?.click();}if(e.key==='Enter'){if(!S.locked&&S.sel)lockAnswer();else if(S.locked&&!$('#next-question').classList.contains('hidden'))nextQuestion();}const k=e.key.toLowerCase();if(k==='f')useJoker('fifty');if(k==='p')useJoker('audience');if(k==='t')useJoker('phone');if(k==='l')useJoker('teacher');});
}
function home(){++S.seq;stopAll();S.finished=true;S.jokerBusy=false;screen('home');}
function toggleFullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();}
