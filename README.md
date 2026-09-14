Northwind AI Sales Agent

Universal CRM plus AI-first sales workspace.

Northwind AI Sales Agent combines CRM data, AI reasoning, sales automation, and operational workflows in one platform.

The CRM acts as memory.
The AI Sales Agent acts as worker.

All sales insights use stored CRM data.
No dashboard values are hardcoded.

Core Capabilities
CRM
Leads management
Contacts management
Company management
Deal management
Activity tracking
Conversations
Tasks
Products
Global search
Filtering
Pagination
AI Sales Agent
AI Assistant
Daily Briefing
AI deal scoring
Lead scoring
Next-best-action recommendations
Anomaly detection
Conversation summaries
Pipeline forecasting
AI content generation
Sales Intelligence

Deal probability uses:

Activity          30%
Engagement        25%
Decision Maker    20%
Stage             15%
Historical Rate   10%

Forecasting uses:

Expected Revenue = Deal Value × Probability
AI Anomaly Detection

The system detects signals including:

No activity for 7+ days
Proposal viewed repeatedly
Decision-maker engagement
Stalled deal stages
At-risk deals
Hot leads
Positive momentum
AI Content

Generate sales content for:

Email
WhatsApp
Call scripts
Proposals

Content uses actual CRM context.

AI Autonomy

The platform supports four autonomy levels:

Level 1 — Observe
Level 2 — Recommend
Level 3 — Prepare
Level 4 — Execute

Permissions can be configured separately for:

Email sending
WhatsApp sending
CRM updates
Meeting scheduling
Proposal creation
Task creation
Approval Center

AI actions can require approval.

Each recommendation provides:

Action
Reason
Confidence
Required permission
Execution status

This keeps AI actions inspectable.

Dashboards

The application includes:

Manager Dashboard
Sales Pipeline
Forecast
Reports
Daily Briefing
Notifications
Audit Logs

Reports support:

Tables
Bar charts
Line charts
Pie charts
CSV export
PDF export
Integrations

The integration architecture supports:

Gmail
Outlook
SMTP
Google Calendar
Outlook Calendar
WhatsApp
Twilio
Vonage
Salesforce
HubSpot
Pipedrive

Development adapters can safely simulate integrations.

Production adapters require real credentials.

Unconfigured integrations never report fake success.

Architecture
AI_Sales_Agent/
│
├── client/
│   ├── components/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── stores/
│   ├── types/
│   └── api/
│
├── server/
│   ├── src/
│   │   ├── ai/
│   │   ├── controllers/
│   │   ├── integrations/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── realtime/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── seed/
│   │   ├── utils/
│   │   └── validators/
│   │
│   ├── prisma/
│   └── __tests__/
│
├── package.json
└── .env.example
Technology Stack
Frontend
React 18
TypeScript
Vite
Tailwind CSS
TanStack Query
React Router
Recharts
Axios
React Hook Form
Zod
Socket.IO Client
Lucide React
Backend
Node.js
Express
TypeScript
Prisma
MongoDB
JWT authentication
Socket.IO
Jest
Supertest
AI
Anthropic Claude
Local AI provider
Tool-based AI interactions
AI service abstraction
AI Provider Architecture

AI functionality is isolated inside:

server/src/ai/

The application supports:

LocalAIProvider
AnthropicAIProvider
Local Provider

The local provider requires no API key.

It uses deterministic logic and real database queries.

Anthropic Provider

Claude can provide live AI capabilities.

Configure:

AI_PROVIDER=anthropic
AI_API_KEY=your_key
AI_MODEL=your_model

The rest of the application communicates through aiService.

Multi-Tenancy

Every organization has isolated data.

Database records belong to an organization.

Authenticated requests use:

req.user.organizationId

Controllers scope database operations accordingly.

This prevents cross-organization data access.

Getting Started
Requirements

Install:

Node.js
npm
MongoDB
Clone
git clone YOUR_REPOSITORY_URL
cd AI_Sales_Agent
Install Dependencies
npm install --workspaces

Or install separately:

cd server
npm install

cd ../client
npm install
Environment Configuration

Copy:

.env.example

Create your local .env.

Configure MongoDB and authentication secrets.

Example:

MONGODB_URI=mongodb://localhost:27017/ai_sales_agent
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
AI_PROVIDER=local

Never commit real credentials.

Database

Generate Prisma client:

cd server
npm run prisma:generate

Apply database changes:

npm run prisma:migrate
Seed Demo Data
cd server
npm run seed

The seed creates demo:

Organization
Users
Companies
Contacts
Leads
Deals
Activities
Conversations
Tasks
Run Development

From the root:

npm run dev

Or separately:

npm run dev:server
npm run dev:client

Default development ports:

Frontend: http://localhost:5173
Backend:  http://localhost:4000
Testing

Run the complete backend test suite:

npm test

Run the smoke test:

cd server
npm run smoke

The smoke test exercises major application workflows using an ephemeral MongoDB instance.

Build

Build both applications:

npm run build

Frontend preview:

cd client
npm run preview
Security

The project includes:

JWT authentication
Refresh tokens
Password hashing
Helmet
CORS
Rate limiting
Request validation
Organization-level isolation
Audit logging

Never commit:

.env
API keys
Database credentials
OAuth secrets
Production tokens
Project Philosophy

Northwind AI Sales Agent focuses on trustworthy automation.

AI should not invent CRM information.

AI should work from real data.

AI actions should remain transparent.

AI execution should respect permissions.

Development Status

This project is actively developed by Gyaankool Research Labs.
