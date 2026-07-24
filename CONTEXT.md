# jread — Project Context

## What it is
A sight-reading interval recognition trainer. The user sees two notes on a treble-clef grand staff and works through a **4-step mental algorithm** to identify the interval.

Deployed on Vercel (static site). GitHub: jaynewt1959/jread.

---

## The Algorithm (core UX concept)
Steps reinforce a specific cognitive strategy for minimising working-memory load:

1. **Read the shape → get the interval number** (key-independent: count staff positions)
2. **Identify the bottom note** (key-dependent: key signature tells you the note name)
3. **Identify the top note** (key-dependent)
4. **Major or Minor?** (only for 2nd, 3rd, 6th, 7th — apply major-scale check)
   - 4th, 5th, Unison, Octave, Tritone → stop, it's perfect/tritone

Steps 1–3 use the visual shape. Step 4 requires knowing the key signature.
This maps cleanly to the observation that **music reading requires more cognitive layers than text reading** — the key signature is a global modifier that changes the meaning of every staff position simultaneously.

---

## Interval curriculum
5 stages of progressively harder intervals:
- Stage 1: P1, M2, P5, P8 (most distinctive)
- Stage 2: M3, P4
- Stage 3: m2, m3
- Stage 4: M6, m6
- Stage 5: M7, m7, TT

Mastery = 5-streak correct. Stage unlocks when all current-stage intervals are mastered.

---

## Key signature curriculum
7 keys introduced progressively (defined in `curriculum.js: KEY_GROUPS`):
- Stage 1–2: C major only
- Stage 3: + G major (F♯), F major (B♭)
- Stage 4: + D major (F♯,C♯), B♭ major (B♭,E♭)
- Stage 5: + A major (F♯,C♯,G♯), E♭ major (B♭,E♭,A♭)

Key is chosen randomly per question from the active pool. Communicated via the staff key signature only — no separate badge (consistent with real sight-reading).

---

## Question flow
**Step mode** (default): sequential 4-step UI matching the algorithm.
- Each step checks immediately on click (no Check button).
- Wrong → red flash, unlimited retry, `questionWrong = true` (marks whole question wrong for scoring).
- Correct → step confirms green, next step activates.
- Correct toast only on a perfect (no-mistake) run.

**Flash-card mode** (for mastered intervals): bypasses steps, shows 6 buttons with full interval names (1 correct + 5 smart distractors). Activates when:
- The specific interval has streak ≥ MASTERY_STREAK, AND
- ≥ 6 active intervals exist (delayed until Stage 2 opens to avoid unknown distractors).

Distractor selection priority:
1. Quality sibling (Minor 2nd always appears when Major 2nd is correct, etc.)
2. Semitone proximity (maximally confusable)
3. Active intervals preferred over unseen ones

Auto-advance 2 s after correct completion. `Enter`/`Space` skips the timer.

---

## Audio
`playInterval(bottom, top)` in `audio.js`: melodic (bottom → top) then harmonic, synthesised triangle waves at correct MIDI frequencies. Auto-plays on every new question. Replay button (🔊) in staff card top-right.

---

## File map

| File | Role |
|---|---|
| `config.js` | `STAFF_CONFIG` — clef, octaveRange, topNote. Load first. **Change here for bass clef.** |
| `curriculum.js` | `INTERVALS`, `STAGES`, `KEY_GROUPS`, `KEY_NOTES`, `getActiveIntervalIds()`, `getActiveKeys()` |
| `exercise.js` | `buildPairsForKey()`, `VALID_PAIRS_BY_KEY` (pre-computed), `generateQuestion()`, `buildStaffScore()`, `toStaffNoteStr()` |
| `progress.js` | `loadProgress()`, `recordAnswer()`, `resetProgress()`, `getAccuracyPercent()` |
| `audio.js` | `playClick()`, `playCorrect()`, `playIncorrect()`, `playInterval()` |
| `GrandStaff.js` | VexFlow wrapper — renders treble + bass staves |
| `app.js` | UI controller — state machine, step/flashcard flow, keyboard shortcuts, piano keyboard |
| `index.html` | Layout — staff card, answer panel (step sections + flashcard panel), stats, piano |
| `style.css` | All styling including step-section states (locked/active/confirmed), mode toggling |

---

## Key architectural decisions

### Note strings
All note strings include octave as last character: `'C4'`, `'F#4'`, `'Bb5'`.
- `noteStr.slice(0, -1)` = letter (e.g. `'F#'`)
- `noteStr.slice(-1)` = octave digit
- `toStaffNoteStr(noteStr, key)` in `exercise.js` strips key-implied accidentals before passing to VexFlow EasyScore (prevents duplicate sharp/flat symbols)

### Piano keyboard
Black keys have IDs (`key-F#4`, etc.). Flat names map to sharp enharmonics via `FLAT_TO_SHARP` in `app.js` (`Bb→A#`, `Eb→D#`, `Ab→G#`).

### Answer panel mode toggling
`#answer-panel` has class `mode-step` or `mode-flashcard`. CSS shows/hides `.steps-and-hints` vs `#flashcard-panel` accordingly. `kb-guide` hidden in flashcard mode.

### Extensibility (future: bass clef / different keys)
- `STAFF_CONFIG.clef` and `STAFF_CONFIG.octaveRange` drive note range generation
- `KEY_NOTES` in `curriculum.js` is the single source of truth for diatonic note sets
- `buildPairsForKey(key)` generates all valid pairs for any key at load time
- `buildNoteButtons(key)` rebuilds note selectors per question in scale order from tonic
- `renderStaff(question)` uses `question.key` dynamically — no static key signature

---

## Known open items / next ideas
- Bass clef mode (infrastructure ready via `STAFF_CONFIG.clef`)
- Additional keys beyond the current 7
- Metacognitive confidence rating to make SRS smarter (retrieval speed matters)
- Grand staff in different keys simultaneously (advanced)
