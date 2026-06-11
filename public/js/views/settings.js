/* ---------------------------------------------------------------------------
   Settings View — #/settings
   --------------------------------------------------------------------------- */

async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Settings</h2>
      <p>Manage your app and data.</p>
    </div>

    <!-- API Key Configuration -->
    <div class="card mb-md">
      <h3 style="font-size:var(--font-size-md)">DeepSeek API Key</h3>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        Your key is stored locally in this browser only. Get a free key (5M tokens, no credit card) at
        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">platform.deepseek.com</a>
      </p>
      <div class="form-group mt-md" style="margin-bottom:var(--space-sm)">
        <input
          type="password"
          id="apiKeyInput"
          class="form-input"
          placeholder="sk-..."
          autocomplete="off"
        >
      </div>
      <div class="flex gap-sm">
        <button class="btn btn--primary btn--sm" id="saveApiKeyBtn">Save Key</button>
        <button class="btn btn--ghost btn--sm" id="toggleKeyBtn" style="font-size:var(--font-size-xs)">Show</button>
        <button class="btn btn--ghost btn--sm" id="clearApiKeyBtn" style="color:var(--color-danger);font-size:var(--font-size-xs)">Clear</button>
      </div>
      <p id="apiKeyStatus" class="text-secondary" style="font-size:var(--font-size-xs);margin-top:var(--space-sm)"></p>
    </div>

    <!-- API Status -->
    <div class="card mb-md">
      <div class="flex-between">
        <div>
          <h3 style="font-size:var(--font-size-md)">AI Connection</h3>
          <p class="text-secondary" style="font-size:var(--font-size-sm)" id="apiStatusText">Checking...</p>
        </div>
        <span id="apiStatusDot" style="width:12px;height:12px;border-radius:50%;background:#aeaeb2;display:inline-block"></span>
      </div>
      <button class="btn btn--outline btn--sm mt-md" id="checkApiBtn">Check Connection</button>
    </div>

    <!-- Theme Switcher -->
    <div class="card mb-md">
      <h3 style="font-size:var(--font-size-md)">Color Theme</h3>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        Choose a color scheme for the interface.
      </p>
      <div class="theme-grid" id="themeGrid"></div>
    </div>

    <!-- Interface Style -->
    <div class="card mb-md">
      <h3 style="font-size:var(--font-size-md)">Interface Style</h3>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        Choose a visual texture and depth effect for the interface.
      </p>
      <div class="theme-grid" id="styleGrid"></div>
    </div>

    <!-- Sync & Pairing -->
    <div class="card mb-md">
      <div class="flex-between">
        <h3 style="font-size:var(--font-size-md)">Sync & Pairing</h3>
        <span id="syncStatusDot" style="width:10px;height:10px;border-radius:50%;background:var(--text-tertiary);display:inline-block;flex-shrink:0" title="Sync status"></span>
      </div>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        Pair your devices to sync notes across desktop and phone.
      </p>
      <div id="syncUI" class="mt-md">
        <div class="empty-state"><p class="text-secondary">Loading...</p></div>
      </div>
    </div>

    <!-- Categorize All Uncategorized -->
    <div class="card mb-md">
      <h3 style="font-size:var(--font-size-md)">Categorize Uncategorized Notes</h3>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        If any notes were saved while offline, they may be missing categories. This will run AI categorization on all uncategorized notes.
      </p>
      <button class="btn btn--outline mt-md" id="categorizeAllBtn">Categorize All</button>
      <div id="categorizeProgress" class="mt-md"></div>
    </div>

    <!-- Data Management -->
    <div class="card mb-md">
      <h3 style="font-size:var(--font-size-md)">Data Management</h3>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        Export your notes and review history as a JSON file, or clear all data.
      </p>
      <div class="flex gap-sm mt-md">
        <button class="btn btn--outline" id="exportBtn">Export All Data</button>
        <button class="btn btn--ghost" id="clearBtn" style="color:var(--danger)">Clear All Data</button>
      </div>
    </div>

    <!-- About -->
    <div class="card mb-md">
      <h3 style="font-size:var(--font-size-md)">About EngNotes</h3>
      <p class="text-secondary" style="font-size:var(--font-size-sm)">
        English Learning Note & Review App v1.0<br>
        AI-powered categorization · Spaced repetition (SM-2) · PWA<br>
        Data stored locally in your browser. Nothing is sent to any server except AI API calls for categorization and expansion.
      </p>
    </div>

    <!-- Version History -->
    <div class="card">
      <div class="flex-between" id="versionHistoryHeader" style="cursor:pointer">
        <h3 style="font-size:var(--font-size-md)">Version History <span id="versionHistoryArrow" style="font-size:0.8rem">▸</span></h3>
        <span id="gitStatusDot" style="width:10px;height:10px;border-radius:50%;background:var(--text-tertiary);display:inline-block;flex-shrink:0" title="Backend status"></span>
      </div>
      <div id="versionHistoryBody" style="display:none">
        <p class="text-secondary" style="font-size:var(--font-size-sm);margin-top:var(--space-sm)">
          Save checkpoints of your project and restore to previous versions if needed.
        </p>
        <div class="flex gap-sm mt-md" style="flex-wrap:wrap">
          <button class="btn btn--primary btn--sm" id="saveCheckpointBtn">Save Checkpoint</button>
          <button class="btn btn--ghost btn--sm" id="refreshCheckpointsBtn">Refresh</button>
        </div>
        <div id="checkpointList" class="mt-md">
          <p class="text-secondary" style="font-size:var(--font-size-sm)">Loading...</p>
        </div>
      </div>
    </div>
  `;

  // --- Theme Picker ---
  renderThemePicker();

  // --- Style Picker ---
  renderStylePicker();

  // --- Sync UI ---
  renderSyncUI();

  // --- Version History ---
  initVersionHistory();

  // --- API Key Management ---
  const apiKeyInput = document.getElementById('apiKeyInput');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  // Load saved key
  const savedKey = localStorage.getItem('engnotes_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
    apiKeyStatus.textContent = 'Key saved in this browser';
    apiKeyStatus.style.color = 'var(--color-success)';
  }

  // Save key
  document.getElementById('saveApiKeyBtn')?.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showToast('Please enter an API key', 'error');
      return;
    }
    if (!key.startsWith('sk-')) {
      showToast('Key should start with "sk-"', 'error');
      return;
    }
    localStorage.setItem('engnotes_api_key', key);
    apiKeyStatus.textContent = 'Key saved!';
    apiKeyStatus.style.color = 'var(--color-success)';
    showToast('API key saved!', 'success');
    checkApiHealth();
    // Auto-categorize uncategorized notes
    autoCategorizeAll();
  });

  // Show/hide key
  document.getElementById('toggleKeyBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('toggleKeyBtn');
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      btn.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      btn.textContent = 'Show';
    }
  });

  // Clear key
  document.getElementById('clearApiKeyBtn')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog(
      'Clear API Key',
      'Remove your saved API key? AI categorization and expansion will stop working until you add a new key.',
      'Clear Key',
      true
    );
    if (confirmed) {
      localStorage.removeItem('engnotes_api_key');
      apiKeyInput.value = '';
      apiKeyStatus.textContent = 'No key saved';
      apiKeyStatus.style.color = 'var(--color-text-secondary)';
      showToast('API key removed', 'success');
      checkApiHealth();
    }
  });

  // Check API health
  checkApiHealth();

  document.getElementById('checkApiBtn')?.addEventListener('click', checkApiHealth);

  // Export
  document.getElementById('exportBtn')?.addEventListener('click', async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `engnotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported!', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  });

  // Clear all data
  document.getElementById('clearBtn')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog(
      'Clear All Data',
      'This will permanently delete ALL your notes and review history. This cannot be undone.',
      'Clear Everything',
      true
    );
    if (confirmed) {
      const doubleConfirmed = await confirmDialog(
        'Are you absolutely sure?',
        'All your learning data will be lost forever.',
        'Yes, Delete All',
        true
      );
      if (doubleConfirmed) {
        await clearAllData();
        showToast('All data cleared', 'success');
        location.hash = '#/add';
      }
    }
  });

  // Categorize all
  document.getElementById('categorizeAllBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('categorizeAllBtn');
    const progress = document.getElementById('categorizeProgress');

    const uncategorized = await getUncategorizedNotes();
    if (!uncategorized.length) {
      progress.innerHTML = '<p class="text-secondary" style="font-size:var(--font-size-sm)">All notes are already categorized!</p>';
      return;
    }

    btn.disabled = true;
    let done = 0;
    let failed = 0;

    progress.innerHTML = `<p class="text-secondary" style="font-size:var(--font-size-sm)">Processing ${uncategorized.length} notes...</p>`;

    for (const note of uncategorized) {
      try {
        const category = await aiCategorize(note.content);
        await updateNote(note.id, {
          category,
          aiCategorizedAt: Date.now(),
        });
        done++;
      } catch {
        failed++;
      }
      progress.innerHTML = `
        <div class="progress-bar" style="margin-top:var(--space-sm)">
          <div class="progress-bar__fill" style="width:${Math.round(((done + failed) / uncategorized.length) * 100)}%"></div>
        </div>
        <p class="text-secondary" style="font-size:var(--font-size-xs)">
          ${done} done, ${failed} failed out of ${uncategorized.length}
        </p>
      `;
    }

    progress.innerHTML = `
      <p style="font-size:var(--font-size-sm);color:var(--color-success);font-weight:600">
        Done! ${done} categorized, ${failed} failed.
      </p>
    `;
    btn.disabled = false;
    showToast('Categorization complete!', 'success');
  });
}

