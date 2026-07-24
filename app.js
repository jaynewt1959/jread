// app.js — UI controller.  Wires curriculum, progress, and exercise together.
// Depends on: curriculum.js, progress.js, exercise.js, GrandStaff.js

// ── State ─────────────────────────────────────────────────────────────────────

let progress        = loadProgress();
let isRunning       = false;
let currentQuestion = null;
let lastQuestion    = null;
let currentStep     = 'interval'; // 'interval' | 'bottom' | 'top' | 'quality'
let questionWrong   = false;      // any mistake on any step → wrong for scoring
let awaitingNext    = false;
let nextTimer       = null;
let toastTimer      = null;

// ── Canvas size ───────────────────────────────────────────────────────────────

const CANVAS_W = GrandStaff.computeCanvasWidth({ numMeasures: 1, pixelsPerBeat: 52 });
const CANVAS_H = 280;

// ── Interval step data ───────────────────────────────────────────────────────

// Maps intervalId → the number value shown on step-1 buttons.
const INTERVAL_NUMBER_MAP = {
  P1: 'unison',
  m2: '2nd',  M2: '2nd',
  m3: '3rd',  M3: '3rd',
  P4: '4th',
  TT: 'tritone',
  P5: '5th',
  m6: '6th',  M6: '6th',
  m7: '7th',  M7: '7th',
  P8: 'octave',
};

// Only 2nd/3rd/6th/7th have a quality step; all others are perfect or tritone.
const INTERVAL_QUALITY_MAP = {
  m2: 'minor', M2: 'major',
  m3: 'minor', M3: 'major',
  m6: 'minor', M6: 'major',
  m7: 'minor', M7: 'major',
};

// The 9 buttons shown in step 1 (always all visible, regardless of stage).
const INTERVAL_NUMBERS = [
  { value: 'unison',  label: 'Unison'  },
  { value: '2nd',     label: '2nd'     },
  { value: '3rd',     label: '3rd'     },
  { value: '4th',     label: '4th'     },
  { value: 'tritone', label: 'Tritone' },
  { value: '5th',     label: '5th'     },
  { value: '6th',     label: '6th'     },
  { value: '7th',     label: '7th'     },
  { value: 'octave',  label: 'Octave'  },
];

// Keyboard shortcuts for step 1.
const NUM_KEY_MAP = {
  '1': 'unison', '2': '2nd', '3': '3rd', '4': '4th',
  't': 'tritone', '5': '5th', '6': '6th', '7': '7th', '8': 'octave',
};

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

// ── Button builders ───────────────────────────────────────────────────────────────

function buildIntervalNumberButtons() {
  const container = document.getElementById('interval-number-buttons');
  container.innerHTML = '';
  INTERVAL_NUMBERS.forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className     = 'ans-btn num-btn';
    btn.dataset.value = value;
    btn.textContent   = label;
    btn.addEventListener('click', () => onIntervalNumberSelect(value));
    container.appendChild(btn);
  });
}

function buildNoteButtons() {
  ['bottom-buttons', 'top-buttons'].forEach((cid, idx) => {
    const container = document.getElementById(cid);
    container.innerHTML = '';
    NOTE_LETTERS.forEach(letter => {
      const btn = document.createElement('button');
      btn.className      = 'ans-btn note-btn';
      btn.dataset.letter = letter;
      btn.textContent    = letter;
      btn.addEventListener('click', () =>
        onNoteSelect(idx === 0 ? 'bottom' : 'top', letter)
      );
      container.appendChild(btn);
    });
  });
}

function buildQualityButtons() {
  const container = document.getElementById('quality-buttons');
  container.innerHTML = '';
  ['Major', 'Minor'].forEach(q => {
    const btn = document.createElement('button');
    btn.className     = 'ans-btn quality-btn';
    btn.dataset.value = q.toLowerCase();
    btn.textContent   = q;
    btn.addEventListener('click', () => onQualitySelect(q.toLowerCase()));
    container.appendChild(btn);
  });
}

// ── Step management ───────────────────────────────────────────────────────────────

