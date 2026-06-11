/* ---------------------------------------------------------------------------
   SM-2 Spaced Repetition Algorithm (simplified)

   Interval table (days):
     consecutiveCorrect: 0 → 1 → 2 → 3 → 4 → 5+
     interval:           1   3   7  14  30  60 (max)

   "Don't Remember" resets consecutiveCorrect = 0, interval = 1.
   Mastered cards (isMastered = true) are permanently excluded from review.
   --------------------------------------------------------------------------- */

const INTERVAL_TABLE = [1, 3, 7, 14, 30, 60];

const SM2_DEFAULTS = {
  interval: 0,                 // days until next review
  repetitions: 0,              // total review count (kept for stats)
  consecutiveCorrect: 0,       // consecutive "Remember" count
  isMastered: false,           // if true → never appears in review
  nextReviewAt: Date.now(),
  lastReviewedAt: null,
  favorited: false,            // bookmark (does NOT affect review)
  easeFactor: 2.5,             // kept for backwards compat, no longer used
};

/**
 * Create a new note with default SM-2 fields
 */
function createNoteWithSM2(fields = {}) {
  return {
    ...SM2_DEFAULTS,
    nextReviewAt: Date.now(), // due immediately
    ...fields,
  };
}

/**
 * Look up the interval for a given consecutive-correct count.
 */
function intervalFor(consecutive) {
  if (consecutive >= INTERVAL_TABLE.length) {
    return INTERVAL_TABLE[INTERVAL_TABLE.length - 1];
  }
  return INTERVAL_TABLE[consecutive];
}

/**
 * Process a review result for a note.
 * Mutates the note object in place and returns it.
 *
 * @param {Object} note - The note to process (must have SM-2 fields)
 * @param {boolean} remembered - Whether the user recalled the card
 * @returns {Object} The updated note
 */
function processReview(note, remembered) {
  note.repetitions += 1;
  note.lastReviewedAt = Date.now();

  if (remembered) {
    note.consecutiveCorrect = (note.consecutiveCorrect || 0) + 1;
    note.interval = intervalFor(note.consecutiveCorrect);
  } else {
    note.consecutiveCorrect = 0;
    note.interval = 1;
  }

  note.nextReviewAt = Date.now() + note.interval * 86400000;
  return note;
}

/**
 * Mark a note as mastered. It will never appear in review again.
 */
function markMastered(note) {
  note.isMastered = true;
  note.consecutiveCorrect = (note.consecutiveCorrect || 0);
  note.updatedAt = Date.now();
  return note;
}

/**
 * Reset a mastered note back to learning state.
 */
function resetMastered(note) {
  note.isMastered = false;
  note.consecutiveCorrect = 0;
  note.interval = 1;
  note.nextReviewAt = Date.now(); // due immediately
  note.updatedAt = Date.now();
  return note;
}

/**
 * Predict the interval after a hypothetical review
 */
function predictInterval(note, remembered) {
  const clone = { ...note };
  processReview(clone, remembered);
  return clone.interval;
}

/**
 * Get mastery level as a human-readable string
 */
function masteryLevel(note) {
  if (note.isMastered) return 'Mastered';
  if (note.consecutiveCorrect >= 5) return 'Mastered';
  if (note.consecutiveCorrect >= 3) return 'Known';
  if (note.consecutiveCorrect >= 1) return 'Learning';
  if (note.repetitions === 0) return 'Not Reviewed';
  return 'Learning';
}