async function checkApiHealth() {
  const dot = document.getElementById('apiStatusDot');
  const text = document.getElementById('apiStatusText');

  if (!dot || !text) return;

  text.textContent = 'Checking...';
  dot.style.background = '#aeaeb2';

  try {
    const result = await aiHealthCheck();
    if (result.ok && (result.hasUserKey || result.hasServerKey)) {
      const source = result.hasUserKey ? 'your key' : 'server key';
      text.textContent = `Connected — using ${source}`;
      dot.style.background = '#34c759';
    } else if (result.ok) {
      text.textContent = 'Server is running, but no API key configured. Add your key above.';
      dot.style.background = '#ff9500';
    } else {
      text.textContent = 'Cannot reach server — check that the app is running';
      dot.style.background = '#ff3b30';
    }
  } catch {
    text.textContent = 'Cannot reach server — check that the app is running';
    dot.style.background = '#ff3b30';
  }
}

async function autoCategorizeAll() {
  const uncategorized = await getUncategorizedNotes();
  if (!uncategorized.length) return;
  let done = 0;
  for (const note of uncategorized) {
    try {
      const category = await aiCategorize(note.content);
      await updateNote(note.id, { category, aiCategorizedAt: Date.now() });
      done++;
    } catch { /* skip failed */ }
  }
  if (done > 0) showToast(`Categorized ${done} note${done!==1?'s':''}!`, 'success');
}

