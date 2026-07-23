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
