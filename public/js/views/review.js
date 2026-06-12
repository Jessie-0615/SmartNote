/* ---------------------------------------------------------------------------
   Review View — #/review
   Card stack design, inline buttons, auto-advance, pre-review count
   --------------------------------------------------------------------------- */

let reviewSession = null;

async function renderReview(container) {
  container.innerHTML = '' +
    '<div class="page-header"><h2>Review</h2><p>Practice your notes at your own pace.</p></div>' +
    '<div id="reviewContent"></div>';
  try {
    await showPreStart();
  } catch (err) {
    var content = document.getElementById('reviewContent');
    if (content) {
      content.innerHTML = '<div class="empty-state"><h3>Review Error</h3><p style="color:var(--danger)">' + escapeHtml(err.message) + '</p></div>';
    }
    console.error('Review error:', err);
  }
}

/**
 * Pre-review screen: show count, let user start
 */
async function showPreStart() {
  var content = document.getElementById('reviewContent');
  if (!content) return;

  var dueNotes = await getDueNotes();

  if (!dueNotes.length) {
    content.innerHTML = '' +
      '<div class="review-empty" style="animation:slideUp 0.5s ease">' +
        '<div class="review-empty__pattern">' +
          '<span class="review-empty__dot review-empty__dot--1"></span>' +
          '<span class="review-empty__dot review-empty__dot--2"></span>' +
          '<span class="review-empty__dot review-empty__dot--3"></span>' +
          '<span class="review-empty__dot review-empty__dot--4"></span>' +
          '<span class="review-empty__dot review-empty__dot--5"></span>' +
          '<span class="review-empty__ring review-empty__ring--1"></span>' +
          '<span class="review-empty__ring review-empty__ring--2"></span>' +
        '</div>' +
        '<div class="review-empty__icon">~</div>' +
        '<h3>Your cards are fresh</h3>' +
        '<p>Nothing is due for review right now. Add something new whenever you feel like it.</p>' +
        '<button class="btn btn--primary mt-lg" onclick="location.hash=\'#/add\'">Add New Notes</button>' +
      '</div>';
    return;
  }

  reviewSession = {
    notes: dueNotes,
    currentIndex: 0,
    revealed: false,
    total: dueNotes.length,
    remembered: 0,
    forgotten: 0,
    mastered: 0
  };
  renderReviewCard();
}

function renderReviewCard() {
  var content = document.getElementById('reviewContent');
  if (!content || !reviewSession) return;

  var notes = reviewSession.notes;
  var currentIndex = reviewSession.currentIndex;
  var total = reviewSession.total;
  var revealed = reviewSession.revealed;

  if (currentIndex >= total) {
    renderSessionComplete(content);
    return;
  }

  var note = notes[currentIndex];
  var progressPct = Math.round((currentIndex / total) * 100);

  content.innerHTML = '' +
    '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + progressPct + '%"></div></div>' +
    '<p class="text-center text-secondary mb-md" style="font-size:var(--font-size-sm)">' + (currentIndex + 1) + ' of ' + total + '</p>' +
    '<div class="review-stack">' +
      '<div class="review-card--ghost review-card--ghost-2"></div>' +
      '<div class="review-card--ghost review-card--ghost-1"></div>' +
      '<div class="review-card--active" id="reviewCard" style="animation: slideUp 0.35s ease">' +
        '<button class="review-mastery-btn" id="masteryBtn" title="Mark as mastered">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</button>' +
        '<div class="review-card__body" id="cardBody">' +
          (!revealed ?
            '<div class="review-card__text">' + escapeHtml(note.content) + '</div><div class="review-card__hint">Tap to reveal</div>' :
            (note.userMemo ?
              '<div class="review-card__memo-label">Your Note</div><div class="review-card__memo">' + escapeHtml(note.userMemo) + '</div>' :
              '<div class="review-card__memo-label">No note added</div><div class="review-card__memo" style="color:var(--text-tertiary);font-style:italic">Add a personal note in Browse to see it here.</div>'
            )
          ) +
        '</div>' +
        '<div class="review-card__actions' + (revealed ? ' review-card__actions--visible' : '') + '">' +
          '<button class="btn btn--outline" id="forgotBtn">Don&rsquo;t Remember</button>' +
          '<button class="btn btn--primary" id="rememberedBtn">Remember</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  var card = document.getElementById('reviewCard');

  if (!revealed && card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.review-mastery-btn') || e.target.closest('.review-card__actions')) return;
      revealCard();
    });
  }

  var masteryBtn = document.getElementById('masteryBtn');
  if (masteryBtn) {
    masteryBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      handleMastered();
    });
  }

  var forgotBtn = document.getElementById('forgotBtn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      handleReview(false);
    });
  }

  var rememberedBtn = document.getElementById('rememberedBtn');
  if (rememberedBtn) {
    rememberedBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      handleReview(true);
    });
  }
}

