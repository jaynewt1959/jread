// exercise.js — Question generation and answer validation.
// Depends on: INTERVALS (curriculum.js)

// ── Note utilities ────────────────────────────────────────────────────────────

const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const SEMITONE_OF = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Semitone values that correspond to natural (white-key) notes. */
const NATURAL_SEMITONES = new Set([0, 2, 4, 5, 7, 9, 11]);

const SEMITONE_TO_LETTER = { 0:'C', 2:'D', 4:'E', 5:'F', 7:'G', 9:'A', 11:'B' };

/** Convert 'C4', 'D5', etc. → MIDI integer (C4 = 48). */
function noteToMidi(note) {
  const letter = note[0];
  const octave  = parseInt(note.slice(1), 10);
  return octave * 12 + SEMITONE_OF[letter];
}

/** Convert MIDI integer → note string, or null if not a natural note. */
function midiToNote(midi) {
  const octave   = Math.floor(midi / 12);
  const semitone = midi % 12;
  const letter   = SEMITONE_TO_LETTER[semitone];
  return letter ? (letter + octave) : null;
}

// ── Valid note pairs per interval ─────────────────────────────────────────────
//
// Pre-computed at load time.  Only uses natural notes (no accidentals) in the
// range C4–B5 so every question is readable without ledger lines beyond one
// below the treble staff (middle C, C4).

const VALID_PAIRS = (() => {
  // All natural notes in the two-octave range we display (C4 to B5).
  const allNaturals = [];
  for (let oct = 4; oct <= 5; oct++) {
    NOTE_LETTERS.forEach(l => allNaturals.push(l + oct));
  }

  const maxMidi = noteToMidi('B5');
  const pairs   = {};

  INTERVALS.forEach(iv => {
    pairs[iv.id] = [];
    allNaturals.forEach(bottom => {
      const bMidi = noteToMidi(bottom);
      const tMidi = bMidi + iv.semitones;
      if (NATURAL_SEMITONES.has(tMidi % 12) && tMidi <= maxMidi) {
        const top = midiToNote(tMidi);
        if (top) pairs[iv.id].push({ bottom, top });
      }
    });
  });

  return pairs;
})();

// ── Question generation ───────────────────────────────────────────────────────

/**
 * Pick a random question from the currently-active intervals.
 * Optionally pass `lastQuestion` to avoid repeating the identical note pair.
 *
 * @param {string[]} activeIntervalIds
 * @param {{ bottom, top }|null} lastQuestion
 * @returns {{ intervalId, intervalName, bottom, top, bottomLetter, topLetter }}
 */
function generateQuestion(activeIntervalIds, lastQuestion) {
  const eligible = activeIntervalIds.filter(
    id => VALID_PAIRS[id] && VALID_PAIRS[id].length > 0
  );
  if (eligible.length === 0) return null;

  let intervalId, pair;
  let attempts = 0;

  do {
    intervalId = eligible[Math.floor(Math.random() * eligible.length)];
    const pairs = VALID_PAIRS[intervalId];
    pair = pairs[Math.floor(Math.random() * pairs.length)];
    attempts++;
  } while (
    attempts < 10 &&
    lastQuestion &&
    pair.bottom === lastQuestion.bottom &&
    pair.top    === lastQuestion.top
  );

  return {
    intervalId,
    intervalName:  getInterval(intervalId).name,
    bottom:        pair.bottom,        // e.g. 'C4'
    top:           pair.top,           // e.g. 'E4'
    bottomLetter:  pair.bottom[0],     // e.g. 'C'
    topLetter:     pair.top[0],        // e.g. 'E'
  };
}

// ── VexFlow score string ──────────────────────────────────────────────────────

/**
 * Build the EasyScore string for the treble staff.
 *   - Harmonic interval: a chord half-note followed by a half rest.
 *   - Unison: a single half-note followed by a half rest.
 *
 * Together these fill 4 beats of a 4/4 measure.
 */
function buildTrebleScore(bottom, top, intervalId) {
  const halfRest = ', B4/h/r';
  if (intervalId === 'P1') {
    return bottom + '/h' + halfRest;
  }
  return '(' + bottom + ' ' + top + ')/h' + halfRest;
}

// ── Answer validation ─────────────────────────────────────────────────────────

/**
 * Return true if all three selected answers match the question exactly.
 */
function checkAnswer(question, selectedIntervalId, selectedBottom, selectedTop) {
  return (
    selectedIntervalId === question.intervalId  &&
    selectedBottom     === question.bottomLetter &&
    selectedTop        === question.topLetter
  );
}
