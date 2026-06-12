/* ---------------------------------------------------------------------------
   Vercel Serverless Function — AI proxy + sync stub
   Adapted from server.js for Vercel's platform
   --------------------------------------------------------------------------- */

// DeepSeek API (OpenAI-compatible)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ---------------------------------------------------------------------------
// Security: rate limiting (per-IP, in-memory)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 15;      // 15 requests
const RATE_WINDOW_MS = 60_000;  // per minute
const INPUT_MAX_LENGTH = 2000;  // max content length

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  // Cleanup old entries every 100 requests
  if (Math.random() < 0.01) {
    const cutoff = now - RATE_WINDOW_MS;
    for (const [k, v] of rateLimitMap) {
      if (v.windowStart < cutoff) rateLimitMap.delete(k);
    }
  }
  return entry.count <= RATE_LIMIT_MAX;
}

// Sanitize input: strip HTML tags, control chars, limit length
function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars
    .slice(0, INPUT_MAX_LENGTH)
    .trim();
}

// Blocklist: common attack patterns
const BLOCKED_PATTERNS = [
  /javascript\s*:/i,
  /<script/i,
  /on\w+\s*=/i,
  /data\s*:/i,
  /&#x/i,
  /%3[Cc]/i,
];

function isBlocked(input) {
  return BLOCKED_PATTERNS.some((p) => p.test(input));
}

// ---------------------------------------------------------------------------
// Read request body
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };
}

// ---------------------------------------------------------------------------
// DeepSeek API call
// ---------------------------------------------------------------------------
function callDeepSeek(messages, apiKey, temperature = 0.3) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: 1024,
    });

    const parsed = new URL(DEEPSEEK_API_URL);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30_000,
    };

    const apiReq = https.request(options, (apiRes) => {
      const chunks = [];
      apiRes.on('data', (c) => chunks.push(c));
      apiRes.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (data.error) {
            reject(new Error(data.error.message || 'API error'));
          } else {
            resolve(data.choices[0].message.content);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    apiReq.on('error', reject);
    apiReq.on('timeout', () => { apiReq.destroy(); reject(new Error('API timeout')); });
    apiReq.write(body);
    apiReq.end();
  });
}

// ---------------------------------------------------------------------------
// AI Routes
// ---------------------------------------------------------------------------

async function handleCategorize(body, apiKey) {
  const { content } = body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { status: 400, body: { error: 'Missing or empty "content" field' } };
  }

  const systemPrompt = `You are an English language learning assistant. Classify the following English entry into EXACTLY ONE of these categories:

- word: A single vocabulary word (e.g., "serendipity", "run", "beautiful")
- phrase: A short group of words (2-5) that commonly go together (e.g., "in the meantime", "take off")
- sentence: A structural sentence template or grammar pattern (e.g., "If I were you, I would...", "It is + adjective + to + verb")
- idiom: A figurative expression where the meaning is different from the literal words (e.g., "break the ice", "spill the beans")
- common_usage: A commonly used expression, fixed phrase, or everyday conversational pattern (e.g., "How's it going?", "Long time no see")

Reply with ONLY the category name in lowercase (one of: word, phrase, sentence, idiom, common_usage). No explanation, no punctuation, no other text.`;

  const raw = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: content.trim() },
  ], apiKey);

  const category = raw.trim().toLowerCase();
  const valid = ['word', 'phrase', 'sentence', 'idiom', 'common_usage'];
  return { status: 200, body: { category: valid.includes(category) ? category : 'common_usage' } };
}