function revealCard() {
  if (!reviewSession) return;
  reviewSession.revealed = true;
  renderReviewCard();
}

async function handleReview(remembered) {
  if (!reviewSession) return;
  var note = reviewSession.notes[reviewSession.currentIndex];

  processReview(note, remembered);
  await updateNote(note.id, {
    interval: note.interval,
    repetitions: note.repetitions,
    consecutiveCorrect: note.consecutiveCorrect,
    nextReviewAt: note.nextReviewAt,
    lastReviewedAt: note.lastReviewedAt
  });
  await saveReviewLog({
    id: uuid(),
    noteId: note.id,
    reviewedAt: Date.now(),
    result: remembered ? 'remembered' : 'forgotten',
    intervalAfter: note.interval,
    repetitionsAfter: note.repetitions
  });

  if (remembered) { reviewSession.remembered++; Sound.ding(); }
  else { reviewSession.forgotten++; Sound.thud(); }

  var card = document.getElementById('reviewCard');
  if (card) {
    card.style.animation = 'cardAdvance 0.25s ease forwards';
    await sleep(250);
  }

  reviewSession.currentIndex++;
  reviewSession.revealed = false;
  renderReviewCard();
}

async function handleMastered() {
  if (!reviewSession) return;
  var note = reviewSession.notes[reviewSession.currentIndex];

  markMastered(note);
  await updateNote(note.id, { isMastered: true });
  reviewSession.mastered++;
  Sound.sparkle();

  var card = document.getElementById('reviewCard');
  if (card) {
    card.style.animation = 'cardAdvance 0.25s ease forwards';
    await sleep(250);
  }

  reviewSession.currentIndex++;
  reviewSession.revealed = false;
  renderReviewCard();
}

function renderSessionComplete(container) {
  var remembered = reviewSession.remembered;
  var forgotten = reviewSession.forgotten;
  var mastered = reviewSession.mastered;
  var total = reviewSession.total;
  reviewSession = null;

  var reviewed = remembered + forgotten;
  var pct = reviewed > 0 ? Math.round((remembered / reviewed) * 100) : 0;
  var msg = pct >= 80 ? 'Great session. Come back whenever.' : (pct >= 50 ? 'Good progress. Keep at it.' : 'Practice makes progress. No rush.');

  container.innerHTML = '' +
    '<div class="review-complete">' +
      '<div class="review-complete__burst">' +
        '<div class="review-complete__ring"></div>' +
        '<div class="review-complete__ring"></div>' +
        '<div class="review-complete__ring"></div>' +
        '<div class="review-complete__check">✦</div>' +
      '</div>' +
      '<h3 style="color:var(--primary);margin-bottom:var(--space-sm)">Session Complete</h3>' +
      '<p class="text-secondary" style="font-size:var(--font-size-sm);margin-bottom:var(--space-lg)">' + msg + '</p>' +
      '<div class="review-complete__stats">' +
        '<div class="review-complete__stat"><div class="review-complete__stat-val">' + reviewed + '</div><div class="review-complete__stat-lbl">Reviewed</div></div>' +
        '<div class="review-complete__stat"><div class="review-complete__stat-val" style="color:var(--success)">' + remembered + '</div><div class="review-complete__stat-lbl">Remembered</div></div>' +
        '<div class="review-complete__stat"><div class="review-complete__stat-val" style="color:var(--danger)">' + forgotten + '</div><div class="review-complete__stat-lbl">Forgot</div></div>' +
      '</div>' +
      (mastered > 0 ? '<p class="text-secondary" style="font-size:var(--font-size-sm);margin-bottom:var(--space-md)">+ ' + mastered + ' card' + (mastered !== 1 ? 's' : '') + ' mastered</p>' : '') +
      '<div class="flex gap-sm" style="justify-content:center">' +
        '<button class="btn btn--primary" onclick="location.hash=\'#/review\'">Review Again</button>' +
        '<button class="btn btn--outline" onclick="location.hash=\'#/add\'">Add Notes</button>' +
      '</div>' +
    '</div>';
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}
