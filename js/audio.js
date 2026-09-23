const clips = new Map();
let currentLoop = null;
let pausedLoop = null;
let foreground = null;
let enabled = true;
let unlocked = false;
let foregroundToken = 0;
let foregroundDone = null;

const ASSET_VERSION = "2026-09-23-v8";

const AUDIO = {
  intro: ["assets/audio/intro.mp3", { volume: .82 }],
  "q-low": ["assets/audio/question-low.mp3", { loop: true, volume: .46 }],
  "q-mid": ["assets/audio/question-mid.mp3", { loop: true, volume: .46 }],
  "q-32000": ["assets/audio/question-32000.mp3", { loop: true, volume: .46 }],
  "q-64000": ["assets/audio/question-64000.mp3", { loop: true, volume: .46 }],
  "q-125000": ["assets/audio/question-125000.mp3", { loop: true, volume: .46 }],
  "q-500000": ["assets/audio/question-500000.mp3", { loop: true, volume: .46 }],
  "q-million": ["assets/audio/question-million.mp3", { loop: true, volume: .48 }],
  "lock-high": ["assets/audio/final-answer-high.mp3", { volume: .78 }],
  "lock-million": ["assets/audio/final-answer-million.mp3", { volume: .80 }],
  "correct-low": ["assets/audio/correct-low.mp3", { volume: .88 }],
  "correct-high": ["assets/audio/correct-high.mp3", { volume: .90 }],
  "correct-million": ["assets/audio/correct-million.mp3", { volume: .92 }],
  wrong: ["assets/audio/wrong.mp3", { volume: .88 }],
  "wrong-million": ["assets/audio/wrong-million.mp3", { volume: .92 }],
  safe1: ["assets/audio/safe-1.mp3", { volume: .88 }],
  safe2: ["assets/audio/safe-2.mp3", { volume: .88 }],
  "joker-fifty": ["assets/audio/joker-5050.mp3", { volume: .84 }],
  "joker-audience": ["assets/audio/joker-audience.mp3", { volume: .80 }],
  "joker-phone": ["assets/audio/joker-phone.mp3", { volume: .80 }],
  "lifeline-ping": ["assets/audio/lifeline-ping.mp3", { volume: .90 }],
  "joker-teacher": ["assets/audio/lifeline-ping.mp3", { volume: .86 }],
  outro: ["assets/audio/outro.mp3", { volume: .80 }]
};

for (const [name, [src, options]] of Object.entries(AUDIO)) registerClip(name, src, options);

const primeFromUserGesture = () => {
  if (unlocked) return;
  unlockAudio().then(ok => { if (ok) unlocked = true; });
};
document.addEventListener("pointerdown", primeFromUserGesture, { capture: true, once: true });
document.addEventListener("keydown", primeFromUserGesture, { capture: true, once: true });

export function setAudioEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopAll();
  return enabled;
}

export function isAudioEnabled() { return enabled; }

