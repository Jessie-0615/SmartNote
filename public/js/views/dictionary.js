/* ---------------------------------------------------------------------------
   Dictionary View — #/dictionary
   Bilingual EN↔ZH lookup with pronunciation audio
   --------------------------------------------------------------------------- */

async function renderDictionary(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Dictionary</h2><p>Search English or Chinese words with pronunciation.</p></div>

    <div class="flex gap-sm mb-md" style="align-items:center">
      <div class="search-input" style="flex:1;margin-bottom:0">
        <span class="icon">🔍</span>
        <input type="text" id="dictSearch" placeholder="Search English or Chinese..." autocomplete="off">
      </div>
      <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;flex-shrink:0">
        <button class="dict-lang-btn active" data-dir="en-zh" style="padding:8px 14px;font-size:var(--font-size-sm);font-weight:600;border:none;cursor:pointer;background:var(--primary);color:#fff">EN→中</button>
        <button class="dict-lang-btn" data-dir="zh-en" style="padding:8px 14px;font-size:var(--font-size-sm);font-weight:600;border:none;cursor:pointer;background:transparent;color:var(--text-secondary)">中→EN</button>
      </div>
    </div>

    <div id="dictResult">
      <div class="empty-state">
        <div class="icon" style="font-size:2.5rem">📖</div>
        <h3>Look up any word</h3>
        <p>Type an English or Chinese word and press Enter.</p>
      </div>
    </div>
  `;

  let direction = 'en-zh';

  // Language toggle
  container.querySelectorAll('.dict-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      direction = btn.dataset.dir;
      container.querySelectorAll('.dict-lang-btn').forEach(b => {
        b.style.background = b.dataset.dir === direction ? 'var(--primary)' : 'transparent';
        b.style.color = b.dataset.dir === direction ? '#fff' : 'var(--text-secondary)';
      });
      // Re-search if there's input
      const q = document.getElementById('dictSearch').value.trim();
      if (q) doSearch(q);
    });
  });

  // Search on Enter
  document.getElementById('dictSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) doSearch(q);
    }
  });

  // Real voice pronunciation via Web Speech API (built into browser)
  function speakWord(word, lang) {
    if (!('speechSynthesis' in window)) {
      showToast('Speech not supported on this device', 'error');
      return;
    }
    speechSynthesis.cancel(); // stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    utterance.rate = 0.85;
    // Load voices (some browsers load them async)
    const voices = speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith(lang) && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith(lang))
      || voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utterance.voice = enVoice;
    speechSynthesis.speak(utterance);
  }

  // Fetch phonetic info from Free Dictionary API (text only, no audio files)
  async function fetchPhonetic(word) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) return '';
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return '';
      return data[0].phonetic || (data[0].phonetics || []).find(p => p.text)?.text || '';
    } catch { return ''; }
  }

  async function doSearch(query) {
    const resultDiv = document.getElementById('dictResult');
    resultDiv.innerHTML = '<div class="empty-state"><div class="spinner spinner--lg"></div><p style="margin-top:var(--space-md)">Looking up...</p></div>';

    // Detect long sentences/passages — use translation-only mode
    const wordCount = query.trim().split(/\s+/).length;
    const isPassage = wordCount >= 5 || /[.!?]/.test(query);

    try {
      const body = { word: query, direction };
      if (isPassage) body.mode = 'translate';

      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Lookup failed');
      }
      const data = await res.json();

      if (data.mode === 'translate') {
        renderTranslation(data);
        return;
      }

      // Fetch phonetic text (not audio — we use real voice for that)
      let phonetic = data.phonetic || '';
      if (!phonetic && (direction === 'en-zh' || data.word.match(/[a-zA-Z]/))) {
        const enWord = direction === 'en-zh' ? data.word : (data.englishTranslation || '').split(' ')[0];
        if (enWord) phonetic = await fetchPhonetic(enWord) || '';
      }

      renderResult(data, phonetic);
    } catch (err) {
      resultDiv.innerHTML = `<div class="empty-state"><h3>Lookup failed</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderResult(data, phonetic) {
    const resultDiv = document.getElementById('dictResult');
    const isEn = direction === 'en-zh';
    const translation = isEn ? data.chineseTranslation : data.englishTranslation;
    const spokenWord = isEn ? data.word : (data.englishTranslation || data.word);

    const escapedWord = escapeHtml(data.word);
    const escapedTranslation = escapeHtml(translation || '');
    resultDiv.innerHTML = `
      <div class="card" style="border-left:4px solid var(--primary)">
        <div class="flex-between mb-md" style="flex-wrap:wrap;gap:var(--space-sm)">
          <div>
            <h2 style="font-family:var(--font-display);font-size:1.6rem;margin:0">${escapedWord}</h2>
            ${phonetic ? `<div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:4px">${escapeHtml(phonetic)}</div>` : ''}
            ${data.pos ? `<span class="badge" style="margin-top:6px">${escapeHtml(data.pos)}</span>` : ''}
          </div>
          <div style="display:flex;gap:var(--space-sm);flex-shrink:0;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" id="addToNotesBtn" style="font-size:var(--font-size-xs)">+ Add to Notes</button>
          </div>
        </div>

        ${translation ? `
          <div style="background:var(--primary-bg);padding:var(--space-md);border-radius:var(--radius-sm);margin-bottom:var(--space-md)">
            <span style="font-size:var(--font-size-xs);font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.05em">${isEn ? '中文翻译' : 'English Translation'}</span>
            <p style="font-size:var(--font-size-lg);font-weight:600;margin-top:var(--space-xs)">${escapeHtml(translation)}</p>
          </div>
        ` : ''}

        ${data.definition ? `
          <div class="mb-md">
            <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text);margin-bottom:var(--space-xs)">释义 · Definition</div>
            <p style="line-height:1.7">${escapeHtml(data.definition)}</p>
          </div>
        ` : ''}

        ${data.definitionEn ? `
          <div class="mb-md">
            <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text);margin-bottom:var(--space-xs)">English Definition</div>
            <p style="color:var(--text-secondary)">${escapeHtml(data.definitionEn)}</p>
          </div>
        ` : ''}

        ${data.examples && data.examples.length ? `
          <div class="mb-md">
            <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text);margin-bottom:var(--space-xs)">例句 · Examples</div>
            <ul style="list-style:none;padding:0">
              ${data.examples.map(ex => `
                <li style="margin-bottom:var(--space-sm);padding:var(--space-sm) var(--space-md);background:var(--card-bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
                  <div style="font-weight:600">${escapeHtml(ex.en)}</div>
                  ${ex.zh ? `<div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:2px">${escapeHtml(ex.zh)}</div>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${data.related && data.related.length ? `
          <div>
            <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text);margin-bottom:var(--space-sm)">相关词汇 · Related</div>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm)">
              ${data.related.map(r => {
                const text = typeof r === 'string' ? r : (r.en || r.zh || '');
                return `<span class="badge" style="background:var(--primary-bg);color:var(--primary);cursor:pointer" onclick="document.getElementById('dictSearch').value='${escapeHtml(text.split(' ')[0].split('(')[0].trim())}';document.getElementById('dictSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))">${escapeHtml(text)}</span>`;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Wire up Add to Notes button
    document.getElementById('addToNotesBtn')?.addEventListener('click', async () => {
      const note = createNoteWithSM2({
        id: uuid(),
        content: data.word,
        userMemo: translation ? (isEn ? `中文: ${translation}` : `English: ${translation}`) : null,
        category: null,
        aiExpanded: false,
      });
      // Try AI categorization
      try {
        const category = await aiCategorize(note.content);
        note.category = category;
        note.aiCategorizedAt = Date.now();
      } catch (_) { /* will be uncategorized */ }
      await saveNote(note);
      showToast(`"${data.word}" added to notes!`, 'success');
      const btn = document.getElementById('addToNotesBtn');
      if (btn) { btn.textContent = '✓ Added'; btn.disabled = true; }
    });

    // Make related words clickable
    resultDiv.querySelectorAll('.badge[style*="cursor:pointer"]').forEach(badge => {
      badge.addEventListener('click', () => {
        const word = badge.textContent.split(' ')[0].split('(')[0].trim();
        document.getElementById('dictSearch').value = word;
        doSearch(word);
      });
    });
  }

  function renderTranslation(data) {
    const resultDiv = document.getElementById('dictResult');
    const isEn = direction === 'en-zh';
    const escapedWord = escapeHtml(data.word);
    const escapedTranslation = escapeHtml(data.translation || '');

    resultDiv.innerHTML = `
      <div class="card" style="border-left:4px solid var(--primary)">
        <div class="flex-between mb-md" style="flex-wrap:wrap;gap:var(--space-sm)">
          <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em">${isEn ? '原文 · Source' : '原文 · Source'}</div>
          <button class="btn btn--primary btn--sm" id="addToNotesBtn" style="font-size:var(--font-size-xs)">+ Add to Notes</button>
        </div>
        <div style="background:var(--bg);padding:var(--space-md);border-radius:var(--radius-sm);margin-bottom:var(--space-md);line-height:1.7;font-size:var(--font-size-md)">
          ${escapedWord}
        </div>
        <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:var(--space-xs);text-transform:uppercase;letter-spacing:0.05em">${isEn ? '中文翻译 · Translation' : 'English Translation'}</div>
        <div style="background:var(--primary-bg);padding:var(--space-md);border-radius:var(--radius-sm);line-height:1.7;font-size:var(--font-size-lg);font-weight:600">
          ${escapedTranslation}
        </div>
      </div>
    `;

    // Wire up Add to Notes button
    document.getElementById('addToNotesBtn')?.addEventListener('click', async () => {
      const note = createNoteWithSM2({
        id: uuid(),
        content: data.word,
        userMemo: isEn ? `中文: ${data.translation}` : `English: ${data.translation}`,
        category: null,
        aiExpanded: false,
      });
      try {
        const category = await aiCategorize(note.content);
        note.category = category;
        note.aiCategorizedAt = Date.now();
      } catch (_) { /* will be uncategorized */ }
      await saveNote(note);
      showToast('Translation added to notes!', 'success');
      const btn = document.getElementById('addToNotesBtn');
      if (btn) { btn.textContent = '✓ Added'; btn.disabled = true; }
    });
  }
}

