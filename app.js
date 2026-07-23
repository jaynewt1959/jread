// app.js — UI controller.  Wires curriculum, progress, and exercise together.
// Depends on: curriculum.js, progress.js, exercise.js, GrandStaff.js

// ── State ─────────────────────────────────────────────────────────────────────

let progress         = loadProgress();
let isRunning        = false;
let currentQuestion  = null;
let lastQuestion     = null;
let selectedInterval = null;
let selectedBottom   = null;
let selectedTop      = null;
let awaitingNext     = false;
let nextTimer        = null;
let toastTimer       = null;
let lastIntervalKey  = null;   // keyboard: which interval key was last pressed
let cycleIndex       = 0;      // keyboard: which option in that key's cycle

// ── Canvas size ───────────────────────────────────────────────────────────────

// Sized for C major (0 accidentals) with comfortable note spacing.
const CANVAS_W = GrandStaff.computeCanvasWidth({ numMeasures: 1, pixelsPerBeat: 52 });
const CANVAS_H = 280;

// ── Keyboard → interval mapping ──────────────────────────────────────────────────

// Keys 1–8 cover the interval degree; T covers the tritone.
// Pressing the same key again cycles through quality variants (major ↔ minor).
const INTERVAL_KEY_MAP = {
  '1': ['P1'],
  '2': ['m2', 'M2'],
  '3': ['m3', 'M3'],
  '4': ['P4'],
  't': ['TT'],
  '5': ['P5'],
  '6': ['m6', 'M6'],
  '7': ['m7', 'M7'],
  '8': ['P8'],
};

// Reverse: interval ID → shortcut label shown on each button.
const INTERVAL_ID_TO_KEY = {};
Object.entries(INTERVAL_KEY_MAP).forEach(([k, ids]) => {
  ids.forEach(id => { INTERVAL_ID_TO_KEY[id] = k === 't' ? 'T' : k; });
});

// ── Piano keyboard constants ───────────────────────────────────────────────────────

const WHITE_KEY_W = 32;
const WHITE_KEY_H = 92;
const BLACK_KEY_W = 20;
const BLACK_KEY_H = 58;

// All white keys in the 2-octave display range (C4–B5).
const WHITE_NOTES = [
  'C4','D4','E4','F4','G4','A4','B4',
  'C5','D5','E5','F5','G5','A5','B5',
];

// Black keys: computed once — note name + absolute left offset in px.
const BLACK_KEY_DEFS = (() => {
  // Pattern per octave: note-name-base + index-of-white-key-to-its-left.
  const pattern = [
    ['C#', 0], ['D#', 1], ['F#', 3], ['G#', 4], ['A#', 5],
  ];
  const defs = [];
  for (let oct = 0; oct < 2; oct++) {
    const baseIdx = oct * 7;
    const octNum  = oct + 4;
    pattern.forEach(([base, whiteIdx]) => {
      const left = (baseIdx + whiteIdx + 1) * WHITE_KEY_W - Math.floor(BLACK_KEY_W / 2);
      defs.push({ note: base + octNum, left });
    });
  }
  return defs;
})();

// ── Piano keyboard rendering ──────────────────────────────────────────────────

function buildKeyboard() {
  const container = document.getElementById('keyboard');
  container.style.position   = 'relative';
  container.style.width      = (WHITE_NOTES.length * WHITE_KEY_W) + 'px';
  container.style.height     = WHITE_KEY_H + 'px';
  container.style.userSelect = 'none';

  WHITE_NOTES.forEach((note, i) => {
    const key = document.createElement('div');
    key.className = 'key white-key';
    key.id        = 'key-' + note;
    key.style.left = (i * WHITE_KEY_W) + 'px';
    container.appendChild(key);
  });

  BLACK_KEY_DEFS.forEach(({ note, left }) => {
    const key = document.createElement('div');
    key.className  = 'key black-key';
    key.style.left = left + 'px';
    container.appendChild(key);
  });
}

function highlightKeys(bottom, top) {
  clearKeyHighlights();
  [bottom, top].forEach(note => {
    const el = document.getElementById('key-' + note);
    if (el) el.classList.add('key-active');
  });
}

