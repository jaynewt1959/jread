// config.js — Centralised staff configuration.
// Loaded first (before curriculum.js and exercise.js).
// To add bass clef or a different key later, only this file needs to change.

const STAFF_CONFIG = {
  clef:         'treble',  // future: 'bass'
  keySignature: 'C',       // future: 'G', 'F', 'Bb', etc.
  octaveRange:  [4, 5],    // [minOctave, maxOctave] used by VALID_PAIRS
  topNote:      'B5',      // ceiling note for VALID_PAIRS (must match octaveRange max)
};
