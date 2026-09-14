# Northwind AI Sales Agent

A universal CRM + AI-first autonomous sales workspace. **CRM is the memory. The AI Sales Agent is the worker.**

Every number on screen — pipeline totals, deal scores, forecasts, recommendations, insights — is computed from data actually stored in MongoDB. Nothing is hardcoded and nothing is fabricated by the AI: when the local (no-API-key) provider is active it can only report what a real database query returned; when a live LLM is configured it still answers strictly through tool calls against the same queries.

## Product overview

- **Daily Briefing** — an AI-written summary of what needs attention today (hot leads, due follow-ups, at-risk deals, pipeline health), not a generic dashboard.
- **AI Assistant** — a chat workspace with real tool-calling (`getDeals`, `getAtRiskDeals`, `getLeads`, `getPipeline`, `getTasks`, `createTask`, `updateDeal`, …) against your CRM data.
- **Universal CRM** — Leads, Contacts, Companies, Deals, Activities, Conversations, Tasks, Products, with full CRUD, search, filters, and pagination.
- **AI deal scoring** — a transparent, explainable formula: `Close Probability = Activity(30%) + Engagement(25%) + DecisionMaker(20%) + Stage(15%) + HistoricalRate(10%)`, computed live from Activity/Conversation/Contact/Deal records.
- **Anomaly detection** — rule-based (no activity 7+ days, proposal viewed 3×, decision maker engaged, stage stalled 30+ days) generating deduplicated `AIInsight` records.
- **Content generation** — email, WhatsApp, call scripts, and proposal sections, personalized from real deal/contact context.
- **Autonomy levels (1–4: Observe → Recommend → Prepare → Execute)** with granular per-category permission gates (email sending, WhatsApp sending, CRM updates, meeting scheduling, proposal creation, task creation).
- **Approval Center** — every AI-initiated action is inspectable (what, why, confidence, permission requirement) before it can execute.
- **Pipeline (Kanban)**, **Manager Dashboard**, **Forecast** (`Expected Revenue = Value × Probability`), **Report Builder** (CSV/PDF export), **Audit Logs**, **Notifications**, **Global Search / Command Bar (⌘K)**.
- **Integration architecture** for Gmail/Outlook/SMTP, WhatsApp Cloud API, Twilio/Vonage, Google/Outlook Calendar — every provider has a clearly-labeled `development` adapter (logs instead of calling a real API) and a `production` adapter that is only used once real credentials are configured and the integration is explicitly connected. The app never pretends an unconfigured integration succeeded.

## Architecture

```
client/   React + Vite + TypeScript + Tailwind + TanStack Query + React Router + Recharts
server/   Node.js + Express + TypeScript + MongoDB + Mongoose
server/src/ai/            AIService abstraction — chat(), analyzeDeal(), scoreDeal(),
                           generateEmail/WhatsApp/CallScript, detectAnomalies(),
                           recommendNextAction(), summarizeConversation(),
                           forecastPipeline(), generateDailyBriefing()
server/src/ai/providers/   LocalAIProvider (deterministic, no external API) and
                           AnthropicAIProvider (real Claude API + tool use)
server/src/integrations/   EmailProvider / WhatsAppProvider / TelephonyProvider /
                           CalendarProvider interfaces, each with development
                           and production adapters, resolved per-organization
                           via the Integration model's connection status
```

### AI provider abstraction

The app never talks to an LLM SDK directly outside `server/src/ai`. `AI_PROVIDER=local` (default) uses `LocalAIProvider`, which maps chat intents to real tool calls via keyword matching and answers only with returned data — fully functional with zero external dependency. Set `AI_PROVIDER=anthropic` and `AI_API_KEY` to switch to live Claude chat with native tool-use; the rest of the app is unaffected because it only calls `aiService.*`, never a provider directly.

### Multi-tenancy

Every document belongs to an `Organization`. Every query in every controller is scoped by `req.user.organizationId` (set by the `requireAuth` middleware from a verified JWT) — there is no code path that reads another organization's data.