function setStepState(stepId, state) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.className = 'step-section step-' + state;
  el.querySelectorAll('button').forEach(b => {
    b.disabled = (state === 'locked' || state === 'confirmed');
  });
}

function activateStep(step) {
  const el = document.getElementById('step-' + step);
  if (!el) return;
  el.style.display = '';
  setStepState('step-' + step, 'active');
  setFeedback('', '');
}

function confirmStepBtn(containerId, dataAttr, value) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.querySelectorAll('button').forEach(btn => {
    if (btn.dataset[dataAttr] === value) btn.classList.add('btn-confirmed');
    btn.disabled = true;
  });
}

function flashWrongBtn(containerId, dataAttr, value) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const btn = Array.from(c.querySelectorAll('button'))
    .find(b => b.dataset[dataAttr] === value);
  if (!btn) return;
  btn.classList.add('btn-flash-wrong');
  setTimeout(() => btn.classList.remove('btn-flash-wrong'), 700);
}

function clearAllSteps() {
  ['step-interval', 'step-bottom', 'step-top'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'step-section step-locked';
    el.querySelectorAll('button').forEach(b => {
      b.classList.remove('btn-confirmed', 'btn-flash-wrong');
      b.disabled = false;
    });
  });
  const qEl = document.getElementById('step-quality');
  if (qEl) {
    qEl.style.display = 'none';
    qEl.className = 'step-section step-locked';
    qEl.querySelectorAll('button').forEach(b => {
      b.classList.remove('btn-confirmed', 'btn-flash-wrong');
      b.disabled = false;
    });
  }
}

function setFeedback(text, cls) {
  const el = document.getElementById('feedback');
  el.textContent = text;
  el.className   = cls;
}

// ── Toast ───────────────────────────────────────────────────────────────────

function showToast(isCorrect) {
  const el = document.getElementById('toast');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  el.classList.remove('show', 'toast-correct', 'toast-wrong');
  el.textContent = isCorrect ? '✓ Correct!' : '✗ Try again!';
  void el.offsetHeight;
  el.classList.add('show', isCorrect ? 'toast-correct' : 'toast-wrong');
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    toastTimer = null;
  }, 1900);
}

// ── Step selection handlers ───────────────────────────────────────────────

function onIntervalNumberSelect(value) {
  if (currentStep !== 'interval' || awaitingNext || !currentQuestion) return;
  const correct = INTERVAL_NUMBER_MAP[currentQuestion.intervalId];
  if (value === correct) {
    playClick();
    confirmStepBtn('interval-number-buttons', 'value', value);
    setStepState('step-interval', 'confirmed');
    currentStep = 'bottom';
    activateStep('bottom');
  } else {
    if (!questionWrong) { questionWrong = true; playIncorrect(); }
    flashWrongBtn('interval-number-buttons', 'value', value);
    setFeedback('Not quite — try again', 'feedback-wrong');
  }
}

function onNoteSelect(which, letter) {
  if (awaitingNext || !currentQuestion) return;
  if (currentStep !== which) return;
  const correct = which === 'bottom'
    ? currentQuestion.bottomLetter
    : currentQuestion.topLetter;
  const cid = which === 'bottom' ? 'bottom-buttons' : 'top-buttons';

  if (letter === correct) {
    playClick();
    confirmStepBtn(cid, 'letter', letter);
    setStepState('step-' + which, 'confirmed');
    if (which === 'bottom') {
      currentStep = 'top';
      activateStep('top');
    } else {
      if (currentQuestion.intervalId in INTERVAL_QUALITY_MAP) {
        currentStep = 'quality';
        activateStep('quality');
      } else {
        completeQuestion();
      }
    }
  } else {
    if (!questionWrong) { questionWrong = true; playIncorrect(); }
    flashWrongBtn(cid, 'letter', letter);
    setFeedback('Not quite — try again', 'feedback-wrong');
  }
}