function versionedSrc(src) {
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${encodeURIComponent(ASSET_VERSION)}`;
}

export function registerClip(name, src, options = {}) {
  if (!name || !src) return;
  const audio = new Audio();
  audio.preload = "metadata";
  audio.loop = Boolean(options.loop);
  audio.volume = typeof options.volume === "number" ? options.volume : 1;
  audio.src = versionedSrc(src);
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

export async function unlockAudio() {
  if (!enabled) return true;
  const audio = clips.get("intro");
  if (!audio) return false;
  const oldVolume = audio.volume;
  try {
    audio.volume = 0.001;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = oldVolume;
    return true;
  } catch (error) {
    audio.volume = oldVolume;
    console.warn("Audio konnte vom Browser noch nicht freigeschaltet werden.", error);
    return false;
  }
}

function stopAudioElement(audio) {
  if (!audio) return;
  audio.pause();
  try { audio.currentTime = 0; } catch {}
}

function settleForeground(reason = "stopped") {
  if (!foregroundDone) return;
  const done = foregroundDone;
  foregroundDone = null;
  done(reason);
}

export async function startLoop(name, { restart = true } = {}) {
  if (!enabled) return false;
  if (foreground && !foreground.paused) return false;
  const audio = clips.get(name);
  if (!audio) return false;

  if (currentLoop && currentLoop !== audio) stopAudioElement(currentLoop);
  if (pausedLoop && pausedLoop !== audio) stopAudioElement(pausedLoop);
  pausedLoop = null;
  currentLoop = audio;
  if (restart) audio.currentTime = 0;

  try {
    await audio.play();
    unlocked = true;
    return true;
  } catch (error) {
    console.warn(`Fragemusik ${name} konnte nicht gestartet werden.`, error);
    if (currentLoop === audio) currentLoop = null;
    return false;
  }
}

export function playCue(name, { restart = true, replace = true } = {}) {
  if (!enabled) return Promise.resolve({ ended: false, reason: "disabled" });
  const audio = clips.get(name);
  if (!audio) return Promise.resolve({ ended: false, reason: "missing" });

  if (replace) stopForeground();
  const token = ++foregroundToken;
  foreground = audio;
  if (restart) audio.currentTime = 0;

  return new Promise(resolve => {
    let settled = false;
    const done = reason => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (foreground === audio && token === foregroundToken) foreground = null;
      if (foregroundDone === cancel) foregroundDone = null;
      resolve({ ended: reason === "ended", reason });
    };
    const cancel = reason => done(reason || "stopped");
    const onEnded = () => done("ended");
    const onError = () => done("error");

    foregroundDone = cancel;
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.play().then(() => { unlocked = true; }).catch(error => {
      console.warn(`Audio ${name} konnte nicht gestartet werden.`, error);
      done("blocked");
    });
  });
}

export function playCueSegment(name, startAt, endAt, { replace = true } = {}) {
  if (!enabled) return Promise.resolve({ ended: false, reason: "disabled" });
  const audio = clips.get(name);
  if (!audio) return Promise.resolve({ ended: false, reason: "missing" });

  const start = Math.max(0, Number(startAt) || 0);
  const end = Math.max(start, Number(endAt) || start);
  if (replace) stopForeground();

  const token = ++foregroundToken;
  foreground = audio;

  return new Promise(resolve => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };

    const done = reason => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reason === "segment-end") audio.pause();
      if (foreground === audio && token === foregroundToken) foreground = null;
      if (foregroundDone === cancel) foregroundDone = null;
      resolve({ ended: reason === "segment-end" || reason === "ended", reason });
    };

    const cancel = reason => done(reason || "stopped");
    const onEnded = () => done("ended");
    const onError = () => done("error");

    foregroundDone = cancel;
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });

    const startPlayback = async () => {
      try {
        if (audio.readyState < 1) {
          await new Promise((resolveMetadata, rejectMetadata) => {
            const ready = () => { cleanupMetadata(); resolveMetadata(); };
            const failed = () => { cleanupMetadata(); rejectMetadata(new Error("metadata")); };
            const cleanupMetadata = () => {
              audio.removeEventListener("loadedmetadata", ready);
              audio.removeEventListener("error", failed);
            };
            audio.addEventListener("loadedmetadata", ready, { once: true });
            audio.addEventListener("error", failed, { once: true });
            audio.load();
          });
        }

        audio.currentTime = start;
        await audio.play();
        unlocked = true;

        const durationMs = Math.max(0, (end - start) * 1000);
        timer = window.setTimeout(() => {
          if (token !== foregroundToken) return done("stopped");
          try { audio.currentTime = end; } catch {}
          done("segment-end");
        }, durationMs);
      } catch (error) {
        console.warn(`Audioabschnitt ${name} konnte nicht gestartet werden.`, error);
        done("blocked");
      }
    };

    startPlayback();
  });
}

export function playClip(name, options = {}) { return playCue(name, options); }

export function stopForeground() {
  foregroundToken += 1;
  if (foreground) stopAudioElement(foreground);
  foreground = null;
  settleForeground("stopped");
}

export function stopClip(name) {
  const audio = clips.get(name);
  if (!audio) return;
  stopAudioElement(audio);
  if (audio === currentLoop) currentLoop = null;
  if (audio === pausedLoop) pausedLoop = null;
  if (audio === foreground) stopForeground();
}

export function pauseLoop() {
  if (!currentLoop || currentLoop.paused) return false;
  pausedLoop = currentLoop;
  currentLoop.pause();
  return true;
}

export async function resumeLoop() {
  if (!enabled || !pausedLoop || (foreground && !foreground.paused)) return false;
  const audio = pausedLoop;
  pausedLoop = null;
  currentLoop = audio;
  try {
    await audio.play();
    return true;
  } catch (error) {
    console.warn("Fragemusik konnte nicht fortgesetzt werden.", error);
    return false;
  }
}

export function stopLoop() {
  const loop = currentLoop || pausedLoop;
  if (loop) stopAudioElement(loop);
  currentLoop = null;
  pausedLoop = null;
}

export function stopAll() {
  foregroundToken += 1;
  for (const audio of clips.values()) stopAudioElement(audio);
  currentLoop = null;
  pausedLoop = null;
  foreground = null;
  settleForeground("stopped");
}

export function isForegroundPlaying() {
  return Boolean(foreground && !foreground.paused);
}

export function clipDuration(name) {
  const audio = clips.get(name);
  return Number.isFinite(audio?.duration) ? audio.duration : null;
}