## Setup

### 1. Install dependencies

```bash
npm install --workspaces
# or, from each folder:
cd server && npm install
cd client && npm install
```

### 2. Database

Copy `.env.example` to `.env` at the repo root (or `server/.env`) and point `MONGODB_URI` at a running MongoDB:

- **Local**: install [MongoDB Community Server](https://www.mongodb.com/try/download/community), then `MONGODB_URI=mongodb://localhost:27017/ai_sales_agent`.
- **Atlas**: create a free cluster and paste its connection string.

### 3. Seed demo data

```bash
cd server
npm run seed
```

Creates a demo organization ("Northwind Analytics (Demo)") with users, companies, contacts, leads, deals (deliberately at different health states so scoring/anomaly detection have real signal to react to), activities, conversations, and tasks. Demo logins (password `Demo123!`):

| Role | Email |
|---|---|
| Admin | admin@northwind.demo |
| Manager | elena@northwind.demo |
| Rep | priya@northwind.demo |
| Rep | marcus@northwind.demo |

### 4. Run

```bash
# from repo root
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173 (proxies /api to :4000)
```

Or `npm run dev` to start both.

### 5. Smoke test (no MongoDB install required)

```bash
cd server
npm run smoke
```

Boots the real server against an ephemeral in-memory MongoDB, seeds it, and exercises auth, the daily briefing, deal scoring, AI chat, forecast, manager dashboard, and anomaly detection end-to-end.

## Environment variables

See `.env.example`. Nothing is hardcoded/committed — secrets are never checked in.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Access/refresh token signing |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | AI provider selection (`local` or `anthropic`) |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` | Gmail/Outlook OAuth (email + calendar) |
| `SMTP_HOST/PORT/USER/PASS` | Real SMTP sending (works without OAuth) |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN` | Twilio calling |

## API structure

```
/api/auth            signup, login, refresh, logout, me
/api/organizations    org profile, onboarding steps, deal stages, custom fields
/api/users            team management (invite, roles)
/api/leads /contacts /companies /deals /activities /conversations /tasks /products /meetings
/api/dashboard        daily briefing, manager dashboard, follow-up performance
/api/ai               chat, content generation, deal analysis, anomaly detection, forecast
/api/recommendations  AI action queue: generate, prepare, edit, approve, reject, execute
/api/insights         AI-detected anomalies
/api/forecast         pipeline forecasting
/api/reports          report builder: CRUD, preview, run, CSV/PDF export
/api/integrations     connect/disconnect email, calendar, WhatsApp, telephony providers
/api/import           CSV preview (column mapping) + commit
/api/notifications    notification center
/api/audit            audit log
/api/settings         security (sessions, SSO flag, IP allowlist)
/api/autonomy         autonomy level + granular permissions
/api/search           global search across all entities
```

## Testing

`server/src/scripts/smokeTest.ts` is an end-to-end integration check (auth → seed → briefing → AI chat → forecast → manager dashboard → anomaly detection) run via `npm run smoke`. Add `jest` unit/integration tests under `server/src/**/__tests__` for deeper coverage (auth, permissions, deal scoring, forecasting, organization isolation) — the project is wired for `npm test` via `ts-jest` and `mongodb-memory-server`.

## Deployment

- **Server**: `npm run build && npm start` in `server/` (compiles TypeScript to `dist/`). Point `MONGODB_URI` at a production cluster and set real secrets.
- **Client**: `npm run build` in `client/` produces a static `dist/` bundle — serve behind any static host/CDN, with `/api` reverse-proxied to the server.

## What's deliberately not "fake"

- No hardcoded dashboard numbers, pipeline totals, AI scores, or recommendations — everything traces back to a MongoDB query or a documented formula.
- No pretended OAuth: Gmail/Outlook/WhatsApp/Twilio only activate once real credentials are present *and* the integration is explicitly connected; otherwise the clearly-labeled development adapter is used and the UI says so.
- No random numbers in AI scoring, forecasting, or anomaly detection — every value is deterministic given the same underlying data.
