// config.js — Centralised staff configuration.
// Loaded first (before curriculum.js and exercise.js).
// To add bass clef or a different key later, only this file needs to change.

const STAFF_CONFIG = {
  clef:        'treble',  // future: 'bass'
  octaveRange: [4, 5],    // [minOctave, maxOctave] used by buildPairsForKey
  topNote:     'B5',      // ceiling note (must match octaveRange max)
  // keySignature is now dynamic per question (driven by KEY_NOTES / KEY_GROUPS)
};
