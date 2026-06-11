/* ---------------------------------------------------------------------------
   IndexedDB Wrapper — notes + review_log stores
   --------------------------------------------------------------------------- */

const DB_NAME = 'english_notes_db';
const DB_VERSION = 1;

let _db = null;

/**
 * Open (or create) the IndexedDB database
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('category', 'category', { unique: false });
        notesStore.createIndex('nextReviewAt', 'nextReviewAt', { unique: false });
        notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        notesStore.createIndex('aiExpanded', 'aiExpanded', { unique: false });
      }

      // Review log store
      if (!db.objectStoreNames.contains('review_log')) {
        const logStore = db.createObjectStore('review_log', { keyPath: 'id' });
        logStore.createIndex('reviewedAt', 'reviewedAt', { unique: false });
        logStore.createIndex('noteId', 'noteId', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic: get store (readwrite or readonly)
 */
function store(name, mode = 'readonly') {
  if (!_db) throw new Error('Database not opened');
  const tx = _db.transaction(name, mode);
  return tx.objectStore(name);
}

/**
 * Generic: put one item
 */
function put(storeName, item) {
  return new Promise((resolve, reject) => {
    const s = store(storeName, 'readwrite');
    const req = s.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic: get by id
 */
function get(storeName, id) {
  return new Promise((resolve, reject) => {
    const s = store(storeName, 'readonly');
    const req = s.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic: get all items from a store
 */
function getAll(storeName, indexName, query) {
  return new Promise((resolve, reject) => {
    const s = store(storeName, 'readonly');
    let req;
    if (indexName && query) {
      const idx = s.index(indexName);
      req = idx.getAll(query);
    } else if (indexName) {
      const idx = s.index(indexName);
      req = idx.getAll();
    } else {
      req = s.getAll();
    }
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic: delete by id
 */
function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const s = store(storeName, 'readwrite');
    const req = s.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic: count items in a store
 */
function count(storeName) {
  return new Promise((resolve, reject) => {
    const s = store(storeName, 'readonly');
    const req = s.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Notes CRUD
// ---------------------------------------------------------------------------

async function saveNote(note) {
  note.updatedAt = Date.now();
  await put('notes', note);
  performSync();
  return note;
}

async function getNote(id) {
  return get('notes', id);
}

async function getAllNotes() {
  const all = await getAll('notes');
  return all.filter((n) => !n._deleted);
}

async function getNotesByCategory(category) {
  return getAll('notes', 'category', category);
}

async function getDueNotes() {
  const now = Date.now();
  const all = await getAll('notes');
  const due = all
    .filter((n) => !n._deleted && !n.isMastered && n.nextReviewAt <= now)
    .sort(() => Math.random() - 0.5); // Fisher-Yates shuffle
  return due.slice(0, 20);
}

async function getUpcomingNote() {
  const all = await getAll('notes');
  const upcoming = all.filter((n) => n.nextReviewAt > Date.now());
  if (!upcoming.length) return null;
  upcoming.sort((a, b) => a.nextReviewAt - b.nextReviewAt);
  return upcoming[0];
}

async function getUncategorizedNotes() {
  const all = await getAll('notes');
  return all.filter((n) => !n.category);
}

async function deleteNote(id) {
  const paired = await isPaired();
  if (paired) {
    // Soft-delete: mark as deleted, sync engine will push tombstone to server
    const note = await get('notes', id);
    if (note) {
      note._deleted = true;
      note.updatedAt = Date.now();
      await put('notes', note);
    }
  } else {
    // Not paired: hard delete as before (no sync needed)
    const logs = await getAll('review_log', 'noteId', id);
    for (const log of logs) {
      await remove('review_log', log.id);
    }
    await remove('notes', id);
  }
}

async function updateNote(id, fields) {
  const note = await get('notes', id);
  if (!note) throw new Error('Note not found: ' + id);
  Object.assign(note, fields);
  note.updatedAt = Date.now();
  await put('notes', note);
  performSync();
  return note;
}

// ---------------------------------------------------------------------------
// Review Log
// ---------------------------------------------------------------------------

async function saveReviewLog(entry) {
  await put('review_log', entry);
  performSync();
  return entry;
}

async function getAllReviewLogs() {
  return getAll('review_log');
}

async function getReviewLogsByNoteId(noteId) {
  return getAll('review_log', 'noteId', noteId);
}

// ---------------------------------------------------------------------------
// Aggregation (for stats)
// ---------------------------------------------------------------------------

async function getNotesCreatedInRange(start, end) {
  const all = await getAll('notes');
  return all.filter((n) => n.createdAt >= start && n.createdAt <= end);
}

async function getReviewsInRange(start, end) {
  const all = await getAll('review_log');
  return all.filter((r) => r.reviewedAt >= start && r.reviewedAt <= end);
}

async function getMasteryDistribution() {
  const all = await getAll('notes');
  let unreviewed = 0, learning = 0, known = 0, mastered = 0;
  for (const n of all) {
    if (n.isMastered || n.consecutiveCorrect >= 5) mastered++;
    else if (n.consecutiveCorrect >= 3) known++;
    else if (n.consecutiveCorrect >= 1) learning++;
    else unreviewed++;
  }
  return { unreviewed, learning, known, mastered };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function exportAllData() {
  const notes = await getAll('notes');
  const reviewLogs = await getAll('review_log');
  return { notes, reviewLogs, exportedAt: Date.now() };
}

async function migrateNotes() {
  const all = await getAll('notes');
  let updated = false;
  for (const note of all) {
    let changed = false;
    if (note.favorited === undefined) {
      note.favorited = false;
      changed = true;
    }
    if (note.isMastered === undefined) {
      note.isMastered = false;
      changed = true;
    }
    if (note.consecutiveCorrect === undefined) {
      note.consecutiveCorrect = note.repetitions || 0;
      changed = true;
    }
    if (changed) {
      await put('notes', note);
      updated = true;
    }
  }
  if (updated) console.log('Migration: updated notes with new fields');
}

async function clearAllData() {
  const noteList = await getAll('notes');
  for (const n of noteList) await remove('notes', n.id);
  const logs = await getAll('review_log');
  for (const l of logs) await remove('review_log', l.id);
}

// ---------------------------------------------------------------------------
// Sync Metadata (localStorage + queries)
// ---------------------------------------------------------------------------

async function getDeviceId() {
  let id = localStorage.getItem('engnotes_device_id');
  if (!id) {
    id = uuid();
    localStorage.setItem('engnotes_device_id', id);
  }
  return id;
}

async function getDeviceName() {
  let name = localStorage.getItem('engnotes_device_name');
  if (!name) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    name = isMobile ? 'My Phone' : 'My Computer';
    localStorage.setItem('engnotes_device_name', name);
  }
  return name;
}

async function setDeviceName(name) {
  localStorage.setItem('engnotes_device_name', name);
}

async function getPairingCode() {
  return localStorage.getItem('engnotes_pairing_code') || null;
}

async function setPairingCode(code) {
  if (code) {
    localStorage.setItem('engnotes_pairing_code', code);
  } else {
    localStorage.removeItem('engnotes_pairing_code');
  }
}

async function getLastSyncTimestamp() {
  const val = localStorage.getItem('engnotes_last_sync');
  return val ? parseInt(val, 10) : 0;
}

async function setLastSyncTimestamp(ts) {
  localStorage.setItem('engnotes_last_sync', String(ts));
}

async function isPaired() {
  return !!(await getPairingCode());
}

/**
 * Get per-note synced-at timestamp (stored in localStorage for simplicity)
 */
async function getSyncedAt(noteId) {
  const val = localStorage.getItem('engnotes_synced_' + noteId);
  return val ? parseInt(val, 10) : 0;
}

async function setSyncedAt(noteId, ts) {
  if (ts > 0) {
    localStorage.setItem('engnotes_synced_' + noteId, String(ts));
  } else {
    localStorage.removeItem('engnotes_synced_' + noteId);
  }
}

/**
 * Get all notes that have been modified locally since last sync
 */
async function getLocallyModifiedNotes() {
  const all = await getAll('notes');
  const result = [];
  for (const note of all) {
    const syncedAt = await getSyncedAt(note.id);
    if (note.updatedAt > syncedAt || note._deleted) {
      result.push(note);
    }
  }
  return result;
}

/**
 * Get all review logs that haven't been synced yet
 */
async function getLocallyModifiedReviewLogs() {
  const all = await getAll('review_log');
  const result = [];
  for (const log of all) {
    const syncedAt = await getSyncedAt('log_' + log.id);
    if (!syncedAt) {
      result.push(log);
    }
  }
  return result;
}

/**
 * Convert a local note to the format the server expects
 */
function normalizeNoteForPush(note) {
  return {
    id: note.id,
    content: note.content,
    user_memo: note.userMemo || null,
    category: note.category || null,
    favorited: note.favorited ? 1 : 0,
    ease_factor: note.easeFactor,
    interval_days: note.interval,
    repetitions: note.repetitions,
    next_review_at: note.nextReviewAt,
    last_reviewed_at: note.lastReviewedAt || null,
    ai_expanded: note.aiExpanded ? 1 : 0,
    ai_expanded_at: note.aiExpandedAt || null,
    ai_chinese_translation: note.aiChineseTranslation || null,
    ai_definition: note.aiDefinition || null,
    ai_definition_en: note.aiDefinitionEn || null,
    ai_examples: JSON.stringify(note.aiExamples || []),
    ai_etymology: note.aiEtymology || null,
    ai_related_expressions: JSON.stringify(note.aiRelatedExpressions || []),
    ai_categorized_at: note.aiCategorizedAt || null,
    is_mastered: note.isMastered ? 1 : 0,
    consecutive_correct: note.consecutiveCorrect || 0,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted: note._deleted ? 1 : 0,
  };
}

/**
 * Convert a server note back to local format
 */
function denormalizeNoteFromServer(rn) {
  let aiExamples = [];
  let aiRelated = [];
  try { aiExamples = JSON.parse(rn.ai_examples || '[]'); } catch (_) {}
  try { aiRelated = JSON.parse(rn.ai_related_expressions || '[]'); } catch (_) {}

  return {
    id: rn.id,
    content: rn.content,
    userMemo: rn.user_memo || null,
    category: rn.category || null,
    favorited: rn.favorited === 1,
    easeFactor: rn.ease_factor || 2.5,
    interval: rn.interval_days || 0,
    repetitions: rn.repetitions || 0,
    nextReviewAt: rn.next_review_at || Date.now(),
    lastReviewedAt: rn.last_reviewed_at || null,
    aiExpanded: rn.ai_expanded === 1,
    aiExpandedAt: rn.ai_expanded_at || null,
    aiChineseTranslation: rn.ai_chinese_translation || null,
    aiDefinition: rn.ai_definition || null,
    aiDefinitionEn: rn.ai_definition_en || null,
    aiExamples,
    aiEtymology: rn.ai_etymology || null,
    aiRelatedExpressions: aiRelated,
    aiCategorizedAt: rn.ai_categorized_at || null,
    isMastered: rn.is_mastered === 1,
    consecutiveCorrect: rn.consecutive_correct || 0,
    createdAt: rn.created_at,
    updatedAt: rn.updated_at || rn.synced_at || Date.now(),
    _deleted: rn.deleted === 1,
  };
}

/**
 * Convert a server review log back to local format
 */
function denormalizeLogFromServer(rl) {
  return {
    id: rl.id,
    noteId: rl.note_id,
    reviewedAt: rl.reviewed_at,
    result: rl.result,
    easeFactorAfter: rl.ease_factor_after,
    intervalAfter: rl.interval_after,
    repetitionsAfter: rl.repetitions_after,
  };
}
