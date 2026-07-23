// curriculum.js — Interval definitions and stage-based progression.
// Loaded first; all other modules depend on globals defined here.

const INTERVALS = [
  { id: 'P1', name: 'Unison',       semitones:  0 },
  { id: 'm2', name: 'Minor 2nd',    semitones:  1 },
  { id: 'M2', name: 'Major 2nd',    semitones:  2 },
  { id: 'm3', name: 'Minor 3rd',    semitones:  3 },
  { id: 'M3', name: 'Major 3rd',    semitones:  4 },
  { id: 'P4', name: 'Perfect 4th',  semitones:  5 },
  { id: 'TT', name: 'Tritone',      semitones:  6 },
  { id: 'P5', name: 'Perfect 5th',  semitones:  7 },
  { id: 'm6', name: 'Minor 6th',    semitones:  8 },
  { id: 'M6', name: 'Major 6th',    semitones:  9 },
  { id: 'm7', name: 'Minor 7th',    semitones: 10 },
  { id: 'M7', name: 'Major 7th',    semitones: 11 },
  { id: 'P8', name: 'Octave',       semitones: 12 },
];

// A streak of MASTERY_STREAK consecutive correct answers masters an interval.
const MASTERY_STREAK = 5;

// Stages unlock progressively.  Every interval in a stage must be mastered
// (streak >= MASTERY_STREAK) before the next stage unlocks.
const STAGES = [
  { stage: 1, intervals: ['P1', 'M2', 'P5', 'P8'] },   // most distinctive
  { stage: 2, intervals: ['M3', 'P4'] },
  { stage: 3, intervals: ['m2', 'm3'] },
  { stage: 4, intervals: ['M6', 'm6'] },
  { stage: 5, intervals: ['M7', 'm7', 'TT'] },
];

/** Return the INTERVALS entry for a given id. */
function getInterval(id) {
  return INTERVALS.find(iv => iv.id === id);
}

/**
 * Return all interval ids that are unlocked at (or before) stageIndex.
 * stageIndex is 0-based.
 */
function getActiveIntervalIds(stageIndex) {
  const active = [];
  const max = Math.min(stageIndex, STAGES.length - 1);
  for (let i = 0; i <= max; i++) {
    active.push(...STAGES[i].intervals);
  }
  return active;
}