// ---------------------------------------------------------------------------
// Sync & Pairing UI
// ---------------------------------------------------------------------------

async function renderSyncUI() {
  const container = document.getElementById('syncUI');
  const dot = document.getElementById('syncStatusDot');
  if (!container) return;

  const deviceName = await getDeviceName();
  const pairingCode = await getPairingCode();
  const isDevicePaired = await isPaired();

  // Update status dot
  if (dot) {
    dot.style.background = isDevicePaired ? 'var(--success)' : 'var(--text-tertiary)';
    dot.title = isDevicePaired ? 'Paired & syncing' : 'Not paired';
  }

  // Render appropriate UI based on state
  if (isDevicePaired && pairingCode) {
    // ── Paired state ──
    let pairedDevices = [];
    try {
      pairedDevices = await getPairedDeviceList();
    } catch (_) { /* server might be offline */ }

    const lastSync = await getLastSyncTimestamp();
    const lastSyncStr = lastSync
      ? formatDate(lastSync) + ' ' + new Date(lastSync).toLocaleTimeString()
      : 'Never';

    container.innerHTML = `
      <div style="background:var(--success-bg);padding:var(--space-md);border-radius:var(--radius-sm);margin-bottom:var(--space-md)">
        <p style="font-weight:600;color:var(--success)">✓ Paired</p>
        <p class="text-secondary" style="font-size:var(--font-size-xs)">
          Last synced: ${lastSyncStr}
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">Device Name</label>
        <div class="flex gap-sm">
          <input type="text" id="deviceNameInput" class="form-input" value="${escapeHtml(deviceName)}" style="flex:1">
          <button class="btn btn--primary btn--sm" id="saveDeviceNameBtn">Save</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Your Pairing Code</label>
        <div class="flex gap-sm" style="align-items:center">
          <code style="font-size:1.5rem;font-weight:700;letter-spacing:0.1em;background:var(--primary-bg);padding:8px 16px;border-radius:var(--radius-sm);color:var(--primary);user-select:all">${escapeHtml(pairingCode)}</code>
          <button class="btn btn--ghost btn--sm" id="copyCodeBtn" title="Copy code">Copy</button>
        </div>
        <p class="text-secondary" style="font-size:var(--font-size-xs);margin-top:var(--space-xs)">
          Enter this code on another device to pair.
        </p>
      </div>

      ${pairedDevices.length > 0 ? `
        <div class="form-group">
          <label class="form-label">Paired Devices</label>
          <div style="display:flex;flex-direction:column;gap:var(--space-xs)">
            ${pairedDevices.map(d => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--card-bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <span style="font-size:var(--font-size-sm)">${escapeHtml(d.deviceName)}${d.isMe ? ' <span class="text-secondary">(you)</span>' : ''}</span>
                <div style="display:flex;align-items:center;gap:var(--space-sm)">
                  <span class="text-secondary" style="font-size:var(--font-size-xs)">${d.lastSyncAt ? 'Last sync: ' + formatDate(d.lastSyncAt) : 'Never synced'}</span>
                  ${!d.isMe ? `<button class="btn btn--ghost btn--sm unpair-device-btn" data-device-id="${escapeHtml(d.deviceId)}" data-device-name="${escapeHtml(d.deviceName)}" style="color:var(--danger);font-size:var(--font-size-xs);padding:2px 8px">✕</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="flex gap-sm" style="flex-wrap:wrap">
        <button class="btn btn--outline btn--sm" id="syncNowBtn">Sync Now</button>
        <button class="btn btn--ghost btn--sm" id="unpairBtn" style="color:var(--danger)">Unpair</button>
      </div>
    `;

    // Wire up paired-state buttons
    document.getElementById('saveDeviceNameBtn')?.addEventListener('click', async () => {
      const newName = document.getElementById('deviceNameInput').value.trim();
      if (newName) {
        await setDeviceName(newName);
        showToast('Device name saved!', 'success');
      }
    });

    document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(pairingCode).then(() => {
        showToast('Code copied!', 'success');
      }).catch(() => showToast('Failed to copy', 'error'));
    });

    // Per-device unpair buttons
    container.querySelectorAll('.unpair-device-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const deviceId = btn.dataset.deviceId;
        const deviceName = btn.dataset.deviceName;
        const confirmed = await confirmDialog(
          'Remove Device',
          `Remove "${deviceName}" from your paired devices?`,
          'Remove',
          true
        );
        if (!confirmed) return;
        try {
          const res = await fetch('/api/sync/unpair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed'); }
          showToast('Device removed!', 'success');
          renderSyncUI();
        } catch (err) {
          showToast('Remove failed: ' + err.message, 'error');
        }
      });
    });

    document.getElementById('syncNowBtn')?.addEventListener('click', async () => {
      showToast('Syncing...', '');
      await performSync();
      showToast('Sync complete!', 'success');
      renderSyncUI(); // refresh last sync time
    });

    document.getElementById('unpairBtn')?.addEventListener('click', async () => {
      const confirmed = await confirmDialog(
        'Unpair Device',
        'This will stop syncing with other devices. Your local notes will not be affected.',
        'Unpair',
        true
      );
      if (confirmed) {
        try {
          await unpairDevice();
          showToast('Unpaired!', 'success');
        } catch (err) {
          showToast('Unpair failed: ' + err.message, 'error');
        }
        renderSyncUI();
      }
    });

  } else {
    // ── Unpaired state ──
    container.innerHTML = `
      <div style="background:var(--warning-bg);padding:var(--space-md);border-radius:var(--radius-sm);margin-bottom:var(--space-md)">
        <p style="font-weight:600;color:var(--warning)">Not paired</p>
        <p class="text-secondary" style="font-size:var(--font-size-xs)">
          Pair with another device to sync your notes.
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">Device Name</label>
        <input type="text" id="deviceNameInput" class="form-input" value="${escapeHtml(deviceName)}">
      </div>

      <button class="btn btn--primary btn--block mb-md" id="generateCodeBtn">
        Generate Pairing Code
      </button>

      <div style="border-top:1px solid var(--border);padding-top:var(--space-md);margin-top:var(--space-md)">
        <label class="form-label">Pair Using a Code</label>
        <p class="text-secondary" style="font-size:var(--font-size-xs);margin-bottom:var(--space-sm)">
          Enter the code shown on another device.
        </p>
        <div class="flex gap-sm">
          <input type="text" id="pairCodeInput" class="form-input" placeholder="e.g. A3X9K2" maxlength="6" style="flex:1;text-transform:uppercase;letter-spacing:0.1em;text-align:center;font-size:1.2rem;font-weight:600" autocomplete="off">
          <button class="btn btn--primary btn--sm" id="pairBtn">Pair</button>
        </div>
        <p id="pairError" style="color:var(--danger);font-size:var(--font-size-xs);margin-top:var(--space-xs);display:none"></p>
      </div>
    `;

    // Wire up unpaired-state buttons
    document.getElementById('generateCodeBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('generateCodeBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Generating...';

      try {
        const newName = document.getElementById('deviceNameInput').value.trim();
        if (newName) await setDeviceName(newName);

        await registerDevice();
        showToast('Pairing code generated!', 'success');
        renderSyncUI();
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Generate Pairing Code';
      }
    });

    document.getElementById('pairBtn')?.addEventListener('click', async () => {
      const code = document.getElementById('pairCodeInput').value.trim();
      const errEl = document.getElementById('pairError');

      if (!code || code.length < 4) {
        errEl.textContent = 'Please enter a valid pairing code.';
        errEl.style.display = 'block';
        return;
      }

      const btn = document.getElementById('pairBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      errEl.style.display = 'none';

      try {
        const newName = document.getElementById('deviceNameInput').value.trim();
        if (newName) await setDeviceName(newName);

        await pairWithCode(code);
        showToast('Paired successfully!', 'success');
        renderSyncUI();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Pair';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Theme Switcher
// ---------------------------------------------------------------------------
const THEMES = [
  { id: 'scheme-6', name: 'Vintage Paper', colors: ['#ECE2D0','#FFFAF5','#992E2E','#99BCD7'] },
  { id: 'scheme-5', name: 'Dark Mode', colors: ['#343540','#EED0AE','#788F74','#F0F0F0'] },
  { id: 'scheme-2', name: 'Mint Fresh', colors: ['#F0F7F4','#CEE7E1','#4A9E7E','#F0686C'] },
  { id: 'scheme-3', name: 'Soft Butter', colors: ['#FDF8EC','#EFE695','#E586AA','#404040'] },
  { id: 'scheme-4', name: 'Dusty Rose', colors: ['#F5EFEC','#E3BCB5','#B98A82','#A7BEC6'] },
  { id: 'scheme-7', name: 'Sky Blue', colors: ['#D8E0DF','#F2F9FB','#5BA8C8','#A0D5EA'] },
  { id: 'scheme-8', name: 'Lavender', colors: ['#C4CFDD','#F2F5FA','#9B68D8','#71C3B0'] },
  { id: 'scheme-9', name: 'Hot Pink Teal', colors: ['#CEE6EE','#F7FCFD','#F55477','#1A4A40'] },
  { id: 'scheme-10', name: 'Raspberry', colors: ['#E02A60','#F8A8AA','#3B403A','#494D47'] },
  { id: 'scheme-11', name: 'Terra', colors: ['#EED3B3','#FDF7F2','#C24B4C','#698127'] },
  { id: 'scheme-12', name: 'Pop', colors: ['#FFFFFF','#08BAE2','#E8B800','#FFCA06'] },
  { id: 'scheme-1', name: 'Warm Peach', colors: ['#FFF5EE','#F7BE98','#E56A79','#262626'] },
];

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'scheme-1';
}

function setTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('engnotes_theme', themeId);

  // Force-update theme-color meta tag by removing and recreating it
  const oldMeta = document.querySelector('meta[name="theme-color"]');
  if (oldMeta) oldMeta.remove();

  // Read the actual background color from the newly applied CSS variable
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = bg || '#F7BE98';
    document.head.appendChild(meta);
  });
}