async function handleExpand(body, apiKey) {
  const { content, category } = body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { status: 400, body: { error: 'Missing or empty "content" field' } };
  }

  const cat = category || 'common_usage';

  const systemPrompt = `You are an English learning assistant for Chinese speakers. Given an entry and its category, provide a deep expansion with Chinese translations.

Entry category: ${cat}

Return a JSON object (ONLY valid JSON, no markdown, no code fences) with exactly these keys:

- "chineseTranslation": The Chinese translation of the entry itself
- "definition": A clear, concise definition IN CHINESE (simplified Chinese, 简体中文). Use simple language suitable for learners.
- "definitionEn": The same definition in English (keep it short, 1-2 sentences, use simple words).
- "examples": An array of exactly 3 objects, each with:
    "en": The English example sentence (natural, practical, not too complex)
    "zh": The Chinese translation of the example sentence
- "etymology": Brief origin or word history IN CHINESE. If not applicable, set to null.
- "relatedExpressions": An array of 2-4 objects, each with:
    "en": The related English word/phrase
    "zh": Its Chinese translation

IMPORTANT: All explanations should be in SIMPLE Chinese so that English beginners can understand.`;

  const raw = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Expand on this English entry: "${content.trim()}"` },
  ], apiKey, 0.4);

  let result;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { result = JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
  }

  if (!result) {
    result = { chineseTranslation: '', definition: raw.trim(), definitionEn: '', examples: [], etymology: null, relatedExpressions: [] };
  }

  result.chineseTranslation = result.chineseTranslation || '';
  result.definition = result.definition || '';
  result.definitionEn = result.definitionEn || '';
  result.etymology = result.etymology || null;
  result.relatedExpressions = Array.isArray(result.relatedExpressions) ? result.relatedExpressions.slice(0, 5) : [];

  if (Array.isArray(result.examples)) {
    result.examples = result.examples.slice(0, 5).map((ex) => {
      if (typeof ex === 'string') return { en: ex, zh: '' };
      return { en: ex.en || '', zh: ex.zh || '' };
    });
  } else {
    result.examples = [];
  }

  result.relatedExpressions = result.relatedExpressions.map((r) => {
    if (typeof r === 'string') return { en: r, zh: '' };
    return { en: r.en || '', zh: r.zh || '' };
  });

  return { status: 200, body: result };
}

// ---------------------------------------------------------------------------
// /api/dictionary — bilingual dictionary lookup
// ---------------------------------------------------------------------------
async function handleDictionary(body, apiKey) {
  const { word, direction, mode } = body; // direction: 'en-zh' or 'zh-en'
  const dir = direction === 'zh-en' ? 'zh-en' : 'en-zh';
  const isEnToZh = dir === 'en-zh';

  if (!word || typeof word !== 'string' || word.trim().length < 1) {
    return { status: 400, body: { error: 'Missing or empty "word" field' } };
  }

  // Translation mode — for long sentences/passages, just return the translation
  if (mode === 'translate') {
    const translatePrompt = isEnToZh
      ? `You are a translator. Translate the following English text into natural, fluent simplified Chinese (简体中文). Return ONLY the Chinese translation — no explanations, no notes, no JSON. Just the translated text.`
      : `You are a translator. Translate the following Chinese text into natural, fluent English. Return ONLY the English translation — no explanations, no notes, no JSON. Just the translated text.`;

    const raw = await callDeepSeek([
      { role: 'system', content: translatePrompt },
      { role: 'user', content: word.trim() },
    ], apiKey, 0.3);

    const translation = raw.trim();
    return { status: 200, body: { word: word.trim(), translation, direction: dir, mode: 'translate' } };
  }

  const systemPrompt = isEnToZh
    ? `You are a bilingual English-Chinese dictionary. Given an English word or phrase, return a JSON object with:
- "word": the original English word
- "phonetic": IPA pronunciation (e.g., /sɪˈrɛndɪpɪti/)
- "pos": part of speech (e.g., noun, verb, adjective)
- "chineseTranslation": Chinese translation (simplified Chinese)
- "definition": definition IN CHINESE, clear and simple
- "definitionEn": definition in English, 1-2 sentences
- "examples": array of 2-3 objects with "en" (English example) and "zh" (Chinese translation)
- "related": array of 2-3 related English words with their Chinese translations as strings like "word (翻译)"

