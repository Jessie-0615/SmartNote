/* ---------------------------------------------------------------------------
   Sync Engine — local ↔ server bidirectional sync

   Model:
     - Each device has a pairing code (6 chars). Pairing links devices.
     - Sync cycles: push local changes → pull remote changes → merge.
     - Last-write-wins conflict resolution (newer updatedAt wins).
     - Soft-delete: notes are tombstoned before permanent deletion.
   --------------------------------------------------------------------------- */

const SYNC_INTERVAL = 30_000; // 30 seconds between sync cycles

let _syncTimer = null;
let _syncInProgress = false;

/**
 * Build the sync URL. Uses the current origin so it works on any host.
 */
function syncUrl(path) {
  return '/api/sync' + path;
}

/**
 * Perform a full sync cycle.
 */
async function performSync() {
  if (_syncInProgress) return;
  _syncInProgress = true;

  try {
    const deviceId = await getDeviceId();
    const since = await getLastSyncTimestamp();

    // ── Push ──
    const localNotes = await getLocallyModifiedNotes();
    const localLogs = await getLocallyModifiedReviewLogs();

    if (localNotes.length > 0 || localLogs.length > 0) {
      const pushRes = await fetch(syncUrl('/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          notes: localNotes.map(normalizeNoteForPush),
          reviewLogs: localLogs.map((l) => ({
            id: l.id,
            note_id: l.noteId,
            reviewed_at: l.reviewedAt,
            result: l.result,
            ease_factor_after: l.easeFactorAfter,
            interval_after: l.intervalAfter,
            repetitions_after: l.repetitionsAfter,
          })),
        }),
      });

      if (pushRes.ok) {
        // Record synced-at for pushed items
        const now = Date.now();
        for (const note of localNotes) {
          if (note._deleted) {
            // Tombstone has been pushed — now we can hard-delete locally
            await remove('notes', note.id);
            await setSyncedAt(note.id, 0);
          } else {
            await setSyncedAt(note.id, now);
          }
        }
        for (const log of localLogs) {
          await setSyncedAt('log_' + log.id, now);
        }
      }
    }

    // ── Pull ──
    const pullRes = await fetch(syncUrl('/pull'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, since }),
    });

    if (pullRes.ok) {
      const { notes: remoteNotes, reviewLogs: remoteLogs, serverTime } = await pullRes.json();

      // Apply remote notes (last-write-wins)
      for (const rn of (remoteNotes || [])) {
        if (rn.deleted) {
          // Remote tombstone — delete locally
          const local = await getNote(rn.id);
          if (local) {
            await remove('notes', rn.id);
          }
          await setSyncedAt(rn.id, 0);
        } else {
          const local = await getNote(rn.id);
          const remoteNote = denormalizeNoteFromServer(rn);

          if (!local || (rn.updated_at >= (local.updatedAt || 0))) {
            // Server version is newer or same — apply it
            await saveNote(remoteNote);
            await setSyncedAt(rn.id, rn.synced_at || rn.updated_at);
          }
          // else: local is newer, will be pushed on next cycle
        }
      }

      // Apply remote review logs (append-only, skip if already exists)
      for (const rl of (remoteLogs || [])) {
        const existing = await get('review_log', rl.id);
        if (!existing) {
          await saveReviewLog(denormalizeLogFromServer(rl));
        }
        await setSyncedAt('log_' + rl.id, rl.synced_at);
      }

      // Update sync cursor
      if (serverTime) {
        await setLastSyncTimestamp(Math.max(since, serverTime));
      }
    }
  } catch (err) {
    // Offline or server unreachable — silently retry next cycle
    console.debug('Sync skipped:', err.message);
  } finally {
    _syncInProgress = false;
  }
}

/**
 * Register this device with the server and get a pairing code.
 */
async function registerDevice() {
  const deviceId = await getDeviceId();
  const deviceName = await getDeviceName();

  const res = await fetch(syncUrl('/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, deviceName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed');
  }

  const { pairingCode } = await res.json();
  await setPairingCode(pairingCode);

  // Run initial sync immediately after registering
  performSync();

  return pairingCode;
}

/**
 * Pair this device with another using a code.
 */
async function pairWithCode(code) {
  const deviceId = await getDeviceId();
  const deviceName = await getDeviceName();

  const res = await fetch(syncUrl('/pair'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceId, deviceName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Pairing failed');
  }

  await setPairingCode(code);

  // Force a full pull by resetting sync cursor
  await setLastSyncTimestamp(0);
  await performSync();

  return true;
}

/**
 * Unpair this device from its group.
 */
async function unpairDevice() {
  const deviceId = await getDeviceId();

  const res = await fetch(syncUrl('/unpair'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Unpair failed');
  }

  await setPairingCode(null);
  await setLastSyncTimestamp(0);
}

/**
 * Get list of paired devices.
 */
async function getPairedDeviceList() {
  const deviceId = await getDeviceId();
  const res = await fetch(syncUrl('/devices?deviceId=' + encodeURIComponent(deviceId)));

  if (!res.ok) return [];
  const data = await res.json();
  return data.devices || [];
}

/**
 * Start the background sync scheduler.
 * Call this once after IndexedDB is ready.
 */
function initSyncEngine() {
  // Only sync if paired
  if (!localStorage.getItem('engnotes_pairing_code')) {
    console.log('Sync: not paired, sync engine idle');
    return;
  }

  console.log('Sync: engine started');

  // Initial sync
  performSync();

  // Periodic sync
  _syncTimer = setInterval(performSync, SYNC_INTERVAL);

  // Sync when user returns to the tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) performSync();
  });

  // Sync when network comes back
  window.addEventListener('online', () => {
    performSync();
  });
}
