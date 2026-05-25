Car Rental System (Web Application)
📌 APP CONTEXT
Type: Web Application
Scale: MVP → Small Scale
Team Size: 1–3 Developers
Timeline: MVP in 4–6 weeks
🧱 STACK OVERVIEW
Architecture Pattern
Monolithic Architecture
Deployment Strategy
Frontend and backend deployed separately
REST API communication
Justification
Easier to build and manage for small teams
Faster development cycle
Low infrastructure complexity
Alternatives Considered
Microservices → Rejected (too complex for MVP)
Serverless → Rejected (cost unpredictability + complexity)
🎨 FRONTEND STACK
Framework
Next.js 14.1.0
📄 Docs: https://nextjs.org/docs
License: MIT

Reason:

Built-in routing + SSR support
Fast performance

Alternatives:

React (manual setup) → rejected
Angular → heavy for MVP
Language
TypeScript 5.3.3
📄 Docs: https://www.typescriptlang.org/docs/

Reason:

Type safety
Better debugging
Styling
Tailwind CSS 3.4.1
📄 Docs: https://tailwindcss.com/docs

Reason:

Fast UI development
Utility-first

Alternative: Bootstrap → less flexible

State Management
Zustand 4.5.2
📄 Docs: https://docs.pmnd.rs/zustand

Reason:

Lightweight
Easy to use

Alternative: Redux → too complex

Form Handling
React Hook Form 7.49.2
📄 Docs: https://react-hook-form.com

Reason:

Minimal re-renders
Easy validation
HTTP Client
Axios 1.6.7
📄 Docs: https://axios-http.com

Reason:

Simpler API handling
Routing
Next.js Built-in Router
UI Components
shadcn/ui (latest stable commit snapshot)
📄 Docs: https://ui.shadcn.com

Reason:

Clean modern UI
Customizable
⚙️ BACKEND STACK
Runtime
Node.js 20.11.1 (LTS)
📄 Docs: https://nodejs.org
Framework
Express.js 4.18.2
📄 Docs: https://expressjs.com

Reason:

Simple and widely used
Database
MySQL 8.0.36
📄 Docs: https://dev.mysql.com/doc/

Reason:

Reliable relational DB
Easy for student projects
ORM
Prisma 5.9.1
📄 Docs: https://www.prisma.io/docs

Reason:

Easy schema management
Auto-generated queries
Caching
Redis 7.2.4
📄 Docs: https://redis.io/docs

Reason:

Fast caching for sessions
Authentication
JWT (jsonwebtoken 9.0.2)
📄 Docs: https://github.com/auth0/node-jsonwebtoken
File Storage
Local storage (MVP)
Email
Nodemailer 6.9.8
📄 Docs: https://nodemailer.com
🗄️ DATABASE SCHEMA
Migration Strategy
Prisma Migrate
Seeding
Initial sample cars + admin account
Backup Policy
Daily backup (manual or cron job)
Connection Pooling
Enabled via Prisma
☁️ DEVOPS & INFRASTRUCTURE
Version Control
Git (GitHub)
Branching:
main
dev
feature/*
CI/CD
GitHub Actions
Hosting
Frontend: Vercel
Backend: Railway
Database: Railway MySQL
Monitoring
Logs: Console + server logs
Errors: Basic logging
Testing
Unit: Jest 29.7.0
E2E: Playwright 1.41.2
🛠️ DEVELOPMENT TOOLS
Linter
ESLint 8.56.0
Formatter
Prettier 3.2.5
Git Hooks
Husky 9.0.11
IDE
VS Code
🔐 ENVIRONMENT VARIABLES
DATABASE_URL="mysql connection string"
JWT_SECRET="secret key for authentication"
PORT="backend port"
EMAIL_USER="email service username"
EMAIL_PASS="email password"
REDIS_URL="redis connection url"
NEXT_PUBLIC_API_URL="frontend API base URL"
📦 PACKAGE.JSON SCRIPTS
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node server.js",
    "test": "jest",
    "lint": "eslint .",
    "format": "prettier --write .",
    "db:migrate": "prisma migrate dev",
    "db:seed": "node prisma/seed.js"
  }
}
📚 DEPENDENCIES LOCK
// Frontend
{
  "next": "14.1.0",
  "react": "18.2.0",
  "typescript": "5.3.3",
  "tailwindcss": "3.4.1",
  "zustand": "4.5.2",
  "react-hook-form": "7.49.2",
  "axios": "1.6.7"
}
// Backend
{
  "express": "4.18.2",
  "prisma": "5.9.1",
  "mysql2": "3.9.1",
  "jsonwebtoken": "9.0.2",
  "bcrypt": "5.1.1",
  "redis": "4.6.13",
  "nodemailer": "6.9.8"
}
🔒 SECURITY CONSIDERATIONS
Password hashing: bcrypt (10 rounds)
JWT expiry: 1 hour
CORS: Allow frontend domain only
Rate limiting: 100 requests/min
HTTPS required
Input validation on all forms
🔄 VERSION UPGRADE POLICY
Major updates: every 6 months
Security patches: immediate
Testing:
Run all unit tests before upgrade
Rollback:
Use previous Git tag
Redeploy stable version