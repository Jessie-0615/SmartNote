# SmartNote

**An effortless English accumulation notebook.** Jot things down — the app figures out what kind of entry it is and organizes it for you. No manual sorting, no friction. The goal isn't to push you to "study harder"; it's to make saving English snippets so painless that accumulation becomes a natural habit.

**[Live Demo](https://smart-note-mocha.vercel.app)**

## What it does

- **Auto-categorization** — Drop in a word, phrase, idiom, sentence, or common expression. AI classifies it automatically so you never have to sort by hand.
- **AI Expansion** — For words and short phrases, get Chinese translations, bilingual definitions, example sentences, etymology, and related expressions — all generated on the spot.
- **Spaced Repetition** — SM-2 algorithm with 6 intervals (1→3→7→14→30→60 days). Review at the right moment to lock it into long-term memory.
- **Dictionary** — Bilingual EN↔ZH lookup with pronunciation. Paste a long sentence or paragraph and get a clean translation.
- **12 Themes + 5 Visual Styles** — Vintage Paper, Dark Mode, Mint Fresh, and more. Switch anytime.
- **PWA** — Install to your phone's home screen. Works offline. All notes live in your browser via IndexedDB.
- **Cross-device Sync** — Pair devices to sync notes (requires the local Node.js server with SQLite).

## Quick Start

```bash
git clone https://github.com/Jessie-0615/SmartNote.git
cd SmartNote
npm install
```

Create a `.env` file with your DeepSeek API key:

```
DEEPSEEK_API_KEY=sk-your-key-here
PORT=3000
```

Get a free key at [platform.deepseek.com](https://platform.deepseek.com/api_keys).

```bash
npm start
```

Open `http://localhost:3000`.

### Deploy to Vercel

1. Fork this repo
2. Import to [Vercel](https://vercel.com)
3. Set `DEEPSEEK_API_KEY` in environment variables
4. Deploy

AI features run through Vercel's serverless function. Notes stay in each user's browser. Cross-device sync requires the local Node.js server.

## Tech Stack

Vanilla JS SPA (hash router, IndexedDB, Service Worker) · Node.js + better-sqlite3 · DeepSeek API · DM Serif Display + DM Sans

## License

MIT
