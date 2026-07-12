# TransitOps

Smart Transport Operations Platform — built for the Odoo Hackathon.

## Project structure

```
TransitOps/
├── client/          # React + Vite frontend
├── server/          # Express + Prisma API
└── package.json     # Root helper scripts
```

## Step 1: Authentication & RBAC (current)

- Email/password login and registration
- JWT session stored in httpOnly cookies
- Four roles: Fleet Manager, Driver, Safety Officer, Financial Analyst
- Protected routes on frontend and API
- Role-aware dashboard shell with navigation placeholders

## Quick start

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure the server

```bash
cp server/.env.example server/.env
```

### 3. Set up the database and seed demo users

```bash
npm run db:setup --prefix server
```

### 4. Run the app (two terminals)

**Terminal 1 — API**
```bash
npm run dev:server
```

**Terminal 2 — Frontend**
```bash
npm run dev:client
```

Open http://localhost:5173

## Demo accounts

All use password: `password123`

| Email | Role |
|---|---|
| fleet@transitops.demo | Fleet Manager |
| driver@transitops.demo | Driver |
| safety@transitops.demo | Safety Officer |
| finance@transitops.demo | Financial Analyst |

## Tech stack

- **Frontend:** React, TypeScript, Vite, React Router
- **Backend:** Node.js, Express, TypeScript
- **Database:** SQLite via Prisma
- **Auth:** bcrypt + JWT (httpOnly cookies)

## What's next

Vehicle, driver, trip, maintenance, fuel, and reports modules will be added in later steps.
