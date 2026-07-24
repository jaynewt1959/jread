// audio.js — Web Audio API sound effects (no external dependencies)

let _ctx = null;

function getAudioCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Browsers can suspend audio until a user gesture — resume if needed.
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/**
 * Subtle click for answer-button presses.
 * Short sine pop at ~900 Hz, 50 ms.
 */
function playClick() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch (_) { /* audio unavailable */ }
}

/**
 * Bright ascending major arpeggio (C5 → E5 → G5) for a correct answer.
 * Triangle waves with bell-like envelope.
 */
function playCorrect() {
  try {
    const ctx   = getAudioCtx();
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.10;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch (_) { /* audio unavailable */ }
}

// ── Interval pitch playback ──────────────────────────────────────────────────────────────

/** Note string ('C4', 'E5', …) → MIDI number. */
function _noteToMidi(noteStr) {
  const semi = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  return parseInt(noteStr.slice(1), 10) * 12 + semi[noteStr[0]];
}

/** MIDI number → frequency in Hz. */
function _midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Schedule a single triangle-wave note inside an existing AudioContext. */
function _playNote(ctx, freq, t, decay) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

/**
 * Play an interval: bottom note → top note (melodic), then both together (harmonic).
 * bottom / top are note strings like 'C4', 'E5'.
 */
function playInterval(bottom, top) {
  try {
    const ctx  = getAudioCtx();
    const fBot = _midiToFreq(_noteToMidi(bottom));
    const fTop = _midiToFreq(_noteToMidi(top));
    const now  = ctx.currentTime;
    _playNote(ctx, fBot, now + 0.00, 0.50);   // bottom alone
    _playNote(ctx, fTop, now + 0.55, 0.50);   // top alone
    _playNote(ctx, fBot, now + 1.15, 0.70);   // both together
    _playNote(ctx, fTop, now + 1.15, 0.70);
  } catch (_) { /* audio unavailable */ }
}

/**
 * Dull descending buzz for an incorrect answer.
 * Sawtooth wave dropping from 180 → 90 Hz, 330 ms.
 */
function playIncorrect() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.30);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.33);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.36);
  } catch (_) { /* audio unavailable */ }
}