function clearKeyHighlights() {
  WHITE_NOTES.forEach(note => {
    const el = document.getElementById('key-' + note);
    if (el) el.classList.remove('key-active');
  });
}

// ── Answer button builders ────────────────────────────────────────────────────

function buildIntervalButtons() {
  const container = document.getElementById('interval-buttons');
  container.innerHTML = '';
  const activeIds = new Set(getActiveIntervalIds(progress.stageIndex));

  INTERVALS.forEach(iv => {
    const isActive = activeIds.has(iv.id);
    const btn = document.createElement('button');
    btn.className  = 'ans-btn interval-btn' + (isActive ? '' : ' locked');
    btn.dataset.id = iv.id;
    btn.disabled   = !isActive;
    const keyLabel = INTERVAL_ID_TO_KEY[iv.id];
    btn.innerHTML  = iv.name +
      (keyLabel ? ' <span class="key-hint">' + keyLabel + '</span>' : '');
    btn.addEventListener('click', () => onIntervalSelect(iv.id));
    container.appendChild(btn);
  });
}

function buildNoteButtons() {
  ['bottom-buttons', 'top-buttons'].forEach((cid, idx) => {
    const container = document.getElementById(cid);
    container.innerHTML = '';
    NOTE_LETTERS.forEach(letter => {
      const btn = document.createElement('button');
      btn.className       = 'ans-btn note-btn';
      btn.dataset.letter  = letter;
      btn.textContent     = letter;
      btn.addEventListener('click', () =>
        onNoteSelect(idx === 0 ? 'bottom' : 'top', letter)
      );
      container.appendChild(btn);
    });
  });
}

// ── Group highlight (active-group visual indicator) ───────────────────────────────────

function getActiveGroupId() {
  if (!isRunning || awaitingNext) return null;
  if (!selectedInterval) return 'sg-interval';
  if (!selectedBottom)   return 'sg-bottom';
  if (!selectedTop)      return 'sg-top';
  return null;
}

function updateGroupHighlight() {
  const active = getActiveGroupId();
  ['sg-interval', 'sg-bottom', 'sg-top'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('group-active', id === active);
  });
}

// ── Keyboard interval cycling ────────────────────────────────────────────────────

function handleIntervalKey(key) {
  const candidates = INTERVAL_KEY_MAP[key] || [];
  const activeIds  = new Set(getActiveIntervalIds(progress.stageIndex));
  const available  = candidates.filter(id => activeIds.has(id));
  if (available.length === 0) return;

  if (key === lastIntervalKey) {
    // Same key again: advance cycle position.
    cycleIndex = (cycleIndex + 1) % available.length;
  } else {
    lastIntervalKey = key;
    cycleIndex      = 0;
  }
  onIntervalSelect(available[cycleIndex]);
}

function handleKbBackspace() {
  if (selectedTop) {
    selectedTop = null;
    document.querySelectorAll('#top-buttons .note-btn')
      .forEach(b => b.classList.remove('selected'));
  } else if (selectedBottom) {
    selectedBottom = null;
    document.querySelectorAll('#bottom-buttons .note-btn')
      .forEach(b => b.classList.remove('selected'));
  } else if (selectedInterval) {
    selectedInterval = null;
    lastIntervalKey  = null;
    cycleIndex       = 0;
    document.querySelectorAll('.interval-btn')
      .forEach(b => b.classList.remove('selected'));
  }
  updateCheckButton();
}

// ── Toast ────────────────────────────────────────────────────────────────────

function showToast(isCorrect) {
  const el = document.getElementById('toast');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  // Remove classes so re-showing fires the CSS transition again.
  el.classList.remove('show', 'toast-correct', 'toast-wrong');
  el.textContent = isCorrect ? '✓ Correct!' : '✗ Try again!';
  // Force reflow so the transition sees a state change.
  void el.offsetHeight;
  el.classList.add('show', isCorrect ? 'toast-correct' : 'toast-wrong');
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    toastTimer = null;
  }, 950);
}

// ── Selection handlers ────────────────────────────────────────────────────────

