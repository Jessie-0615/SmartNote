/* ---------------------------------------------------------------------------
   Note Detail View — #/note/:id
   --------------------------------------------------------------------------- */

async function renderNoteDetail(noteId) {
  const container = document.getElementById('mainContent');

  // Loading state
  container.innerHTML = `
    <div class="empty-state">
      <div class="spinner spinner--lg"></div>
      <p style="margin-top:var(--space-md)">Loading note...</p>
    </div>
  `;

  const note = await getNote(noteId);
  if (!note) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">Search</div>
        <h3>Note not found</h3>
        <p>This note may have been deleted.</p>
        <button class="btn btn--primary mt-md" onclick="location.hash='#/browse'">Back to Browse</button>
      </div>
    `;
    return;
  }

  const info = categoryInfo(note.category || '');

  // Review progress dots (0-6, from consecutiveCorrect)
  function reviewDots(cc) {
    const total = 6; const filled = Math.min(cc || 0, total);
    let d = '<span style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-right:6px">Review</span>';
    for (let i = 0; i < total; i++) {
      d += `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:3px;background:${i < filled ? 'var(--primary)' : 'var(--border)'};transition:background 0.3s"></span>`;
    }
    return d;
  }

  // Build expansion HTML
  let expansionHtml = '';
  if (note.aiExpanded) {
    // Generate morphological variant pattern for a single English word
    const morphVariants = (word) => {
      const w = word.toLowerCase();
      const patterns = [w];
      // Common suffixes
      patterns.push(w + 's', w + 'es', w + 'ed', w + 'ing', w + 'er', w + 'est');
      // Dropped-e forms (make → making, made; love → loved, loving)
      if (w.endsWith('e') && w.length > 2) {
        const stem = w.slice(0, -1);
        patterns.push(stem + 's', stem + 'es', stem + 'ed', stem + 'ing', stem + 'er');
      }
      // Double final consonant (run → running, stop → stopped)
      if (w.length >= 3 && /[aeiou][^aeiouwxy]$/.test(w)) {
        const dbl = w + w[w.length - 1];
        patterns.push(dbl + 'ed', dbl + 'ing', dbl + 'er');
      }
      // Y → I (carry → carries, carried)
      if (w.endsWith('y') && w.length > 2 && !/[aeiou]y$/.test(w)) {
        const stem = w.slice(0, -1);
        patterns.push(stem + 'ies', stem + 'ied', stem + 'ier');
      }
      // Common irregular verbs
      const IRREGULAR = {
        'be': ['am','is','are','was','were','been','being'],
        'have': ['has','had','having'],
        'do': ['does','did','done','doing'],
        'go': ['goes','went','gone','going'],
        'make': ['makes','made','making'],
        'take': ['takes','took','taken','taking'],
        'get': ['gets','got','gotten','getting'],
        'say': ['says','said','saying'],
        'see': ['sees','saw','seen','seeing'],
        'know': ['knows','knew','known','knowing'],
        'think': ['thinks','thought','thinking'],
        'come': ['comes','came','coming'],
        'give': ['gives','gave','given','giving'],
        'find': ['finds','found','finding'],
        'tell': ['tells','told','telling'],
        'feel': ['feels','felt','feeling'],
        'leave': ['leaves','left','leaving'],
        'keep': ['keeps','kept','keeping'],
        'begin': ['begins','began','begun','beginning'],
        'write': ['writes','wrote','written','writing'],
        'run': ['runs','ran','running'],
        'swim': ['swims','swam','swum','swimming'],
        'sit': ['sits','sat','sitting'],
        'speak': ['speaks','spoke','spoken','speaking'],
        'break': ['breaks','broke','broken','breaking'],
        'eat': ['eats','ate','eaten','eating'],
        'drink': ['drinks','drank','drunk','drinking'],
        'sing': ['sings','sang','sung','singing'],
        'buy': ['buys','bought','buying'],
        'bring': ['brings','brought','bringing'],
        'catch': ['catches','caught','catching'],
        'teach': ['teaches','taught','teaching'],
        'build': ['builds','built','building'],
        'send': ['sends','sent','sending'],
        'spend': ['spends','spent','spending'],
        'lose': ['loses','lost','losing'],
        'choose': ['chooses','chose','chosen','choosing'],
        'fall': ['falls','fell','fallen','falling'],
        'fly': ['flies','flew','flown','flying'],
        'grow': ['grows','grew','grown','growing'],
        'draw': ['draws','drew','drawn','drawing'],
        'show': ['shows','showed','shown','showing'],
        'wear': ['wears','wore','worn','wearing'],
        'put': ['puts','putting'],
        'let': ['lets','letting'],
        'set': ['sets','setting'],
        'cut': ['cuts','cutting'],
        'hit': ['hits','hitting'],
        'win': ['wins','won','winning'],
      };
      if (IRREGULAR[w]) patterns.push(...IRREGULAR[w]);
      // Deduplicate and return as regex alternation
      const unique = [...new Set(patterns)];
      return unique.sort((a,b) => b.length - a.length).join('|');
    };

    // Highlight the original note text with morphological variant matching
    const highlightNote = (text) => {
      if (!text || !note.content || !note.content.trim()) return escapeHtml(text);
      const escaped = escapeHtml(text);
      const noteWords = note.content.trim().split(/\s+/).filter(w => w.length > 0);

      // Build per-word variant patterns
      const wordPatterns = noteWords.map(w => morphVariants(w));

      // Pass 1: try to match the full phrase (words in order, allowing variants, up to 3 filler words between)
      const phrasePattern = wordPatterns.map(p => `\\b(?:${p})\\b`).join('(?:\\s+\\w+){0,3}\\s+');
      const phraseRegex = new RegExp(`(${phrasePattern})`, 'gi');
      let result = escaped.replace(phraseRegex, '<span style="font-weight:700;color:var(--primary)">$1</span>');
      if (result !== escaped) return result; // Phrase match found — highlight and return

      // Pass 2: no full phrase match — highlight each note word independently
      const anyWordPattern = wordPatterns.map(p => `\\b(?:${p})\\b`).join('|');
      const anyRegex = new RegExp(`(${anyWordPattern})`, 'gi');
      result = escaped.replace(anyRegex, '<span style="font-weight:700;color:var(--primary)">$1</span>');
      return result;
    };

    // Helper: render example items (supports both string and {en, zh} formats)
    const renderExample = (ex) => {
      if (typeof ex === 'string') return `<li style="margin-bottom:var(--space-sm)">${highlightNote(ex)}</li>`;
      return `<li style="margin-bottom:var(--space-sm)">
        <div>${highlightNote(ex.en)}</div>
        ${ex.zh ? `<div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:2px">${escapeHtml(ex.zh)}</div>` : ''}
      </li>`;
    };

    // Helper: render related expression items
    const renderRelated = (r) => {
      if (typeof r === 'string') return `<span class="badge" style="background:var(--primary-bg);color:var(--primary)">${escapeHtml(r)}</span>`;
      return `<span class="badge" style="background:var(--primary-bg);color:var(--primary)">${escapeHtml(r.en)}${r.zh ? ' · ' + escapeHtml(r.zh) : ''}</span>`;
    };

    expansionHtml = `
      <div class="card mt-md" style="border-left:4px solid var(--primary)">
        <h3 style="margin-bottom:var(--space-md);display:flex;align-items:center;justify-content:space-between">
          AI Expansion <span style="font-size:1.1rem">✦</span>
        </h3>

        ${note.aiChineseTranslation ? `
          <div style="background:var(--primary-bg);padding:var(--space-md);border-radius:var(--radius-sm);margin-bottom:var(--space-md)">
            <span style="font-size:var(--font-size-xs);font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.05em">中文翻译</span>
            <p style="font-size:var(--font-size-lg);font-weight:600;margin-top:var(--space-xs)">${escapeHtml(note.aiChineseTranslation)}</p>
          </div>
        ` : ''}

        ${note.aiDefinition ? `
          <div class="expand-section">
            <div class="expand-section__header">中文释义 · Definition (CN) <span class="expand-arrow">▸</span></div>
            <div class="expand-section__body"><p style="font-size:var(--font-size-md);line-height:1.8">${escapeHtml(note.aiDefinition)}</p></div>
          </div>
        ` : ''}

        ${note.aiDefinitionEn ? `
          <div class="expand-section open">
            <div class="expand-section__header">English Definition <span class="expand-arrow">▾</span></div>
            <div class="expand-section__body"><p style="color:var(--text-secondary)">${escapeHtml(note.aiDefinitionEn)}</p></div>
          </div>
        ` : ''}

        ${note.aiExamples && note.aiExamples.length ? `
          <div class="expand-section open">
            <div class="expand-section__header">例句 · Example Sentences <span class="expand-arrow">▾</span></div>
            <div class="expand-section__body">
              <ul style="list-style:none;padding-left:0">
                ${note.aiExamples.map(renderExample).join('')}
              </ul>
            </div>
          </div>
        ` : ''}

        ${note.aiEtymology ? `
          <div class="expand-section">
            <div class="expand-section__header">词源 · Etymology <span class="expand-arrow">▸</span></div>
            <div class="expand-section__body"><p>${escapeHtml(note.aiEtymology)}</p></div>
          </div>
        ` : ''}

        ${note.aiRelatedExpressions && note.aiRelatedExpressions.length ? `
          <div class="expand-section open">
            <div class="expand-section__header">相关表达 · Related Expressions <span class="expand-arrow">▾</span></div>
            <div class="expand-section__body">
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm)">
                ${note.aiRelatedExpressions.map(renderRelated).join('')}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <button class="btn btn--ghost mb-md" onclick="location.hash='#/browse'">← Back to Browse</button>

    <div class="card" style="position:relative">
      <button id="favStarBtn" style="position:absolute;top:var(--space-md);right:var(--space-md);background:none;border:none;font-size:1.8rem;cursor:pointer;padding:4px;line-height:1;color:${note.favorited?'var(--warning)':'var(--text-tertiary)'};transition:color 0.2s" title="${note.favorited?'Unfavorite':'Favorite'}">${note.favorited?'★':'☆'}</button>

      <div class="flex-between mb-md" style="padding-right:40px">
        <div style="display:flex;align-items:center;gap:var(--space-sm)">
          <span class="badge ${note.category ? 'badge--' + note.category : ''}" style="${!note.category ? 'background:#eee;color:#999' : ''}" id="catBadge">
            ${note.category ? info.label : 'Uncategorized'}
          </span>
          <button class="btn btn--ghost btn--sm" id="editMetaBtn" style="font-size:var(--font-size-xs)">Edit</button>
        </div>
        <span>${reviewDots(note.consecutiveCorrect)}</span>
      </div>

      <h2 style="font-size:var(--font-size-xl);margin-bottom:var(--space-md)">${escapeHtml(note.content)}</h2>

      ${note.userMemo ? `
        <div class="memo-box" id="memoBox">
          <p id="memoText">${escapeHtml(note.userMemo)}</p>
        </div>
      ` : `
        <div id="memoBox" style="display:none"></div>
      `}

      <div id="inlineEditArea" style="display:none"></div>
    </div>

    ${!note.aiExpanded ? `
      <div class="card mt-md text-center">
        <p class="text-secondary mb-md">获取中文释义、双语例句、词源和相关表达</p>
        <button class="btn btn--primary" id="expandBtn">
          Search AI 扩展 · Expand
        </button>
        <p style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:var(--space-sm)">
          AI将生成中文翻译、双语释义和例句，帮助理解和记忆。
        </p>
      </div>
    ` : ''}

    ${expansionHtml}

    <div class="flex gap-sm mt-lg">
      <button class="btn btn--outline" id="startReviewBtn">Review This</button>
      <button class="btn btn--ghost" id="deleteNoteBtn" style="color:var(--danger)">Delete</button>
    </div>

    <div id="expandFeedback" class="mt-md"></div>
  `;

  // Star toggle
  const favBtn = document.getElementById('favStarBtn');
  if (favBtn) {
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const updated = await updateNote(note.id, { favorited: !note.favorited });
      showToast(updated.favorited ? 'Favorited!' : 'Unfavorited', 'success');
      renderNoteDetail(noteId);
    });
  }

  // Inline edit button
  const editBtn = document.getElementById('editMetaBtn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const area = document.getElementById('inlineEditArea');
      const categories = ['word','phrase','sentence_pattern','idiom','common_usage'];
      const catLabels = { word:'Word', phrase:'Phrase', sentence_pattern:'Sentence Pattern', idiom:'Idiom', common_usage:'Common Usage' };
      area.innerHTML = `
        <div class="card mt-md" style="border:2px solid var(--primary)">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="editCategory" class="form-input">
              <option value="">Uncategorized</option>
              ${categories.map(c=>`<option value="${c}" ${note.category===c?'selected':''}>${catLabels[c]}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Your Note / Memo</label>
            <textarea id="editMemo" class="form-textarea" rows="3">${escapeHtml(note.userMemo||'')}</textarea>
          </div>
          <div class="flex gap-sm">
            <button class="btn btn--primary btn--sm" id="saveMetaBtn">Save</button>
            <button class="btn btn--ghost btn--sm" id="cancelMetaBtn">Cancel</button>
          </div>
        </div>
      `;
      area.style.display = 'block';
      document.getElementById('saveMetaBtn').addEventListener('click', async () => {
        const newCat = document.getElementById('editCategory').value || null;
        const newMemo = document.getElementById('editMemo').value.trim() || null;
        await updateNote(note.id, { category: newCat, userMemo: newMemo });
        showToast('Updated!', 'success');
        renderNoteDetail(noteId);
      });
      document.getElementById('cancelMetaBtn').addEventListener('click', () => {
        area.style.display = 'none';
      });
    });
  }

  // Expand button handler
  const expandBtn = document.getElementById('expandBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', async () => {
      expandBtn.disabled = true;
      expandBtn.innerHTML = '<span class="spinner"></span> Expanding...';

      try {
        const result = await aiExpand(note.content, note.category || 'common_usage');
        await updateNote(note.id, {
          aiExpanded: true,
          aiExpandedAt: Date.now(),
          aiChineseTranslation: result.chineseTranslation || null,
          aiDefinition: result.definition || null,
          aiDefinitionEn: result.definitionEn || null,
          aiExamples: result.examples || [],
          aiEtymology: result.etymology || null,
          aiRelatedExpressions: result.relatedExpressions || [],
        });
        showToast('Expansion complete!', 'success');
        // Re-render
        renderNoteDetail(noteId);
      } catch (err) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = 'Search Expand with AI';
        showToast('Expansion failed: ' + err.message, 'error');
      }
    });
  }

  // Expandable section toggles — flip arrow icon
  container.querySelectorAll('.expand-section__header').forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      section.classList.toggle('open');
      const arrow = header.querySelector('.expand-arrow');
      if (arrow) {
        arrow.textContent = section.classList.contains('open') ? '▾' : '▸';
      }
    });
  });

  // Start review button
  const startReviewBtn = document.getElementById('startReviewBtn');
  if (startReviewBtn) {
    startReviewBtn.addEventListener('click', () => {
      location.hash = '#/review';
    });
  }

  // Delete button
  const deleteBtn = document.getElementById('deleteNoteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await confirmDialog(
        'Delete Note',
        `Delete "${note.content}"? This cannot be undone.`,
        'Delete',
        true
      );
      if (confirmed) {
        await deleteNote(note.id);
        showToast('Note deleted', 'success');
        location.hash = '#/browse';
      }
    });
  }
}