function onQualitySelect(value) {
  if (currentStep !== 'quality' || awaitingNext || !currentQuestion) return;
  const correct = INTERVAL_QUALITY_MAP[currentQuestion.intervalId];
  if (value === correct) {
    playClick();
    confirmStepBtn('quality-buttons', 'value', value);
    setStepState('step-quality', 'confirmed');
    completeQuestion();
  } else {
    if (!questionWrong) { questionWrong = true; playIncorrect(); }
    flashWrongBtn('quality-buttons', 'value', value);
    setFeedback('Not quite — try again', 'feedback-wrong');
  }
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

function completeQuestion() {
  if (!currentQuestion) return;
  const isCorrect = !questionWrong;
  const { stageUnlocked, newStageIndex } = recordAnswer(
    progress, currentQuestion.intervalId, isCorrect
  );

  renderStaff(currentQuestion, isCorrect ? '#22c55e' : '#ef4444');
  updateStatus();
  renderStats();

  if (isCorrect) {
    playCorrect();
    showToast(true);
    setFeedback('Correct!', 'feedback-correct');
  } else {
    const iv = getInterval(currentQuestion.intervalId);
    setFeedback(
      'Done — ' + iv.name +
      ' · Bottom: ' + currentQuestion.bottomLetter +
      ' · Top: ' + currentQuestion.topLetter,
      'feedback-wrong'
    );
  }

  if (stageUnlocked) {
    setTimeout(() => {
      const el = document.getElementById('feedback');
      el.textContent += '   🎉 Stage ' + (newStageIndex + 1) + ' unlocked!';
    }, 400);
  }

  awaitingNext = true;
  document.getElementById('btn-next').classList.remove('hidden');
  nextTimer = setTimeout(nextQuestion, 2000);
}

function startExercise() {
  isRunning = true;
  document.getElementById('btn-start-stop').textContent = 'Stop';
  document.getElementById('staff-placeholder').style.display = 'none';
  document.getElementById('answer-panel').classList.remove('hidden');
  nextQuestion();
}

function stopExercise() {
  isRunning = false;
  if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  awaitingNext = false;

  document.getElementById('btn-start-stop').textContent = 'Start';
  document.getElementById('answer-panel').classList.add('hidden');
  document.getElementById('btn-next').classList.add('hidden');
  setFeedback('', '');
  document.getElementById('staff-placeholder').style.display = '';
  document.getElementById('grand-staff').innerHTML = '';

  clearAllSteps();
  clearKeyHighlights();
}

function nextQuestion() {
  if (!isRunning) return;
  awaitingNext  = false;
  questionWrong = false;
  currentStep   = 'interval';

  clearAllSteps();
  setFeedback('', '');
  document.getElementById('btn-next').classList.add('hidden');

  const activeIds = getActiveIntervalIds(progress.stageIndex);
  currentQuestion = generateQuestion(activeIds, lastQuestion);
  lastQuestion    = currentQuestion;
  if (!currentQuestion) return;

  renderStaff(currentQuestion);
  highlightKeys(currentQuestion.bottom, currentQuestion.top);
  activateStep('interval');
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
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  nextQuestion();
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (!isRunning) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Awaiting next: Enter or Space advances.
  if (awaitingNext) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
      nextQuestion();
    }
    return;
  }

  const key = e.key.toLowerCase();

  // Step 'interval': number/T keys select interval number.
  if (currentStep === 'interval' && NUM_KEY_MAP[key]) {
    e.preventDefault();
    onIntervalNumberSelect(NUM_KEY_MAP[key]);
    return;
  }

  // Steps 'bottom' / 'top': note letter keys.
  if ((currentStep === 'bottom' || currentStep === 'top') &&
       key.length === 1 && 'cdefgab'.includes(key)) {
    onNoteSelect(currentStep, key.toUpperCase());
    return;
  }

  // Step 'quality': M = major, N = minor.
  if (currentStep === 'quality') {
    if (key === 'm') { onQualitySelect('major'); return; }
    if (key === 'n') { onQualitySelect('minor'); return; }
  }
});

// ── Initialise ─────────────────────────────────────────────────────────────────────

buildKeyboard();
buildIntervalNumberButtons();
buildNoteButtons();
buildQualityButtons();
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
