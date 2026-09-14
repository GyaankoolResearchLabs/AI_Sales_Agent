AI Sales Agent

AI-powered sales platform.

Built for modern sales teams.

Features
Lead management
Deal management
Sales pipeline
AI sales assistant
AI lead scoring
Deal scoring
Next-best actions
Daily sales briefings
Forecasting
Reports and analytics
Task management
Approval workflows
Activity tracking
Team management
Organization settings
Audit logs
Sales automation
Tech Stack
Frontend
React
TypeScript
Vite
Tailwind CSS
Axios
React Router
Backend
Node.js
Express
TypeScript
Prisma
PostgreSQL
AI
Anthropic Claude
Local AI provider
AI-powered recommendations
AI content generation
Project Structure
AI_Sales_Agent/
├── client/
│   └── React frontend
│
├── server/
│   ├── AI services
│   ├── Controllers
│   ├── Routes
│   ├── Services
│   ├── Middleware
│   ├── Prisma
│   └── Tests
│
├── package.json
├── README.md
└── .env.example
Getting Started

Clone repository:

git clone YOUR_REPOSITORY_URL
cd AI_Sales_Agent

Install dependencies:

npm install
cd client
npm install
cd ../server
npm install
Environment Setup

Create environment files.

Use:

.env.example

Never commit real secrets.

Database

Configure PostgreSQL.

Update your environment variables.

Run:

npx prisma generate
npx prisma db push

Run migrations if required:

npx prisma migrate dev
Development

Start frontend:

cd client
npm run dev

Start backend:

cd server
npm run dev
Testing

Run backend tests:

cd server
npm test
Security

Never commit secrets.

Never commit .env.

Keep API keys private.

Purpose

AI Sales Agent helps teams.

It reduces manual sales work.

It improves sales decision-making.

It centralizes sales operations.

Status

Active development.

Built by Gyaankool Research Labs.
