/* ---------------------------------------------------------------------------
   Statistics View — #/stats
   --------------------------------------------------------------------------- */

async function renderStats(container) {
  const now = Date.now();

  container.innerHTML = `
    <div class="page-header">
      <h2>Statistics</h2>
      <p>Track your learning progress over time.</p>
    </div>

    <!-- Period selector -->
    <div class="filter-pills mb-lg" id="periodPills">
      <button class="pill active" data-period="weekly">Weekly</button>
      <button class="pill" data-period="monthly">Monthly</button>
      <button class="pill" data-period="yearly">Yearly</button>
    </div>

    <!-- Summary cards -->
    <div class="stats-grid" id="summaryCards">
      <div class="stat-card">
        <div class="stat-card__value" id="statTotalNotes">—</div>
        <div class="stat-card__label">Total Notes</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value" id="statTotalReviews">—</div>
        <div class="stat-card__label">Total Reviews</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value" id="statAvgEase">—</div>
        <div class="stat-card__label">Avg. Ease Factor</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value" id="statMastery">—%</div>
        <div class="stat-card__label">Mastery Rate</div>
      </div>
    </div>

    <!-- Chart: Entries Added -->
    <div class="chart-container">
      <h3>Entries Added</h3>
      <canvas id="chartEntries" style="width:100%;height:240px"></canvas>
    </div>

    <!-- Chart: Reviews Completed -->
    <div class="chart-container">
      <h3>Reviews Completed</h3>
      <canvas id="chartReviews" style="width:100%;height:240px"></canvas>
    </div>

    <!-- Chart: Mastery Distribution -->
    <div class="chart-container">
      <h3>Mastery Distribution</h3>
      <canvas id="chartMastery" style="width:100%;height:260px"></canvas>
    </div>
  `;

  // Default: weekly
  await loadStats('weekly');

  // Period selector
  document.getElementById('periodPills').addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('#periodPills .pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    loadStats(pill.dataset.period);
  });
}

async function loadStats(period) {
  const now = Date.now();
  let start;
  let bucketFn;

  if (period === 'weekly') {
    start = now - 7 * 86400000;
    bucketFn = (ts) => {
      const d = new Date(ts);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[d.getDay()];
    };
  } else if (period === 'monthly') {
    start = now - 30 * 86400000;
    bucketFn = (ts) => {
      const d = new Date(ts);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };
  } else {
    // yearly
    start = now - 365 * 86400000;
    bucketFn = (ts) => {
      const d = new Date(ts);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[d.getMonth()];
    };
  }

  // Fetch data
  const [notesInRange, reviewsInRange, mastery] = await Promise.all([
    getNotesCreatedInRange(start, now),
    getReviewsInRange(start, now),
    getMasteryDistribution(),
  ]);

  // Summary metrics
  const allNotes = await getAllNotes();
  const allReviews = await getAllReviewLogs();

  const totalNotes = allNotes.length;
  const totalReviews = allReviews.length;
  const avgEase = allNotes.length
    ? (allNotes.reduce((s, n) => s + (n.easeFactor || 2.5), 0) / allNotes.length).toFixed(1)
    : '2.5';
  const masteryRate = allNotes.length
    ? Math.round((allNotes.filter((n) => n.repetitions >= 4).length / allNotes.length) * 100)
    : 0;

  document.getElementById('statTotalNotes').textContent = totalNotes;
  document.getElementById('statTotalReviews').textContent = totalReviews;
  document.getElementById('statAvgEase').textContent = avgEase;
  document.getElementById('statMastery').textContent = masteryRate + '%';

  // Aggregate into buckets
  const buckets = getBuckets(period, start, bucketFn);
  const entryData = aggregateByBucket(notesInRange, 'createdAt', buckets);
  const reviewData = aggregateByBucket(reviewsInRange, 'reviewedAt', buckets);

  // Render charts
  renderBarChart(document.getElementById('chartEntries'), entryData);
  renderBarChart(document.getElementById('chartReviews'), reviewData);

  // Mastery donut
  renderDonutChart(document.getElementById('chartMastery'), [
    { label: 'Not Reviewed', value: mastery.unreviewed, color: getThemeColor('--text-tertiary') || '#d1d1d6' },
    { label: 'Learning', value: mastery.learning, color: getThemeColor('--primary') || '#E56A79' },
    { label: 'Known', value: mastery.known, color: getThemeColor('--warning') || '#ff9500' },
    { label: 'Mastered', value: mastery.mastered, color: getThemeColor('--success') || '#34c759' },
  ]);

  // Re-render charts on resize
  const handleResize = debounce(() => {
    if (document.getElementById('chartEntries')) {
      renderBarChart(document.getElementById('chartEntries'), entryData);
      renderBarChart(document.getElementById('chartReviews'), reviewData);
      renderDonutChart(document.getElementById('chartMastery'), [
        { label: 'Not Reviewed', value: mastery.unreviewed, color: '#d1d1d6' },
        { label: 'Learning', value: mastery.learning, color: '#4a90d9' },
        { label: 'Known', value: mastery.known, color: '#ff9500' },
        { label: 'Mastered', value: mastery.mastered, color: '#34c759' },
      ]);
    }
  }, 250);

  window.addEventListener('resize', handleResize, { once: true });
}

/**
 * Generate bucket labels for the period
 */
function getBuckets(period, start, bucketFn) {
  const buckets = [];
  const now = Date.now();
  if (period === 'weekly') {
    // Last 7 days in order
    for (let i = 6; i >= 0; i--) {
      const ts = now - i * 86400000;
      buckets.push({ label: bucketFn(ts), start: startOfDay(ts), end: endOfDay(ts) });
    }
  } else if (period === 'monthly') {
    // Last 30 days grouped by day
    for (let i = 29; i >= 0; i--) {
      const ts = now - i * 86400000;
      buckets.push({ label: bucketFn(ts), start: startOfDay(ts), end: endOfDay(ts) });
    }
  } else {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      buckets.push({ label: bucketFn(monthStart), start: monthStart, end: monthEnd });
    }
  }
  return buckets;
}

/**
 * Count items that fall into each bucket
 */
function aggregateByBucket(items, dateField, buckets) {
  return buckets.map((b) => ({
    label: b.label,
    value: items.filter((item) => item[dateField] >= b.start && item[dateField] <= b.end).length,
  }));
}
