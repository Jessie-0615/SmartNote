# SmartNote

AI-powered English learning PWA with spaced repetition review. Add words and phrases, get AI-generated Chinese translations, bilingual definitions, examples, and etymology. Review with SM-2 spaced repetition to build long-term memory.

**[Live Demo](https://smart-note-mocha.vercel.app)**

## Features

- **AI Expansion** — DeepSeek AI provides Chinese translation, bilingual definitions, example sentences, etymology, and related expressions
- **Spaced Repetition** — SM-2 algorithm with 6 review intervals (1→3→7→14→30→60 days)
- **12 Color Themes** — Vintage Paper, Dark Mode, Mint Fresh, Soft Butter, Dusty Rose, Sky Blue, Lavender, Hot Pink Teal, Raspberry, Terra, Pop, Warm Peach
- **5 Interface Styles** — Original, Soft Depth (neumorphic), Editorial (linen texture), Tag (sticky notes), Frosted Glass (acrylic blur)
- **PWA** — Install to your phone's home screen, works offline
- **IndexedDB Storage** — All your notes stay on your device
- **Cross-device Sync** — Pair devices to sync notes (requires local server)

## Quick Start

### Run locally

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

Get a free API key at [platform.deepseek.com](https://platform.deepseek.com/api_keys).

```bash
npm start
```

Open `http://localhost:3000` in your browser.

### Deploy to Vercel

1. Fork this repo
2. Import to [Vercel](https://vercel.com)
3. Set environment variable `DEEPSEEK_API_KEY` to your API key
4. Deploy

The app works fully on Vercel — AI features run through the serverless function, notes stay in each user's browser IndexedDB. Cross-device sync requires running the local Node.js server (uses SQLite).

## Tech Stack

- **Frontend**: Vanilla JS SPA with hash router, IndexedDB, Service Worker (PWA)
- **Backend**: Node.js + better-sqlite3 (local sync), Vercel serverless function (AI proxy)
- **AI**: DeepSeek API (OpenAI-compatible)
- **Fonts**: DM Serif Display + DM Sans (Google Fonts)

## License

MIT
