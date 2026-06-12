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

  // Load audio for a word from Free Dictionary API (client-side, no key needed)
  async function fetchAudio(word) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) return { phonetic: '', audioUK: '', audioUS: '' };
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return { phonetic: '', audioUK: '', audioUS: '' };
      const allPhonetics = [];
      for (const p of (data[0].phonetics || [])) {
        allPhonetics.push({ text: p.text || '', audio: p.audio || '' });
      }
      return {
        phonetic: allPhonetics.find(p => p.text)?.text || data[0].phonetic || '',
        audioUK: allPhonetics.find(p => p.audio && p.audio.includes('-uk'))?.audio || '',
        audioUS: allPhonetics.find(p => p.audio && p.audio.includes('-us'))?.audio || '',
        audioAny: allPhonetics.find(p => p.audio)?.audio || '',
      };
    } catch { return { phonetic: '', audioUK: '', audioUS: '' }; }
  }

  async function doSearch(query) {
    const resultDiv = document.getElementById('dictResult');
    resultDiv.innerHTML = '<div class="empty-state"><div class="spinner spinner--lg"></div><p style="margin-top:var(--space-md)">Looking up...</p></div>';

    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: query, direction }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Lookup failed');
      }
      const data = await res.json();

      // Try to get audio for English words
      let audioInfo = { phonetic: data.phonetic || '', audioUK: '', audioUS: '' };
      if (direction === 'en-zh' || data.word.match(/[a-zA-Z]/)) {
        const enWord = direction === 'en-zh' ? data.word : (data.englishTranslation || '').split(' ')[0];
        if (enWord) {
          const fetched = await fetchAudio(enWord);
          audioInfo.phonetic = fetched.phonetic || data.phonetic || '';
          audioInfo.audioUK = fetched.audioUK || '';
          audioInfo.audioUS = fetched.audioUS || '';
          audioInfo.audioAny = fetched.audioAny || '';
        }
      }

      renderResult(data, audioInfo);
    } catch (err) {
      resultDiv.innerHTML = `<div class="empty-state"><h3>Lookup failed</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderResult(data, audio) {
    const resultDiv = document.getElementById('dictResult');
    const isEn = direction === 'en-zh';
    const translation = isEn ? data.chineseTranslation : data.englishTranslation;

    const audioBtns = [];
    if (audio.audioUK) audioBtns.push(`<button class="word-popup__audio-btn" onclick="new Audio('${audio.audioUK}').play()">▶ UK</button>`);
    if (audio.audioUS) audioBtns.push(`<button class="word-popup__audio-btn" onclick="new Audio('${audio.audioUS}').play()">▶ US</button>`);
    if (!audioBtns.length && audio.audioAny) audioBtns.push(`<button class="word-popup__audio-btn" onclick="new Audio('${audio.audioAny}').play()">▶ Listen</button>`);

    resultDiv.innerHTML = `
      <div class="card" style="border-left:4px solid var(--primary)">
        <div class="flex-between mb-md">
          <div>
            <h2 style="font-family:var(--font-display);font-size:1.6rem;margin:0">${escapeHtml(data.word)}</h2>
            ${audio.phonetic ? `<div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:4px">${escapeHtml(audio.phonetic)}</div>` : ''}
            ${data.pos ? `<span class="badge" style="margin-top:6px">${escapeHtml(data.pos)}</span>` : ''}
          </div>
          ${audioBtns.length ? `<div style="display:flex;gap:var(--space-sm);flex-shrink:0">${audioBtns.join('')}</div>` : ''}
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

    // Make related words clickable
    resultDiv.querySelectorAll('.badge[style*="cursor:pointer"]').forEach(badge => {
      badge.addEventListener('click', () => {
        const word = badge.textContent.split(' ')[0].split('(')[0].trim();
        document.getElementById('dictSearch').value = word;
        doSearch(word);
      });
    });
  }
}