function onIntervalSelect(id) {
  if (awaitingNext) return;
  playClick();
  selectedInterval = id;
  document.querySelectorAll('.interval-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.id === id && !btn.disabled);
  });
  updateCheckButton();
}

function onNoteSelect(which, letter) {
  if (awaitingNext) return;
  playClick();
  const cid = which === 'bottom' ? 'bottom-buttons' : 'top-buttons';
  if (which === 'bottom') selectedBottom = letter;
  else                    selectedTop    = letter;

  document.querySelectorAll('#' + cid + ' .note-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.letter === letter);
  });
  updateCheckButton();
}

function updateCheckButton() {
  document.getElementById('btn-check').disabled =
    !(selectedInterval && selectedBottom && selectedTop);
  updateGroupHighlight();
}

function clearSelections() {
  selectedInterval = selectedBottom = selectedTop = null;
  lastIntervalKey  = null;
  cycleIndex       = 0;
  document.querySelectorAll('.ans-btn.selected').forEach(b => b.classList.remove('selected'));
  updateCheckButton();
}

// ── Grand staff rendering ─────────────────────────────────────────────────────

function renderStaff(question, color) {
  const container = document.getElementById('grand-staff');
  container.innerHTML = '';
  try {
    const treble = buildTrebleScore(question.bottom, question.top, question.intervalId);
    const gs = new GrandStaff('grand-staff', {
      width:         CANVAS_W,
      height:        CANVAS_H,
      keySignature:  'C',
      timeSignature: '4/4',
    }).addMeasure(treble, 'C3/w/r');

    if (color) gs.colorNote('treble', 0, 0, color);
    gs.draw();
  } catch (err) {
    container.textContent = 'Render error: ' + (err.message || String(err));
    console.error('Staff render error', err);
  }
}

// ── Status bar ────────────────────────────────────────────────────────────────

function updateStatus() {
  document.getElementById('stage-badge').textContent =
    'Stage ' + (progress.stageIndex + 1) + ' / ' + STAGES.length;

  const acc = getAccuracyPercent(progress);
  document.getElementById('accuracy').textContent =
    acc === null ? 'Accuracy: —' : 'Accuracy: ' + acc + '%';
}

// ── Progress dashboard ───────────────────────────────────────────────────────────

