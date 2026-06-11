const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./server/db');

// Using WHATWG URL API (global URL)

// ---------------------------------------------------------------------------
// Load .env file (simple loader, no npm dependencies)
// ---------------------------------------------------------------------------
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (_) { /* ignore */ }

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------------------
// Rate limiter (simple in-memory, 10 req/min per IP for /api/*)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Clean stale rate-limit entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, 300_000).unref();

// ---------------------------------------------------------------------------
// Static file server
// ---------------------------------------------------------------------------
function serveStatic(res, filePath) {
  // Prevent directory traversal
  const safe = path.normalize(filePath);
  if (!safe.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(safe).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(safe, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: serve index.html for unknown paths
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, html) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Read request body
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX = 16_384; // 16KB cap
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX) {
        req.destroy();
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(chunk);
    });
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
// DeepSeek API call (OpenAI-compatible)
// ---------------------------------------------------------------------------
function callDeepSeek(messages, apiKey, temperature = 0.3) {
  return new Promise((resolve, reject) => {
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
// /api/categorize — classify the entry
// ---------------------------------------------------------------------------
async function handleCategorize(req, res, apiKey) {
  const { content } = await readBody(req);
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or empty "content" field' }));
    return;
  }

  const systemPrompt = `You are an English language learning assistant. Classify the following English entry into EXACTLY ONE of these categories:

- word: A single vocabulary word (e.g., "serendipity", "run", "beautiful")
- phrase: A short group of words (2-5) that commonly go together (e.g., "in the meantime", "take off")
- sentence_pattern: A structural sentence template or grammar pattern (e.g., "If I were you, I would...", "It is + adjective + to + verb")
- idiom: A figurative expression where the meaning is different from the literal words (e.g., "break the ice", "spill the beans")
- common_usage: A commonly used expression, fixed phrase, or everyday conversational pattern (e.g., "How's it going?", "Long time no see")

Reply with ONLY the category name in lowercase (one of: word, phrase, sentence_pattern, idiom, common_usage). No explanation, no punctuation, no other text.`;

  const raw = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: content.trim() },
  ], apiKey);

  const category = raw.trim().toLowerCase();
  const valid = ['word', 'phrase', 'sentence_pattern', 'idiom', 'common_usage'];
  const result = valid.includes(category) ? category : 'common_usage';

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ category: result }));
}

