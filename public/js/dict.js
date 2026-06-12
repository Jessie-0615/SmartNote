/* ---------------------------------------------------------------------------
   Dictionary Lookup — Free Dictionary API
   https://dictionaryapi.dev/
   --------------------------------------------------------------------------- */

const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

/**
 * Look up a word and return phonetics + audio + definition
 */
async function lookupWord(word) {
  if (!word || word.length < 2) return null;
  try {
    const res = await fetch(DICT_API + encodeURIComponent(word.trim()));
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;

    const entry = data[0];
    // Collect all phonetics across entries
    const phonetics = [];
    if (entry.phonetics) {
      for (const p of entry.phonetics) {
        phonetics.push({ text: p.text || '', audio: p.audio || '' });
      }
    }
    // Also check meanings for phonetics
    if (entry.phonetic && !phonetics.find(p => p.text)) {
      phonetics.unshift({ text: entry.phonetic, audio: '' });
    }

    // Collect definitions
    const definitions = [];
    if (entry.meanings) {
      for (const m of entry.meanings.slice(0, 3)) {
        for (const d of (m.definitions || []).slice(0, 2)) {
          definitions.push({
            pos: m.partOfSpeech || '',
            def: d.definition || '',
            example: d.example || '',
          });
        }
      }
    }

    return {
      word: entry.word || word,
      phonetic: phonetics.find(p => p.text)?.text || '',
      audioUK: phonetics.find(p => p.audio && p.audio.includes('-uk'))?.audio || '',
      audioUS: phonetics.find(p => p.audio && p.audio.includes('-us'))?.audio || '',
      audioAny: phonetics.find(p => p.audio)?.audio || '',
      definitions: definitions.slice(0, 5),
    };
  } catch {
    return null;
  }
}

/**
 * Show a word popup near the tapped element
 */
function showWordPopup(word, data, targetEl) {
  // Remove any existing popup
  closeWordPopup();

  if (!data) {
    showToast(`No definition found for "${word}"`, 'error');
    return;
  }

  const popup = document.createElement('div');
  popup.id = 'wordPopup';
  popup.className = 'word-popup';

  const escapedW = escapeHtml(data.word).replace(/'/g, "\\'");

  popup.innerHTML = `
    <button class="word-popup__close" onclick="closeWordPopup()">✕</button>
    <div class="word-popup__word">${escapeHtml(data.word)}</div>
    ${data.phonetic ? `<div class="word-popup__phonetic">${escapeHtml(data.phonetic)}</div>` : ''}
    <div class="word-popup__audio">
      <button class="word-popup__audio-btn" onclick="event.stopPropagation();speakDictWord('${escapedW}','en-US')">🇺🇸 Listen</button>
      <button class="word-popup__audio-btn" onclick="event.stopPropagation();speakDictWord('${escapedW}','en-GB')">🇬🇧 Listen</button>
    </div>
    ${data.definitions.length ? `
      <div class="word-popup__defs">
        ${data.definitions.map(d => `
          <div class="word-popup__def">
            ${d.pos ? `<span class="word-popup__pos">${escapeHtml(d.pos)}</span>` : ''}
            <span>${escapeHtml(d.def)}</span>
            ${d.example ? `<div class="word-popup__example">"${escapeHtml(d.example)}"</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  document.body.appendChild(popup);

  // Position near the target element
  const rect = targetEl.getBoundingClientRect();
  const popupW = 320;
  let left = rect.left + (rect.width / 2) - (popupW / 2);
  let top = rect.bottom + 8;
  if (left < 12) left = 12;
  if (left + popupW > window.innerWidth - 12) left = window.innerWidth - popupW - 12;
  if (top + 300 > window.innerHeight) top = rect.top - 310;
  if (top < 12) top = 12;

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeWordPopupOnOutside);
  }, 100);
}

function closeWordPopupOnOutside(e) {
  const popup = document.getElementById('wordPopup');
  if (popup && !popup.contains(e.target)) {
    closeWordPopup();
  }
}

function closeWordPopup() {
  const popup = document.getElementById('wordPopup');
  if (popup) popup.remove();
  document.removeEventListener('click', closeWordPopupOnOutside);
}