function renderStats() {
  // ── Overall summary line
  let totalCorrect = 0, totalAnswered = 0;
  Object.values(progress.stats).forEach(s => {
    totalCorrect  += s.correct;
    totalAnswered += s.total;
  });
  const overallAcc = totalAnswered === 0
    ? null
    : Math.round((totalCorrect / totalAnswered) * 100);

  document.getElementById('stats-overall').textContent = totalAnswered === 0
    ? 'No answers yet'
    : overallAcc + '% correct · ' + totalAnswered + ' answered';

  // ── Stage trail
  const trail = document.getElementById('stats-trail');
  trail.innerHTML = '';
  STAGES.forEach((stage, si) => {
    const isComplete = si < progress.stageIndex;
    const isActive   = si === progress.stageIndex;
    const status     = isComplete ? 'complete' : isActive ? 'active' : 'locked';
    const mastered   = stage.intervals.filter(
      id => progress.stats[id].streak >= MASTERY_STREAK
    ).length;

    // Connector line between nodes
    if (si > 0) {
      const conn = document.createElement('div');
      conn.className = 'trail-conn' + (isComplete ? ' trail-conn-done' : '');
      trail.appendChild(conn);
    }

    // Stage node
    const node = document.createElement('div');
    node.className = 'trail-node trail-' + status;
    node.textContent = isComplete ? '✓' : stage.stage;
    node.title = 'Stage ' + stage.stage + ': ' +
      (isComplete ? 'complete' :
       isActive   ? mastered + '/' + stage.intervals.length + ' mastered' :
                   'locked');
    trail.appendChild(node);
  });

  // ── Per-stage breakdown
  const body = document.getElementById('stats-body');
  body.innerHTML = '';

  STAGES.forEach((stage, si) => {
    const isUnlocked = si <= progress.stageIndex;
    const isActive   = si === progress.stageIndex;
    const isComplete = si < progress.stageIndex;
    const mastered   = stage.intervals.filter(
      id => progress.stats[id].streak >= MASTERY_STREAK
    ).length;

    const section = document.createElement('div');
    section.className = 'stats-stage' + (isUnlocked ? '' : ' stats-stage-locked');

    // Stage header
    const hd = document.createElement('div');
    hd.className = 'stats-stage-hd';
    let badge = '';
    if (isComplete) {
      badge = '<span class="stats-badge stats-badge-done">complete<\/span>';
    } else if (isActive) {
      badge = '<span class="stats-badge stats-badge-active">' +
        mastered + '/' + stage.intervals.length + ' mastered<\/span>';
    } else {
      badge = '<span class="stats-badge stats-badge-locked">locked<\/span>';
    }
    hd.innerHTML = '<span class="stats-stage-name">Stage ' + stage.stage + '<\/span>' + badge;
    section.appendChild(hd);

    // One row per interval
    stage.intervals.forEach(id => {
      const iv        = getInterval(id);
      const s         = progress.stats[id];
      const isMastered = s.streak >= MASTERY_STREAK;
      const acc       = s.total === 0 ? null : Math.round((s.correct / s.total) * 100);

      const row = document.createElement('div');
      row.className = 'stats-row' + (isMastered ? ' stats-mastered' : '');

      if (!isUnlocked) {
        // Locked: just name
        row.innerHTML = '<span class="stats-iv-name">' + iv.name +
          '<\/span><span class="stats-locked-dash">—<\/span>';
      } else {
        const barPct = acc === null ? 0 : acc;
        const streak = Math.min(s.streak, MASTERY_STREAK);
        const pips   = Array.from({ length: MASTERY_STREAK }, (_, i) =>
          '<span class="pip ' + (i < streak ? 'pip-on' : 'pip-off') + '"><\/span>'
        ).join('');

        row.innerHTML =
          '<span class="stats-iv-name">' + iv.name + '<\/span>' +
          '<div class="stats-bar"><div class="stats-bar-fill" style="width:' + barPct + '%"><\/div><\/div>' +
          '<span class="stats-pct">' + (acc === null ? '—' : acc + '%') + '<\/span>' +
          '<div class="stats-pips">' + pips + '<\/div>' +
          '<span class="stats-check">' + (isMastered ? '✓' : '') + '<\/span>';
      }

      section.appendChild(row);
    });

    body.appendChild(section);
  });
}

// ── Exercise flow ─────────────────────────────────────────────────────────────────────

function startExercise() {
  isRunning = true;
  document.getElementById('btn-start-stop').textContent = 'Stop';
  document.getElementById('staff-placeholder').style.display = 'none';
  document.getElementById('answer-panel').classList.remove('hidden');
  buildIntervalButtons();   // reflect current stage
  nextQuestion();
}

function stopExercise() {
  isRunning = false;
  if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  awaitingNext = false;

  document.getElementById('btn-start-stop').textContent = 'Start';
  document.getElementById('answer-panel').classList.add('hidden');
  document.getElementById('btn-check').disabled = true;
  document.getElementById('btn-next').classList.add('hidden');
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className   = '';
  document.getElementById('staff-placeholder').style.display = '';
  document.getElementById('grand-staff').innerHTML = '';

  clearSelections();
  clearKeyHighlights();
}

function nextQuestion() {
  if (!isRunning) return;
  awaitingNext    = false;
  lastIntervalKey = null;
  cycleIndex      = 0;

  clearSelections();
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className   = '';
  document.getElementById('btn-next').classList.add('hidden');

  const activeIds = getActiveIntervalIds(progress.stageIndex);
  currentQuestion = generateQuestion(activeIds, lastQuestion);
  lastQuestion    = currentQuestion;
  if (!currentQuestion) return;

  renderStaff(currentQuestion);
  highlightKeys(currentQuestion.bottom, currentQuestion.top);

  // Re-enable answer buttons (they were all disabled after last Check).
  document.querySelectorAll('.ans-btn:not(.locked)').forEach(btn => {
    btn.disabled = false;
  });
}

