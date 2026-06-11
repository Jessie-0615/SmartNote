/* ---------------------------------------------------------------------------
   Database Module — swappable storage layer for sync

   Interface (all functions async):
     init()                         — create tables, enable WAL
     registerDevice(id, name)       — returns { pairingCode }
     pairDevice(code, id, name)     — joins pairing group, returns { groupId }
     pushChanges(deviceId, payload) — upsert notes + review_logs
     pullChanges(deviceId, since)   — returns { notes, reviewLogs, serverTime }
     getPairedDevices(deviceId)     — returns [{ deviceId, deviceName }]
     unpairDevice(deviceId)         — removes device from pairing group

   To swap SQLite for PostgreSQL later:
     Rewrite this file with the same exports. server.js stays untouched.
   --------------------------------------------------------------------------- */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'sync.db');

let _db = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a 6-character alphanumeric pairing code (uppercase, no ambiguous chars)
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/l
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function uuid() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      device_id      TEXT PRIMARY KEY,
      device_name    TEXT NOT NULL,
      pairing_group_id TEXT,
      pairing_code   TEXT UNIQUE,
      last_sync_at   INTEGER DEFAULT 0,
      created_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id                  TEXT PRIMARY KEY,
      content             TEXT NOT NULL,
      user_memo           TEXT,
      category            TEXT,
      favorited           INTEGER DEFAULT 0,
      ease_factor         REAL DEFAULT 2.5,
      interval_days       INTEGER DEFAULT 0,
      repetitions         INTEGER DEFAULT 0,
      next_review_at      INTEGER DEFAULT 0,
      last_reviewed_at    INTEGER,
      ai_expanded         INTEGER DEFAULT 0,
      ai_expanded_at      INTEGER,
      ai_chinese_translation TEXT,
      ai_definition       TEXT,
      ai_definition_en    TEXT,
      ai_examples         TEXT,
      ai_etymology        TEXT,
      ai_related_expressions TEXT,
      ai_categorized_at   INTEGER,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL,
      deleted             INTEGER DEFAULT 0,
      device_id           TEXT NOT NULL,
      synced_at           INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id                TEXT PRIMARY KEY,
      note_id           TEXT NOT NULL,
      reviewed_at       INTEGER NOT NULL,
      result            TEXT NOT NULL,
      ease_factor_after REAL,
      interval_after    INTEGER,
      repetitions_after INTEGER,
      device_id         TEXT NOT NULL,
      synced_at         INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
    CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted);
    CREATE INDEX IF NOT EXISTS idx_review_synced ON review_log(synced_at);
    CREATE INDEX IF NOT EXISTS idx_devices_code ON devices(pairing_code);
    CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(pairing_group_id);
  `);

  console.log('  Database ready:', DB_PATH);
}

// ---------------------------------------------------------------------------
// registerDevice
// ---------------------------------------------------------------------------

async function registerDevice(deviceId, deviceName) {
  if (!_db) throw new Error('Database not initialized');

  // Check if device already exists
  const existing = _db.prepare('SELECT pairing_code FROM devices WHERE device_id = ?').get(deviceId);
  if (existing && existing.pairing_code) {
    return { pairingCode: existing.pairing_code };
  }

  const code = generateCode();
  const groupId = uuid();

  const upsert = _db.prepare(`
    INSERT INTO devices (device_id, device_name, pairing_group_id, pairing_code, last_sync_at, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      pairing_group_id = COALESCE(devices.pairing_group_id, excluded.pairing_group_id),
      pairing_code = COALESCE(devices.pairing_code, excluded.pairing_code),
      device_name = excluded.device_name
  `);
  upsert.run(deviceId, deviceName, groupId, code, Date.now());

  return { pairingCode: code };
}

// ---------------------------------------------------------------------------
// pairDevice
// ---------------------------------------------------------------------------

async function pairDevice(code, deviceId, deviceName) {
  if (!_db) throw new Error('Database not initialized');

  // Normalize code: uppercase, trim
  const normalized = code.trim().toUpperCase();

  // Find the target device by pairing code
  const target = _db.prepare('SELECT device_id, pairing_group_id, device_name FROM devices WHERE pairing_code = ?').get(normalized);
  if (!target) {
    throw new Error('Invalid pairing code. Check the code and try again.');
  }

  if (target.device_id === deviceId) {
    throw new Error('You cannot pair with your own code.');
  }

  const groupId = target.pairing_group_id;

  // Upsert this device into the same pairing group
  const upsert = _db.prepare(`
    INSERT INTO devices (device_id, device_name, pairing_group_id, pairing_code, last_sync_at, created_at)
    VALUES (?, ?, ?, NULL, 0, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      pairing_group_id = excluded.pairing_group_id,
      device_name = excluded.device_name
  `);
  upsert.run(deviceId, deviceName, groupId, Date.now());

  return { groupId };
}

// ---------------------------------------------------------------------------
// pushChanges
// ---------------------------------------------------------------------------

async function pushChanges(deviceId, payload) {
  if (!_db) throw new Error('Database not initialized');

  const { notes = [], reviewLogs = [] } = payload;
  const now = Date.now();

  // Normalize note fields so all named parameters are present for SQLite
  function norm(n) {
    return {
      id: n.id || '',
      content: n.content || '',
      user_memo: n.user_memo || null,
      category: n.category || null,
      favorited: n.favorited || 0,
      ease_factor: n.ease_factor ?? 2.5,
      interval_days: n.interval_days || 0,
      repetitions: n.repetitions || 0,
      next_review_at: n.next_review_at || 0,
      last_reviewed_at: n.last_reviewed_at || null,
      ai_expanded: n.ai_expanded || 0,
      ai_expanded_at: n.ai_expanded_at || null,
      ai_chinese_translation: n.ai_chinese_translation || null,
      ai_definition: n.ai_definition || null,
      ai_definition_en: n.ai_definition_en || null,
      ai_examples: n.ai_examples || '[]',
      ai_etymology: n.ai_etymology || null,
      ai_related_expressions: n.ai_related_expressions || '[]',
      ai_categorized_at: n.ai_categorized_at || null,
      created_at: n.created_at || now,
      updated_at: n.updated_at || now,
      deleted: n.deleted || 0,
    };
  }

  function normLog(l) {
    return {
      id: l.id || '',
      note_id: l.note_id || '',
      reviewed_at: l.reviewed_at || now,
      result: l.result || 'remembered',
      ease_factor_after: l.ease_factor_after ?? 2.5,
      interval_after: l.interval_after || 0,
      repetitions_after: l.repetitions_after || 0,
    };
  }

  const upsertNote = _db.prepare(`
    INSERT INTO notes (
      id, content, user_memo, category, favorited,
      ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at,
      ai_expanded, ai_expanded_at, ai_chinese_translation, ai_definition, ai_definition_en,
      ai_examples, ai_etymology, ai_related_expressions, ai_categorized_at,
      created_at, updated_at, deleted, device_id, synced_at
    ) VALUES (
      @id, @content, @user_memo, @category, @favorited,
      @ease_factor, @interval_days, @repetitions, @next_review_at, @last_reviewed_at,
      @ai_expanded, @ai_expanded_at, @ai_chinese_translation, @ai_definition, @ai_definition_en,
      @ai_examples, @ai_etymology, @ai_related_expressions, @ai_categorized_at,
      @created_at, @updated_at, @deleted, @device_id, @synced_at
    ) ON CONFLICT(id) DO UPDATE SET
      content = COALESCE(excluded.content, notes.content),
      user_memo = COALESCE(excluded.user_memo, notes.user_memo),
      category = COALESCE(excluded.category, notes.category),
      favorited = excluded.favorited,
      ease_factor = excluded.ease_factor,
      interval_days = excluded.interval_days,
      repetitions = excluded.repetitions,
      next_review_at = excluded.next_review_at,
      last_reviewed_at = COALESCE(excluded.last_reviewed_at, notes.last_reviewed_at),
      ai_expanded = excluded.ai_expanded,
      ai_expanded_at = COALESCE(excluded.ai_expanded_at, notes.ai_expanded_at),
      ai_chinese_translation = COALESCE(excluded.ai_chinese_translation, notes.ai_chinese_translation),
      ai_definition = COALESCE(excluded.ai_definition, notes.ai_definition),
      ai_definition_en = COALESCE(excluded.ai_definition_en, notes.ai_definition_en),
      ai_examples = COALESCE(excluded.ai_examples, notes.ai_examples),
      ai_etymology = COALESCE(excluded.ai_etymology, notes.ai_etymology),
      ai_related_expressions = COALESCE(excluded.ai_related_expressions, notes.ai_related_expressions),
      ai_categorized_at = COALESCE(excluded.ai_categorized_at, notes.ai_categorized_at),
      updated_at = excluded.updated_at,
      deleted = excluded.deleted,
      device_id = excluded.device_id,
      synced_at = excluded.synced_at
  `);

  const upsertLog = _db.prepare(`
    INSERT INTO review_log (
      id, note_id, reviewed_at, result,
      ease_factor_after, interval_after, repetitions_after,
      device_id, synced_at
    ) VALUES (
      @id, @note_id, @reviewed_at, @result,
      @ease_factor_after, @interval_after, @repetitions_after,
      @device_id, @synced_at
    ) ON CONFLICT(id) DO NOTHING
  `);

  const insertMany = _db.transaction(() => {
    for (const n of notes) {
      upsertNote.run({
        ...norm(n),
        device_id: deviceId,
        synced_at: now,
      });
    }
    for (const l of reviewLogs) {
      upsertLog.run({
        ...normLog(l),
        device_id: deviceId,
        synced_at: now,
      });
    }
  });

  insertMany();

  // Update device's last_sync_at
  _db.prepare('UPDATE devices SET last_sync_at = ? WHERE device_id = ?').run(now, deviceId);

  return { syncedAt: now };
}

// ---------------------------------------------------------------------------
// pullChanges
// ---------------------------------------------------------------------------

async function pullChanges(deviceId, since) {
  if (!_db) throw new Error('Database not initialized');

  // Get the device's pairing group
  const device = _db.prepare('SELECT pairing_group_id FROM devices WHERE device_id = ?').get(deviceId);
  if (!device || !device.pairing_group_id) {
    return { notes: [], reviewLogs: [], serverTime: Date.now() };
  }

  const groupId = device.pairing_group_id;

  // Get all device IDs in the same pairing group
  const groupDevices = _db.prepare(
    'SELECT device_id FROM devices WHERE pairing_group_id = ?'
  ).all(groupId).map((d) => d.device_id);

  if (groupDevices.length === 0) {
    return { notes: [], reviewLogs: [], serverTime: Date.now() };
  }

  const serverTime = Date.now();

  // Pull notes from paired devices (excluding notes from this device that it just pushed)
  const placeholders = groupDevices.map(() => '?').join(',');
  const noteRows = _db.prepare(`
    SELECT * FROM notes
    WHERE device_id IN (${placeholders})
      AND synced_at > ?
    ORDER BY updated_at ASC
  `).all(...groupDevices, since);

  // Pull review logs from paired devices
  const logRows = _db.prepare(`
    SELECT * FROM review_log
    WHERE device_id IN (${placeholders})
      AND synced_at > ?
    ORDER BY synced_at ASC
  `).all(...groupDevices, since);

  return { notes: noteRows, reviewLogs: logRows, serverTime };
}

// ---------------------------------------------------------------------------
// getPairedDevices
// ---------------------------------------------------------------------------

async function getPairedDevices(deviceId) {
  if (!_db) throw new Error('Database not initialized');

  const device = _db.prepare('SELECT pairing_group_id FROM devices WHERE device_id = ?').get(deviceId);
  if (!device || !device.pairing_group_id) return [];

  const rows = _db.prepare(
    'SELECT device_id, device_name, last_sync_at, created_at FROM devices WHERE pairing_group_id = ? ORDER BY created_at ASC'
  ).all(device.pairing_group_id);

  return rows.map((r) => ({
    deviceId: r.device_id,
    deviceName: r.device_name,
    lastSyncAt: r.last_sync_at,
    createdAt: r.created_at,
    isMe: r.device_id === deviceId,
  }));
}

// ---------------------------------------------------------------------------
// unpairDevice
// ---------------------------------------------------------------------------

async function unpairDevice(deviceId) {
  if (!_db) throw new Error('Database not initialized');

  // Move device to its own new pairing group (isolates it)
  const newGroupId = uuid();
  _db.prepare(
    'UPDATE devices SET pairing_group_id = ?, pairing_code = NULL WHERE device_id = ?'
  ).run(newGroupId, deviceId);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  init,
  registerDevice,
  pairDevice,
  pushChanges,
  pullChanges,
  getPairedDevices,
  unpairDevice,
};