// Preload speech voices (they load async on some browsers)
let _speechVoices = [];
function loadVoices() {
  _speechVoices = speechSynthesis.getVoices();
}
loadVoices();
if ('speechSynthesis' in window) {
  speechSynthesis.addEventListener('voiceschanged', () => {
    _speechVoices = speechSynthesis.getVoices();
  });
  // Chrome loads voices async — retry after a short delay
  setTimeout(() => { if (!_speechVoices.length) _speechVoices = speechSynthesis.getVoices(); }, 500);
}

// Global: real voice pronunciation via Web Speech API
function speakDictWord(word, lang) {
  if (!('speechSynthesis' in window)) {
    showToast('Speech not supported on this device', 'error');
    return;
  }

  // Always get fresh voices (don't rely on cache alone)
  var voices = speechSynthesis.getVoices();
  if (!voices.length) voices = _speechVoices;
  if (!voices.length) {
    // Voices not loaded yet — try again after a moment
    showToast('Loading voices... tap again', 'info');
    speechSynthesis.getVoices(); // trigger load
    return;
  }

  speechSynthesis.cancel();
  var utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang || 'en-US';
  utterance.rate = 0.85;
  utterance.volume = 1;

  // Find best matching voice: prefer Google > native > any English
  var enVoice = voices.find(function(v) { return v.lang.startsWith(lang || 'en-US') && v.name.indexOf('Google') !== -1; })
    || voices.find(function(v) { return v.lang.startsWith(lang || 'en-US'); })
    || voices.find(function(v) { return v.lang.indexOf('en') === 0; });

  if (enVoice) utterance.voice = enVoice;

  utterance.onerror = function(e) {
    console.error('Speech error:', e.error);
    if (e.error === 'not-allowed') showToast('Tap the button to listen', 'info');
  };

  speechSynthesis.speak(utterance);
}

/**
 * Attach tap-to-lookup on a container. Words inside [data-lookup] elements become tappable.
 * The handler detects which specific word was tapped (not the whole sentence).
 */
function attachWordLookup(container) {
  if (!container) return;
  container.removeEventListener('click', handleWordTap);
  container.addEventListener('click', handleWordTap);
}

/**
 * Get the specific word at a point (for precise word detection)
 */
function getWordAtPoint(x, y) {
  // Try modern method first
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode && pos.offsetNode.nodeType === Node.TEXT_NODE) {
      const text = pos.offsetNode.textContent;
      const offset = pos.offset;
      let start = offset, end = offset;
      while (start > 0 && /[\w'-]/.test(text[start - 1])) start--;
      while (end < text.length && /[\w'-]/.test(text[end])) end++;
      const word = text.slice(start, end).trim();
      if (word.length >= 2) return word;
    }
  }
  // Fallback: caretRangeFromPoint (older WebKit)
  if (document.caretRangeFromPoint) {
    try {
      const range = document.caretRangeFromPoint(x, y);
      if (range && range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
        const text = range.startContainer.textContent;
        const offset = range.startOffset;
        let start = offset, end = offset;
        while (start > 0 && /[\w'-]/.test(text[start - 1])) start--;
        while (end < text.length && /[\w'-]/.test(text[end])) end++;
        const word = text.slice(start, end).trim();
        if (word.length >= 2) return word;
      }
    } catch (_) {}
  }
  return null;
}

async function handleWordTap(e) {
  // Don't intercept clicks on interactive elements or the popup itself
  if (e.target.closest('button, a, input, textarea, select, .word-popup, .expand-section__header, .review-mastery-btn')) return;

  // Only activate inside lookup-enabled zones
  const lookupZone = e.target.closest('[data-lookup]');
  if (!lookupZone) return;

  // Detect the specific word at the tap/click point
  const word = getWordAtPoint(e.clientX, e.clientY);
  if (!word || word.length < 2) return;

  // Don't look up the full sentence — only individual words
  const fullText = lookupZone.dataset.lookup || '';
  // If the detected word is the entire content (single word note), that's fine
  // But if it's a multi-word sentence, ensure we got a specific word
  if (fullText.split(/\s+/).length > 1 && word === fullText) return;

  e.stopPropagation();
  closeWordPopup();
  const data = await lookupWord(word);
  showWordPopup(word, data, lookupZone);
}