function handleCheckAnswer() {
  if (!currentQuestion) return;

  const isCorrect = checkAnswer(
    currentQuestion, selectedInterval, selectedBottom, selectedTop
  );
  const { stageUnlocked, newStageIndex } = recordAnswer(
    progress, currentQuestion.intervalId, isCorrect
  );

  renderStaff(currentQuestion, isCorrect ? '#22c55e' : '#ef4444');
  updateStatus();
  renderStats();

  // Audio + visual popup
  if (isCorrect) {
    playCorrect();
  } else {
    playIncorrect();
  }
  showToast(isCorrect);

  const feedbackEl = document.getElementById('feedback');
  if (isCorrect) {
    feedbackEl.textContent = 'Correct!';
    feedbackEl.className   = 'feedback-correct';
  } else {
    const iv = getInterval(currentQuestion.intervalId);
    feedbackEl.textContent =
      'Not quite — ' + iv.name +
      ' · Bottom: ' + currentQuestion.bottomLetter +
      ' · Top: '    + currentQuestion.topLetter;
    feedbackEl.className = 'feedback-wrong';
  }

  if (stageUnlocked) {
    // Brief delay so the user reads the correct/wrong message first.
    setTimeout(() => {
      feedbackEl.textContent += '   🎉 Stage ' + (newStageIndex + 1) + ' unlocked!';
      buildIntervalButtons();   // add newly-unlocked interval buttons
    }, 400);
  }

  awaitingNext    = true;
  lastIntervalKey  = null;
  cycleIndex       = 0;
  updateGroupHighlight();   // clears all group highlights while awaiting
  document.getElementById('btn-check').disabled = true;
  document.getElementById('btn-next').classList.remove('hidden');
  // Disable all answer buttons while showing feedback.
  document.querySelectorAll('.ans-btn').forEach(btn => { btn.disabled = true; });

  // Auto-advance to next question after 2 s.
  nextTimer = setTimeout(nextQuestion, 2000);
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('btn-start-stop').addEventListener('click', () => {
  if (isRunning) stopExercise(); else startExercise();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress? This cannot be undone.')) return;
  progress = resetProgress();
  updateStatus();
  renderStats();
  if (isRunning) stopExercise();
  buildIntervalButtons();
});

document.getElementById('btn-check').addEventListener('click', handleCheckAnswer);

document.getElementById('btn-next').addEventListener('click', () => {
  if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  nextQuestion();
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (!isRunning) return;
  // Ignore if a real form field has focus.
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // While awaiting next question: Enter or Space advances.
  if (awaitingNext) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
      nextQuestion();
    }
    return;
  }

  // Enter → submit (Check).
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!document.getElementById('btn-check').disabled) handleCheckAnswer();
    return;
  }

  // Backspace → undo last selection.
  if (e.key === 'Backspace') {
    e.preventDefault();
    handleKbBackspace();
    return;
  }

  const key = e.key.toLowerCase();

  // Note letters: C D E F G A B.
  if (key.length === 1 && 'cdefgab'.includes(key)) {
    // First unset slot gets the letter; if both are set, re-select top note.
    if (!selectedBottom) {
      onNoteSelect('bottom', key.toUpperCase());
    } else {
      onNoteSelect('top', key.toUpperCase());
    }
    return;
  }

  // Interval keys: 1–8 for degree, T for tritone.
  if (INTERVAL_KEY_MAP[key]) {
    handleIntervalKey(key);
  }
});

// ── Initialise ─────────────────────────────────────────────────────────────────────

buildKeyboard();
buildIntervalButtons();
buildNoteButtons();
updateStatus();
renderStats();

// Restore stats panel open/closed preference (default: closed)
const statsPanel = document.getElementById('stats-panel');
if (localStorage.getItem('jread_stats_open') === 'true') {
  statsPanel.setAttribute('open', '');
}
statsPanel.addEventListener('toggle', () => {
  localStorage.setItem('jread_stats_open', statsPanel.open ? 'true' : 'false');
});
