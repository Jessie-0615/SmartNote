/* ---------------------------------------------------------------------------
   Note Editor View — #/add
   --------------------------------------------------------------------------- */

function renderNoteEditor(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Add a Note</h2>
      <p>Enter any vocabulary, phrase, usage, paragraph, or anything else you want to accumulate.</p>
    </div>

    <form id="noteForm" class="card">
      <div class="form-group">
        <label class="form-label" for="noteContent">
          English Entry <span style="color:var(--color-danger)">*</span>
        </label>
        <textarea
          id="noteContent"
          class="form-textarea form-input--lg"
          placeholder="Type a word, phrase, sentence, idiom, or usage pattern..."
          rows="3"
          required
          autofocus
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" for="noteMemo">
          Your Personal Note
        </label>
        <textarea
          id="noteMemo"
          class="form-textarea"
          placeholder="Anything else you think is worth noting down..."
          rows="2"
        ></textarea>
      </div>

      <button type="submit" class="btn btn--primary btn--lg btn--block" id="submitBtn">
        Save & Categorize
      </button>
      <p class="text-secondary text-center" style="margin-top:var(--space-sm);font-size:var(--font-size-xs)">
        AI will automatically classify your entry after saving.
      </p>
    </form>

    <div id="saveFeedback" style="margin-top:var(--space-md)"></div>
  `;

  // Form submit handler
  document.getElementById('noteForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = document.getElementById('noteContent').value.trim();
    const userMemo = document.getElementById('noteMemo').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const feedback = document.getElementById('saveFeedback');

    if (!content) {
      showToast('Please enter some content', 'error');
      return;
    }

    // Disable button, show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Categorizing...';
    feedback.innerHTML = '';

    // Create note
    const note = createNoteWithSM2({
      id: uuid(),
      content,
      userMemo: userMemo || null,
      category: null,
      aiExpanded: false,
      aiDefinition: null,
      aiExamples: [],
      aiEtymology: null,
      aiRelatedExpressions: [],
      aiCategorizedAt: null,
      aiExpandedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Save to IndexedDB immediately (offline-first)
    try {
      await saveNote(note);
    } catch (dbErr) {
      console.error('Save error:', dbErr);
      showToast('Failed to save note locally', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Save & Categorize';
      return;
    }

    // Try AI categorization
    try {
      const category = await aiCategorize(content);
      note.category = category;
      note.aiCategorizedAt = Date.now();
      await updateNote(note.id, {
        category,
        aiCategorizedAt: note.aiCategorizedAt,
      });

      const info = categoryInfo(category);
      feedback.innerHTML = `
        <div class="card" style="border-left:4px solid var(--color-success)">
          <div class="flex-between">
            <span style="font-weight:600">Saved!</span>
            <span class="badge badge--${category}">${info.label}</span>
          </div>
          <p class="text-secondary" style="font-size:var(--font-size-sm);margin-top:var(--space-xs)">
            AI categorized this as <strong>${info.label}</strong>
          </p>
        </div>
      `;
    } catch (aiErr) {
      // AI failed, note is saved without category
      console.warn('AI categorization failed:', aiErr.message);
      feedback.innerHTML = `
        <div class="card" style="border-left:4px solid var(--color-warning)">
          <p style="font-weight:600">Saved without categorization</p>
          <p class="text-secondary" style="font-size:var(--font-size-sm);margin-top:var(--space-xs)">
            ${aiErr.message}. You can categorize it later from Settings or Browse.
          </p>
        </div>
      `;
    }

    // Reset form
    document.getElementById('noteContent').value = '';
    document.getElementById('noteMemo').value = '';
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save & Categorize';
    document.getElementById('noteContent').focus();

    showToast('Note saved!', 'success');
  });
}
