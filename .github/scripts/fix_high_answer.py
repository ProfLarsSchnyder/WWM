from pathlib import Path

path = Path('js/app-v3.js')
text = path.read_text(encoding='utf-8')

old = """  // Higher levels get their suspense cue, but the visual reveal is controlled
  // by a fixed show timing instead of waiting for the whole audio file.
  if (state.play.index >= 10) {
    stopLoop();
    playCue(state.play.index === 14 ? 'lock-million' : 'lock-high');
  }

  await sleep(revealDelay);

  if (seq !== state.playSeq || state.play.finished) return;
  const result = serverPromise ? await serverPromise : null;
  await revealAnswer(result);
"""

new = """  // From 32'000 upwards the suspense sound is strictly bounded to the
  // configured reveal delay. Audio must never decide when the answer appears.
  if (state.play.index >= 10) {
    stopLoop();
    const suspenseCue = state.play.index === 14 ? 'lock-million' : 'lock-high';
    const suspenseSeconds = revealDelay / 1000;
    void playCueSegment(suspenseCue, 0, suspenseSeconds);
  }

  await sleep(revealDelay);

  if (seq !== state.playSeq || state.play.finished) return;

  if (state.play.mode === 'beamer') {
    await revealAnswer(null);
    return;
  }

  try {
    const result = await Promise.race([
      serverPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Antwortübermittlung dauert zu lange. Bitte nochmals versuchen.')), 8000))
    ]);
    if (seq !== state.playSeq || state.play.finished) return;
    await revealAnswer(result);
  } catch (error) {
    stopForeground();
    state.play.locked = false;
    $$('.answer').forEach(answer => answer.classList.remove('locked'));
    $('#lock-answer').disabled = false;
    $('#game-status').textContent = 'Antwort konnte nicht ausgewertet werden. Bitte nochmals versuchen.';
    handleError(error, { student: true });
  }
"""

if old not in text:
    raise SystemExit('Expected lockAnswer block not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
