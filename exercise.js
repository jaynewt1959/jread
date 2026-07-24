// exercise.js — Question generation and answer validation.
// Depends on: config.js, curriculum.js (KEY_NOTES, KEY_GROUPS, INTERVALS, STAFF_CONFIG)

// ── Note utilities ───────────────────────────────────────────────────────────────

// All chromatic pitch classes including accidentals used in the active key set.
const SEMITONE_OF = {
  'C': 0,  'C#': 1,
  'D': 2,  'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5,  'F#': 6,
  'G': 7,  'G#': 8, 'Ab': 8,
  'A': 9,  'A#': 10,'Bb': 10,
  'B': 11,
};

/**
 * Convert a note string ('C4', 'F#4', 'Bb5') → MIDI integer.
 * The octave digit is always the last character.
 */
function noteToMidi(note) {
  const letter = note.slice(0, -1);
  const octave = parseInt(note.slice(-1), 10);
  return octave * 12 + SEMITONE_OF[letter];
}

// ── Per-key valid pairs ────────────────────────────────────────────────────────────

/**
 * Build the valid interval pairs for a given key within the configured range.
 * Returns an object keyed by intervalId, each containing an array of { bottom, top }.
 */
function buildPairsForKey(key) {
  const letters = KEY_NOTES[key];
  // Map semitone → letter for this key (used to find the top note).
  const semiToLetter = {};
  letters.forEach(l => { semiToLetter[SEMITONE_OF[l]] = l; });

  // All diatonic notes in the configured octave range, sorted by MIDI value.
  const allNotes = [];
  for (let oct = STAFF_CONFIG.octaveRange[0]; oct <= STAFF_CONFIG.octaveRange[1]; oct++) {
    letters.forEach(letter => {
      allNotes.push({ str: letter + oct, letter, midi: oct * 12 + SEMITONE_OF[letter] });
    });
  }
  allNotes.sort((a, b) => a.midi - b.midi);

  const maxMidi = noteToMidi(STAFF_CONFIG.topNote);
  const pairs   = {};

  INTERVALS.forEach(iv => {
    pairs[iv.id] = [];
    allNotes.forEach(bottom => {
      const topMidi    = bottom.midi + iv.semitones;
      if (topMidi > maxMidi) return;
      const topSemi    = topMidi % 12;
      const topOct     = Math.floor(topMidi / 12);
      const topLetter  = semiToLetter[topSemi];
      if (!topLetter) return; // not diatonic in this key
      pairs[iv.id].push({ bottom: bottom.str, top: topLetter + topOct });
    });
  });

  return pairs;
}

// Pre-compute at load time for every defined key.
const VALID_PAIRS_BY_KEY = {};
Object.keys(KEY_NOTES).forEach(key => {
  VALID_PAIRS_BY_KEY[key] = buildPairsForKey(key);
});

// ── Question generation ────────────────────────────────────────────────────

/**
 * Pick a random question from the active intervals across the active key pool.
 * Avoids repeating the identical (bottom, top, key) triple as the last question.
 */
function generateQuestion(activeIntervalIds, activeKeys, lastQuestion) {
  // Intervals that have at least one pair in at least one active key.
  const eligible = activeIntervalIds.filter(id =>
    activeKeys.some(k => VALID_PAIRS_BY_KEY[k][id] && VALID_PAIRS_BY_KEY[k][id].length > 0)
  );
  if (eligible.length === 0) return null;

  let intervalId, pair, key;
  let attempts = 0;

  do {
    intervalId = eligible[Math.floor(Math.random() * eligible.length)];
    // Keys that have pairs for this interval.
    const availableKeys = activeKeys.filter(
      k => VALID_PAIRS_BY_KEY[k][intervalId] && VALID_PAIRS_BY_KEY[k][intervalId].length > 0
    );
    key  = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    const pairs = VALID_PAIRS_BY_KEY[key][intervalId];
    pair = pairs[Math.floor(Math.random() * pairs.length)];
    attempts++;
  } while (
    attempts < 20 &&
    lastQuestion &&
    pair.bottom === lastQuestion.bottom &&
    pair.top    === lastQuestion.top &&
    key         === lastQuestion.key
  );

  return {
    intervalId,
    intervalName: getInterval(intervalId).name,
    bottom:       pair.bottom,            // e.g. 'F#4'
    top:          pair.top,               // e.g. 'G4'
    bottomLetter: pair.bottom.slice(0,-1),// e.g. 'F#'
    topLetter:    pair.top.slice(0,-1),   // e.g. 'G'
    key,
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
function buildStaffScore(bottom, top, intervalId) {
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
