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
  const reviewText = relativeTime(note.nextReviewAt);

  // Build expansion HTML
  let expansionHtml = '';
  if (note.aiExpanded) {
    // Helper: render example items (supports both string and {en, zh} formats)
    const renderExample = (ex) => {
      if (typeof ex === 'string') return `<li style="margin-bottom:var(--space-sm);font-style:italic">${escapeHtml(ex)}</li>`;
      return `<li style="margin-bottom:var(--space-sm)">
        <div style="font-style:italic;color:var(--color-text)">${escapeHtml(ex.en)}</div>
        ${ex.zh ? `<div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-top:2px">${escapeHtml(ex.zh)}</div>` : ''}
      </li>`;
    };

    // Helper: render related expression items
    const renderRelated = (r) => {
      if (typeof r === 'string') return `<span class="badge" style="background:var(--color-primary-bg);color:var(--color-primary)">${escapeHtml(r)}</span>`;
      return `<span class="badge" style="background:var(--color-primary-bg);color:var(--color-primary)">${escapeHtml(r.en)}${r.zh ? ' · ' + escapeHtml(r.zh) : ''}</span>`;
    };

    expansionHtml = `
      <div class="card mt-md" style="border-left:4px solid var(--color-primary)">
        <h3 style="margin-bottom:var(--space-md)">AI 扩展 · Expansion</h3>

        ${note.aiChineseTranslation ? `
          <div style="background:var(--color-primary-bg);padding:var(--space-md);border-radius:var(--radius-sm);margin-bottom:var(--space-md)">
            <span style="font-size:var(--font-size-xs);font-weight:700;color:var(--color-primary)">中文翻译</span>
            <p style="font-size:var(--font-size-lg);font-weight:600;margin-top:var(--space-xs)">${escapeHtml(note.aiChineseTranslation)}</p>
          </div>
        ` : ''}

        ${note.aiDefinition ? `
          <div class="expand-section open">
            <div class="expand-section__header">中文释义 · Definition (CN)</div>
            <div class="expand-section__body"><p style="font-size:var(--font-size-md);line-height:1.8">${escapeHtml(note.aiDefinition)}</p></div>
          </div>
        ` : ''}

        ${note.aiDefinitionEn ? `
          <div class="expand-section">
            <div class="expand-section__header">English Definition</div>
            <div class="expand-section__body"><p style="color:var(--color-text-secondary)">${escapeHtml(note.aiDefinitionEn)}</p></div>
          </div>
        ` : ''}

        ${note.aiExamples && note.aiExamples.length ? `
          <div class="expand-section open">
            <div class="expand-section__header">例句 · Example Sentences</div>
            <div class="expand-section__body">
              <ul style="list-style:none;padding-left:0">
                ${note.aiExamples.map(renderExample).join('')}
              </ul>
            </div>
          </div>
        ` : ''}

        ${note.aiEtymology ? `
          <div class="expand-section">
            <div class="expand-section__header">词源 · Etymology</div>
            <div class="expand-section__body"><p>${escapeHtml(note.aiEtymology)}</p></div>
          </div>
        ` : ''}

        ${note.aiRelatedExpressions && note.aiRelatedExpressions.length ? `
          <div class="expand-section open">
            <div class="expand-section__header">相关表达 · Related Expressions</div>
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
        <span style="font-size:var(--font-size-sm);color:var(--color-text-tertiary)">
          Review: ${reviewText}
        </span>
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

      <div class="flex gap-sm mt-md" style="font-size:var(--font-size-xs);color:var(--color-text-tertiary)">
        <span>Created: ${formatDate(note.createdAt)}</span>
        ${note.repetitions > 0 ? `<span>· Reviewed ${note.repetitions}x</span>` : '<span>· Not yet reviewed</span>'}
        <span>· Mastery: ${masteryLevel(note)}</span>
      </div>
    </div>

    ${!note.aiExpanded ? `
      <div class="card mt-md text-center">
        <p class="text-secondary mb-md">获取中文释义、双语例句、词源和相关表达</p>
        <button class="btn btn--primary" id="expandBtn">
          Search AI 扩展 · Expand
        </button>
        <p style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:var(--space-sm)">
          AI将生成中文翻译、双语释义和例句，帮助理解和记忆。
        </p>
      </div>
    ` : ''}

    ${expansionHtml}

    <div class="flex gap-sm mt-lg">
      <button class="btn btn--outline" id="startReviewBtn">Review This</button>
      <button class="btn btn--ghost" id="deleteNoteBtn" style="color:var(--color-danger)">Delete</button>
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

  // Expandable section toggles
  container.querySelectorAll('.expand-section__header').forEach((header) => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
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