function renderThemePicker() {
  const grid = document.getElementById('themeGrid');
  if (!grid) return;

  const current = getCurrentTheme();

  grid.innerHTML = THEMES.map(t => `
    <div class="theme-option${t.id === current ? ' selected' : ''}" data-theme="${t.id}">
      <div class="theme-option__swatches">
        ${t.colors.map(c => `<span class="theme-option__swatch" style="background:${c}"></span>`).join('')}
      </div>
      <div class="theme-option__name">${t.name}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const themeId = opt.dataset.theme;
      setTheme(themeId);
      // Re-render to update selection
      document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      // theme switched silently
    });
  });
}

// ---------------------------------------------------------------------------
// Style Picker (Interface texture/depth)
// ---------------------------------------------------------------------------
const STYLES = [
  { id: 'original', name: 'Original', hint: 'Clean modern with grid pattern', preview: 'style-preview--original' },
  { id: 'soft-depth', name: 'Soft Depth', hint: 'Neumorphic shadows & noise texture', preview: 'style-preview--soft-depth' },
  { id: 'editorial', name: 'Editorial', hint: 'Linen paper & print typography', preview: 'style-preview--editorial' },
  { id: 'tag', name: 'Tag Aesthetic', hint: 'Cork board & physical tag cards', preview: 'style-preview--tag' },
  { id: 'glass', name: 'Frosted Glass', hint: 'Acrylic blur & translucent surfaces', preview: 'style-preview--glass' },
];

function getCurrentStyle() {
  return document.documentElement.getAttribute('data-style') || 'soft-depth';
}

function setStyle(styleId) {
  document.documentElement.setAttribute('data-style', styleId);
  localStorage.setItem('engnotes_style', styleId);
}

function renderStylePicker() {
  const grid = document.getElementById('styleGrid');
  if (!grid) return;

  const current = getCurrentStyle();

  grid.innerHTML = STYLES.map(s => `
    <div class="style-option${s.id === current ? ' selected' : ''}" data-style="${s.id}">
      <div class="style-option__preview ${s.preview}"></div>
      <div class="style-option__info">
        <div class="style-option__name">${s.name}</div>
        <div class="style-option__hint">${s.hint}</div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.style-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const styleId = opt.dataset.style;
      setStyle(styleId);
      document.querySelectorAll('#styleGrid .style-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

// ---------------------------------------------------------------------------
// Version History (git checkpoints)
// ---------------------------------------------------------------------------

async function loadCheckpoints() {
  const list = document.getElementById('checkpointList');
  const dot = document.getElementById('gitStatusDot');
  if (!list) return;

  try {
    const res = await fetch('/api/git/checkpoints');
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    const checkpoints = data.checkpoints || [];

    if (dot) {
      dot.style.background = 'var(--success)';
      dot.title = 'Backend connected';
    }

    if (!checkpoints.length) {
      list.innerHTML = '<p class="text-secondary" style="font-size:var(--font-size-sm)">No checkpoints yet.</p>';
      return;
    }

    list.innerHTML = checkpoints.map((cp, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);${i > 0 ? 'margin-top:6px' : ''}">
        <div style="min-width:0;flex:1">
          <div style="font-size:var(--font-size-sm);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(cp.message)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary)">
            <code style="font-size:0.65rem;color:var(--text-tertiary);user-select:all">${cp.hash.slice(0, 7)}</code>
            · ${cp.date ? new Date(cp.date).toLocaleString() : ''}
          </div>
        </div>
        <button class="btn btn--ghost btn--sm restore-btn" data-hash="${cp.hash}" data-msg="${escapeHtml(cp.message)}" style="color:var(--danger);flex-shrink:0;margin-left:var(--space-sm)" ${i === 0 ? 'disabled title="Already at latest"' : ''}>Restore</button>
      </div>
    `).join('');

    // Wire restore buttons
    list.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hash = btn.dataset.hash;
        const msg = btn.dataset.msg;
        const confirmed = await confirmDialog(
          'Restore Version',
          `Restore project files to "${msg}" (${hash.slice(0, 7)})? Current uncommitted changes will be lost.`,
          'Restore',
          true
        );
        if (!confirmed) return;

        try {
          const res = await fetch('/api/git/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error);
          }
          showToast('Restored! Hard refresh to see changes.', 'success');
          loadCheckpoints();
        } catch (err) {
          showToast('Restore failed: ' + err.message, 'error');
        }
      });
    });
  } catch (err) {
    if (dot) {
      dot.style.background = 'var(--danger)';
      dot.title = 'Backend unavailable';
    }
    list.innerHTML = '<p class="text-secondary" style="font-size:var(--font-size-sm);color:var(--danger)">Cannot reach server. Make sure the app is running.</p>';
  }
}

// Wire up version history buttons (called from renderSettings after DOM is ready)
function initVersionHistory() {
  // Toggle collapse
  const header = document.getElementById('versionHistoryHeader');
  const body = document.getElementById('versionHistoryBody');
  const arrow = document.getElementById('versionHistoryArrow');
  if (header && body) {
    header.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (arrow) arrow.textContent = open ? '▸' : '▾';
    });
  }

  document.getElementById('saveCheckpointBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveCheckpointBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const res = await fetch('/api/git/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Checkpoint from Settings' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error);
      }
      const data = await res.json();
      showToast('Checkpoint saved!', 'success');
      loadCheckpoints();
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Save Checkpoint';
  });

  document.getElementById('refreshCheckpointsBtn')?.addEventListener('click', loadCheckpoints);

  // Initial load
  loadCheckpoints();
}