Return ONLY valid JSON, no markdown, no code fences.`
    : `You are a bilingual Chinese-English dictionary. Given a Chinese word or phrase, return a JSON object with:
- "word": the original Chinese word
- "phonetic": pinyin with tone marks (e.g., "xìng fú")
- "pos": part of speech in English (e.g., noun, verb, adjective)
- "englishTranslation": English translation
- "definition": definition IN CHINESE, clear and simple
- "definitionEn": definition in English, 1-2 sentences
- "examples": array of 2-3 objects with "zh" (Chinese example) and "en" (English translation)
- "related": array of 2-3 related Chinese words with their English translations as strings like "单词 (translation)"

Return ONLY valid JSON, no markdown, no code fences.`;

  const raw = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: word.trim() },
  ], apiKey, 0.3);

  let result;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { result = JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
  }

  if (!result) {
    result = isEnToZh
      ? { word: word.trim(), phonetic: '', pos: '', chineseTranslation: raw.trim(), definition: '', definitionEn: '', examples: [], related: [] }
      : { word: word.trim(), phonetic: '', pos: '', englishTranslation: raw.trim(), definition: '', definitionEn: '', examples: [], related: [] };
  }

  // Normalize
  result.word = result.word || word.trim();
  result.phonetic = result.phonetic || '';
  result.pos = result.pos || '';
  result.chineseTranslation = result.chineseTranslation || result.englishTranslation || '';
  result.englishTranslation = result.englishTranslation || result.chineseTranslation || '';
  result.definition = result.definition || '';
  result.definitionEn = result.definitionEn || '';
  result.examples = Array.isArray(result.examples) ? result.examples.slice(0, 3).map(ex => ({
    en: ex.en || '', zh: ex.zh || ''
  })) : [];
  result.related = Array.isArray(result.related) ? result.related.slice(0, 4) : [];

  return { status: 200, body: { ...result, direction: dir } };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    // Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      res.status(200).json({
        status: 'ok',
        apiConfigured: !!DEEPSEEK_API_KEY,
        usingServerKey: !!DEEPSEEK_API_KEY,
      });
      return;
    }

    // Sync routes — unavailable on Vercel (no persistent storage)
    if (pathname.startsWith('/api/sync/')) {
      res.status(503).json({
        error: 'Sync is unavailable in cloud deployment. Your notes are stored locally on this device.',
      });
      return;
    }

    // Git routes — unavailable on Vercel
    if (pathname.startsWith('/api/git/')) {
      res.status(503).json({
        error: 'Version history is unavailable in cloud deployment.',
      });
      return;
    }

    // Resolve API key: user key from header first, then server env var
    const userApiKey = (req.headers['x-api-key'] || '').trim();
    const resolvedKey = userApiKey || DEEPSEEK_API_KEY;

    if (!resolvedKey) {
      res.status(503).json({
        error: 'No API key configured. Add your DeepSeek API key in Settings.',
      });
      return;
    }

    // AI routes — rate limit + validate
    if (pathname === '/api/categorize' && req.method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
        return;
      }
      const body = await readBody(req);
      if (isBlocked(body.content || '')) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      body.content = sanitize(body.content);
      const result = await handleCategorize(body, resolvedKey);
      res.status(result.status).json(result.body);
      return;
    }

    if (pathname === '/api/expand' && req.method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
        return;
      }
      const body = await readBody(req);
      if (isBlocked(body.content || '')) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      body.content = sanitize(body.content);
      const result = await handleExpand(body, resolvedKey);
      res.status(result.status).json(result.body);
      return;
    }

    if (pathname === '/api/dictionary' && req.method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
        return;
      }
      const body = await readBody(req);
      if (isBlocked(body.word || '')) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      body.word = sanitize(body.word);
      const result = await handleDictionary(body, resolvedKey);
      res.status(result.status).json(result.body);
      return;
    }

    // Unknown API route
    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('API error:', err.message);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
};
