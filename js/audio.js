const clips = new Map();
let currentLoop = null;
let pausedLoop = null;
let enabled = true;

const AUDIO = {
  intro: ["assets/audio/intro.mp3", { volume: .78 }],
  "q-low": ["assets/audio/question-low.mp3", { loop: true, volume: .42 }],
  "q-mid": ["assets/audio/question-mid.mp3", { loop: true, volume: .42 }],
  "q-32000": ["assets/audio/question-32000.mp3", { loop: true, volume: .43 }],
  "q-64000": ["assets/audio/question-64000.mp3", { loop: true, volume: .43 }],
  "q-125000": ["assets/audio/question-125000.mp3", { loop: true, volume: .43 }],
  "q-500000": ["assets/audio/question-500000.mp3", { loop: true, volume: .43 }],
  "q-million": ["assets/audio/question-million.mp3", { loop: true, volume: .45 }],
  "lock-high": ["assets/audio/final-answer-high.mp3", { volume: .72 }],
  "lock-million": ["assets/audio/final-answer-million.mp3", { volume: .76 }],
  "correct-low": ["assets/audio/correct-low.mp3", { volume: .8 }],
  "correct-high": ["assets/audio/correct-high.mp3", { volume: .82 }],
  "correct-million": ["assets/audio/correct-million.mp3", { volume: .86 }],
  wrong: ["assets/audio/wrong.mp3", { volume: .82 }],
  "wrong-million": ["assets/audio/wrong-million.mp3", { volume: .86 }],
  safe1: ["assets/audio/safe-1.mp3", { volume: .8 }],
  safe2: ["assets/audio/safe-2.mp3", { volume: .8 }],
  "joker-fifty": ["assets/audio/joker-5050.mp3", { volume: .78 }],
  "joker-audience": ["assets/audio/joker-audience.mp3", { volume: .72 }],
  "joker-phone": ["assets/audio/joker-phone.mp3", { volume: .7 }],
  "joker-teacher": ["assets/audio/lifeline-ping.mp3", { volume: .82 }],
  outro: ["assets/audio/outro.mp3", { volume: .74 }]
};

for (const [name, [src, options]] of Object.entries(AUDIO)) registerClip(name, src, options);

export function setAudioEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopAll();
  return enabled;
}

export function isAudioEnabled() { return enabled; }

export function registerClip(name, src, options = {}) {
  if (!name || !src) return;
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.loop = Boolean(options.loop);
  audio.volume = typeof options.volume === "number" ? options.volume : 1;
  clips.set(name, audio);
}

export function questionTrack(index) {
  if (index <= 4) return "q-low";
  if (index <= 9) return "q-mid";
  if (index === 10) return "q-32000";
  if (index === 11) return "q-64000";
  if (index === 12) return "q-125000";
  if (index === 13) return "q-500000";
  return "q-million";
}

export async function playClip(name, { restart = true } = {}) {
  if (!enabled) return;
  const audio = clips.get(name);
  if (!audio) return;
  if (restart) audio.currentTime = 0;
  try {
    await audio.play();
    if (audio.loop) currentLoop = audio;
  } catch (error) {
    console.debug(`Audio ${name} konnte nicht gestartet werden.`, error);
  }
}

export function stopClip(name) {
  const audio = clips.get(name);
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  if (audio === currentLoop) currentLoop = null;
  if (audio === pausedLoop) pausedLoop = null;
}

export function pauseLoop() {
  if (!currentLoop || currentLoop.paused) return;
  pausedLoop = currentLoop;
  currentLoop.pause();
}

export async function resumeLoop() {
  if (!enabled || !pausedLoop) return;
  const audio = pausedLoop;
  pausedLoop = null;
  currentLoop = audio;
  try { await audio.play(); } catch (error) { console.debug("Fragemusik konnte nicht fortgesetzt werden.", error); }
}

export function stopLoop() {
  const audio = currentLoop || pausedLoop;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  currentLoop = null;
  pausedLoop = null;
}

export function stopAll() {
  for (const audio of clips.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
  currentLoop = null;
  pausedLoop = null;
}

export function fadeOut(name, duration = 500) {
  const audio = clips.get(name);
  if (!audio || audio.paused) return;
  const startVolume = audio.volume;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    audio.volume = startVolume * (1 - progress);
    if (progress < 1) requestAnimationFrame(tick);
    else {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = startVolume;
      if (audio === currentLoop) currentLoop = null;
    }
  }
  requestAnimationFrame(tick);
}
