// progress.js — Persist and update user progress in localStorage.
// Depends on: INTERVALS, STAGES, MASTERY_STREAK (curriculum.js)

const STORAGE_KEY = 'jread_progress';

/** Create a fresh progress object (no prior history). */
function initProgress() {
  const stats = {};
  INTERVALS.forEach(iv => {
    stats[iv.id] = { correct: 0, total: 0, streak: 0 };
  });
  return { stageIndex: 0, stats };
}

/** Load from localStorage, or return a fresh object if nothing is stored. */
function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initProgress();
  try {
    const parsed = JSON.parse(raw);
    // Back-fill any interval ids added since last save.
    INTERVALS.forEach(iv => {
      if (!parsed.stats[iv.id]) {
        parsed.stats[iv.id] = { correct: 0, total: 0, streak: 0 };
      }
    });
    return parsed;
  } catch {
    return initProgress();
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/** Wipe localStorage and return a clean progress object. */
function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  return initProgress();
}

/**
 * Record whether the user answered correctly for an interval.
 * Mutates `progress` in place and saves.
 *
 * @returns {{ stageUnlocked: boolean, newStageIndex: number }}
 */
function recordAnswer(progress, intervalId, isCorrect) {
  const s = progress.stats[intervalId];
  s.total++;
  if (isCorrect) {
    s.correct++;
    s.streak++;
  } else {
    s.streak = 0;
  }

  let stageUnlocked = false;
  if (progress.stageIndex < STAGES.length - 1) {
    const currentStage = STAGES[progress.stageIndex];
    const allMastered = currentStage.intervals.every(
      id => progress.stats[id].streak >= MASTERY_STREAK
    );
    if (allMastered) {
      progress.stageIndex++;
      stageUnlocked = true;
    }
  }

  saveProgress(progress);
  return { stageUnlocked, newStageIndex: progress.stageIndex };
}

/**
 * Return overall accuracy as an integer percent, or null if no answers yet.
 */
function getAccuracyPercent(progress) {
  let correct = 0, total = 0;
  Object.values(progress.stats).forEach(s => {
    correct += s.correct;
    total   += s.total;
  });
  return total === 0 ? null : Math.round((correct / total) * 100);
}
