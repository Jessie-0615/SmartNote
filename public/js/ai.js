/* ---------------------------------------------------------------------------
   AI API Client — calls the backend proxy
   --------------------------------------------------------------------------- */

/**
 * Get the user's API key from localStorage (if any)
 */
function getUserApiKey() {
  return localStorage.getItem('engnotes_api_key') || '';
}

/**
 * Call the AI proxy with a timeout and error handling
 */
async function aiFetch(endpoint, body, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  const userKey = getUserApiKey();
  if (userKey) {
    headers['X-API-Key'] = userKey;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error (${res.status})`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    if (err.message === 'Failed to fetch') {
      throw new Error('Cannot reach server. Check that the app is running and you are online.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Auto-categorize an entry using AI
 * @param {string} content - The word/phrase/sentence to categorize
 * @returns {Promise<string>} The category string
 */
async function aiCategorize(content) {
  const result = await aiFetch('/api/categorize', { content });
  return result.category;
}

/**
 * Deep-expand an entry using AI
 * @param {string} content - The entry to expand
 * @param {string} category - The entry's category
 * @returns {Promise<Object>} { definition, examples[], etymology, relatedExpressions[] }
 */
async function aiExpand(content, category) {
  return aiFetch('/api/expand', { content, category });
}

/**
 * Check if the AI API is reachable and has a key configured
 * @returns {Promise<{ok: boolean, hasUserKey: boolean, hasServerKey: boolean}>}
 */
async function aiHealthCheck() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { ok: false, hasUserKey: !!getUserApiKey(), hasServerKey: false };
    const data = await res.json();
    return {
      ok: data.status === 'ok',
      hasUserKey: !!getUserApiKey(),
      hasServerKey: data.apiConfigured === true,
    };
  } catch {
    return { ok: false, hasUserKey: !!getUserApiKey(), hasServerKey: false };
  }
}
