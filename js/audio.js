const clips = new Map();
let currentLoop = null;
let enabled = true;

export function setAudioEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopAll();
}

export function registerClip(name, src, options = {}) {
  if (!name || !src) return;
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.loop = Boolean(options.loop);
  audio.volume = typeof options.volume === "number" ? options.volume : 1;
  clips.set(name, audio);
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
}

export function stopLoop() {
  if (!currentLoop) return;
  currentLoop.pause();
  currentLoop.currentTime = 0;
  currentLoop = null;
}

export function stopAll() {
  for (const audio of clips.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
  currentLoop = null;
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
    }
  }

  requestAnimationFrame(tick);
}

// Die echten MP3 Dateien werden später hier registriert, zum Beispiel:
// registerClip("question", "assets/audio/question.mp3", { loop: true, volume: 0.55 });
// registerClip("locked", "assets/audio/locked.mp3");
// registerClip("correct", "assets/audio/correct.mp3");
// registerClip("wrong", "assets/audio/wrong.mp3");