// ---------------------------------------------------------------------------
// /api/expand — deep expansion
// ---------------------------------------------------------------------------
async function handleExpand(req, res, apiKey) {
  const { content, category } = await readBody(req);
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or empty "content" field' }));
    return;
  }

  const cat = category || 'common_usage';

  const systemPrompt = `You are an English learning assistant for Chinese speakers. Given an entry and its category, provide a deep expansion with Chinese translations.

Entry category: ${cat}

Return a JSON object (ONLY valid JSON, no markdown, no code fences) with exactly these keys:

- "chineseTranslation": The Chinese translation of the entry itself (e.g., "serendipity" → "意外发现美好事物的能力；机缘巧合")
- "definition": A clear, concise definition IN CHINESE (simplified Chinese, 简体中文). Use simple language suitable for learners.
- "definitionEn": The same definition in English (keep it short, 1-2 sentences, use simple words).
- "examples": An array of exactly 3 objects, each with:
    "en": The English example sentence (natural, practical, not too complex)
    "zh": The Chinese translation of the example sentence
- "etymology": Brief origin or word history IN CHINESE. If not applicable, set to null.
- "relatedExpressions": An array of 2-4 objects, each with:
    "en": The related English word/phrase
    "zh": Its Chinese translation

Guidelines by category:
- word: Focus on Chinese definition, synonyms (with Chinese translations), word family
- phrase: Explain when and how to use the phrase (in Chinese), with Chinese-translated examples
- sentence_pattern: Explain the pattern structure in Chinese, when to use it, give bilingual examples
- idiom: Include both literal and figurative meaning, with Chinese explanations
- common_usage: Explain the social context in Chinese, typical situations where this is used

IMPORTANT: All explanations should be in SIMPLE Chinese so that English beginners can understand. Avoid complex Chinese vocabulary in your explanations. The audience is Chinese speakers learning English at a beginner to intermediate level.`;

  const raw = await callDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Expand on this English entry: "${content.trim()}"` },
  ], apiKey, 0.4);

  // Parse: try extracting JSON from the response
  let result;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      // fallback
    }
  }

  if (!result) {
    result = {
      chineseTranslation: '',
      definition: raw.trim(),
      definitionEn: '',
      examples: [],
      etymology: null,
      relatedExpressions: [],
    };
  }

  // Normalize all fields for the new bilingual format
  result.chineseTranslation = result.chineseTranslation || '';
  result.definition = result.definition || '';           // Chinese definition (primary)
  result.definitionEn = result.definitionEn || '';       // English definition
  result.etymology = result.etymology || null;
  result.relatedExpressions = Array.isArray(result.relatedExpressions)
    ? result.relatedExpressions.slice(0, 5)
    : [];

  // Normalize examples: support both old (string) and new ({en, zh}) format
  if (Array.isArray(result.examples)) {
    result.examples = result.examples.slice(0, 5).map((ex) => {
      if (typeof ex === 'string') {
        return { en: ex, zh: '' };
      }
      return { en: ex.en || '', zh: ex.zh || '' };
    });
  } else {
    result.examples = [];
  }

  // Normalize relatedExpressions: support both old (string) and new ({en, zh}) format
  result.relatedExpressions = result.relatedExpressions.map((r) => {
    if (typeof r === 'string') {
      return { en: r, zh: '' };
    }
    return { en: r.en || '', zh: r.zh || '' };
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

// ---------------------------------------------------------------------------
// /api/sync/* — data sync routes (separate rate limit, no API key required)
// ---------------------------------------------------------------------------
const syncLimitMap = new Map();
const SYNC_RATE_LIMIT = 60;    // 60 req/min for sync
const SYNC_RATE_WINDOW = 60_000;

function checkSyncRateLimit(ip) {
  const now = Date.now();
  let entry = syncLimitMap.get(ip);
  if (!entry || now - entry.windowStart > SYNC_RATE_WINDOW) {
    entry = { windowStart: now, count: 0 };
    syncLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= SYNC_RATE_LIMIT;
}

async function handleSyncRoutes(req, res, pathname, ip) {
  if (!checkSyncRateLimit(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many sync requests. Slow down.' }));
    return true;
  }

  try {
    // POST /api/sync/register
    if (pathname === '/api/sync/register' && req.method === 'POST') {
      const { deviceId, deviceName } = await readBody(req);
      if (!deviceId || !deviceName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId and deviceName required' }));
        return true;
      }
      const result = await db.registerDevice(deviceId, deviceName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // POST /api/sync/pair
    if (pathname === '/api/sync/pair' && req.method === 'POST') {
      const { code, deviceId, deviceName } = await readBody(req);
      if (!code || !deviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'code and deviceId required' }));
        return true;
      }
      const result = await db.pairDevice(code, deviceId, deviceName || 'Unknown');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // POST /api/sync/push
    if (pathname === '/api/sync/push' && req.method === 'POST') {
      const payload = await readBody(req);
      if (!payload.deviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId required' }));
        return true;
      }
      const result = await db.pushChanges(payload.deviceId, payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // POST /api/sync/pull
    if (pathname === '/api/sync/pull' && req.method === 'POST') {
      const { deviceId, since } = await readBody(req);
      if (!deviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId required' }));
        return true;
      }
      const result = await db.pullChanges(deviceId, since || 0);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // GET /api/sync/devices?deviceId=xxx
    if (pathname === '/api/sync/devices' && req.method === 'GET') {
      const parsed = new URL(req.url, 'http://localhost');
      const deviceId = parsed.searchParams.get('deviceId');
      if (!deviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId query param required' }));
        return true;
      }
      const devices = await db.getPairedDevices(deviceId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ devices }));
      return true;
    }

    // POST /api/sync/unpair
    if (pathname === '/api/sync/unpair' && req.method === 'POST') {
      const { deviceId } = await readBody(req);
      if (!deviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId required' }));
        return true;
      }
      const result = await db.unpairDevice(deviceId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // Sync route not matched
    return false;
  } catch (err) {
    console.error('Sync error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Sync failed' }));
    return true;
  }
}

// ---------------------------------------------------------------------------
// /api/git/* — version checkpoint management (local only)
// ---------------------------------------------------------------------------
const { execSync } = require('child_process');

function gitExec(args) {
  try {
    return execSync('git ' + args, {
      cwd: __dirname,
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
  } catch (err) {
    throw new Error(err.stderr || err.message || 'Git command failed');
  }
}

async function handleGitRoutes(req, res, pathname) {
  try {
    // GET /api/git/checkpoints — list recent commits
    if (pathname === '/api/git/checkpoints' && req.method === 'GET') {
      const log = gitExec('log --oneline -30 --format="%H|%s|%ai"');
      const checkpoints = log ? log.split('\n').map(line => {
        const [hash, ...rest] = line.split('|');
        const msg = rest.slice(0, -1).join('|');
        const date = rest[rest.length - 1];
        return { hash, message: msg, date };
      }) : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ checkpoints }));
      return;
    }

    // POST /api/git/checkpoint — create a new commit
    if (pathname === '/api/git/checkpoint' && req.method === 'POST') {
      const { message } = await readBody(req);
      const msg = message || 'Checkpoint ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
      gitExec('add -A');
      // Check if there are staged changes
      const status = gitExec('status --porcelain');
      if (!status) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ checkpoint: null, message: 'No changes to save' }));
        return;
      }
      gitExec('commit -m "' + msg.replace(/"/g, '\\"') + '"');
      const log = gitExec('log -1 --format="%H|%s|%ai"');
      const [hash, ...rest] = log.split('|');
      const cmtMsg = rest.slice(0, -1).join('|');
      const date = rest[rest.length - 1];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ checkpoint: { hash, message: cmtMsg, date } }));
      return;
    }

    // POST /api/git/restore — restore files to a specific commit
    if (pathname === '/api/git/restore' && req.method === 'POST') {
      const { hash } = await readBody(req);
      if (!hash) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Commit hash required' }));
        return;
      }
      gitExec('checkout ' + hash + ' -- .');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ restored: true, hash }));
      return;
    }

    // Not matched
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('Git error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Git operation failed' }));
  }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  // Git version routes: local management, no API key needed
  if (pathname.startsWith('/api/git/')) {
    await handleGitRoutes(req, res, pathname);
    return;
  }

  // Sync routes: handle first (different rate limit, no API key needed)
  if (pathname.startsWith('/api/sync/')) {
    const ip = req.socket.remoteAddress || 'unknown';
    const handled = await handleSyncRoutes(req, res, pathname, ip);
    if (handled) return;
    // If handleSyncRoutes returned false, fall through to static serving
    // (shouldn't normally happen, but just in case)
  }

  // API routes (categorize/expand — need API key, separate rate limit)
  if (pathname.startsWith('/api/')) {
    // Rate limit
    const ip = req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }));
      return;
    }

    // Resolve API key: user's key from header takes priority, then env var
    const userApiKey = (req.headers['x-api-key'] || '').trim();
    const resolvedKey = userApiKey || DEEPSEEK_API_KEY;

    // Health check doesn't need a valid key
    if (pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        apiConfigured: !!resolvedKey,
        usingUserKey: !!userApiKey,
        usingServerKey: !userApiKey && !!DEEPSEEK_API_KEY,
      }));
      return;
    }

    // All other API routes need a key
    if (!resolvedKey) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'No API key configured. Add your DeepSeek API key in Settings, or set DEEPSEEK_API_KEY on the server.'
      }));
      return;
    }

    try {
      if (pathname === '/api/categorize' && req.method === 'POST') {
        await handleCategorize(req, res, resolvedKey);
      } else if (pathname === '/api/expand' && req.method === 'POST') {
        await handleExpand(req, res, resolvedKey);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      console.error('API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal error' }));
    }
    return;
  }

  // Static file serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  serveStatic(res, filePath);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', async () => {
  // Initialize database
  try {
    await db.init();
  } catch (err) {
    console.error('Database init failed:', err.message);
    console.error('Sync features will be unavailable.');
  }

  // Print local network addresses
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  console.log(`📚 English Learning App running at:`);
  console.log(`   Local:    http://localhost:${PORT}`);
  for (const addr of addresses) {
    console.log(`   Network:  http://${addr}:${PORT}`);
  }
  if (!DEEPSEEK_API_KEY) {
    console.warn('⚠️  DEEPSEEK_API_KEY not set — AI features will return 503.');
    console.warn('   Create a .env file or set the environment variable.');
  }
});
