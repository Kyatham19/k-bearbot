# AlphaSight AI

<p align="center">
  <img src="./logos/final_logo.svg" alt="AlphaSight Logo" width="120" />
</p>

<p align="center">
  <img
    src="https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=22&duration=2500&pause=900&color=0EA5E9&center=true&vCenter=true&width=760&lines=AI+market+intelligence+workspace;Streaming+chat+%E2%80%A2+portfolio+tracking+%E2%80%A2+watchlist+monitoring;Daily+briefs+with+real-time+context"
    alt="Animated AlphaSight tagline"
  />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/AI-Mistral-F97316" alt="Mistral" />
</p>

---

## Overview

AlphaSight AI is an AI-first market intelligence workspace with:

- Streaming chat for low-latency answers
- Stock-aware analysis with live quote, history, and news context
- Portfolio valuation, P&L, and health summaries
- Watchlist tracking with movement checks
- Daily briefs for portfolio and market pulse

---

## Highlights

<table>
  <tr>
    <td><strong>Fast UI</strong><br />Text-first streaming responses</td>
    <td><strong>Market Context</strong><br />Quotes, history, fundamentals, and news</td>
  </tr>
  <tr>
    <td><strong>Secure by Design</strong><br />Supabase auth with RLS</td>
    <td><strong>Automated Briefs</strong><br />Scheduled summaries for each user</td>
  </tr>
</table>

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React 19, TypeScript, Tailwind CSS, Framer Motion |
| State | Zustand |
| Backend | Next.js Route Handlers |
| Auth + DB | Supabase (Postgres + RLS) |
| LLM Provider | Mistral |
| Market Data | Yahoo Finance endpoints |
| News | MarketAux, NewsData.io, Yahoo fallback |

---

## Architecture

```text
Client (Next.js + Zustand)
  ├─ Chat UI
  ├─ Portfolio UI
  ├─ Watchlist UI
  └─ Daily Brief UI

API (Route Handlers)
  ├─ /api/chat
  ├─ /api/conversations/*
  ├─ /api/portfolio*
  ├─ /api/watchlist
  ├─ /api/stock/*
  └─ /api/daily-brief

Services
  ├─ Mistral
  ├─ Yahoo market endpoints
  └─ News providers

Persistence
  └─ Supabase Postgres (RLS enforced)
```

---

## Project Structure

```text
src/
  app/
    (app)/                 # authenticated surfaces
    api/                   # route handlers
    auth/callback/         # OAuth callback
    login/, signup/        # auth pages
  components/              # chat, layout, portfolio, ui
  lib/                     # ai, stock, supabase, hooks, utils
  stores/                  # Zustand store
  types/                   # shared TS types
supabase/
  schema.sql
logos/
  final_logo.svg
```

---

## Quick Start

### Install

```bash
npm install
```

### Configure `.env.local`

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI provider (required)
MISTRAL_API_KEY=

# News providers (optional but recommended)
MARKETAUX_API_KEY=
NEWSDATA_API_KEY=

# Optional cron auth secret
CRON_SECRET=
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production

```bash
npm run build
npm run start
```

---

## Scripts

- `npm run dev` - start dev server (Turbopack)
- `npm run build` - production build (Turbopack)
- `npm run start` - run built app
- `npm run lint` - lint via Next.js

---

## API Overview

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Stream AI response (general or stock-context mode) |
| `/api/conversations` | GET, POST | List/create conversations |
| `/api/conversations/[id]` | GET, DELETE | Read/delete conversation |
| `/api/conversations/[id]/messages` | GET | Paginated messages |
| `/api/portfolio` | GET, POST | List/add holdings |
| `/api/portfolio/[id]` | PUT, DELETE | Update/delete holding |
| `/api/portfolio/intelligence` | GET | AI health score, sentiment, buy/hold/sell signals |
| `/api/watchlist` | GET, POST, DELETE | Manage watchlist |
| `/api/stock/search` | GET | Symbol/company search |
| `/api/stock/quote` | GET | Quote data |
| `/api/daily-brief` | GET, POST | Fetch/generate daily brief |
| `/api/test-ai` | GET | Quick provider readiness check |

---

## Response Model

Chat responses follow **Contextual AI Synthesis**:

1. Direct answer
2. Context signals
3. News synthesis
4. Risks and uncertainty
5. Practical takeaway

The UI stays **text-first** to keep chat clean and focused.

---

## Recent Changes

### Latest Commits

```
╔════════════════════════════════════════════════════════════════╗
║                      Last 5 Commits                           ║
╠════════════════════════════════════════════════════════════════╣
║ 89721b6  docs: refresh README presentation                    ║
║ 5022c2c  Fix scheduled daily brief cron processing            ║
║ 9bae401  Fix first chat rendering and stale cache issues      ║
║ 581be66  fix(cron): revert to daily schedule for Vercel       ║
║ dd64348  chore: bump version to 1.1.0                         ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: description"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## Support

- Email: support@alphasight.ai
- Bugs: [GitHub Issues](https://github.com/Eshwar02/bearbot/issues)
- Discussions: [GitHub Discussions](https://github.com/Eshwar02/bearbot/discussions)

---

## Status

- Active AI provider: Mistral
- Branding: AlphaSight logo
- Current version: 1.1.0
- Deployment target: Vercel
