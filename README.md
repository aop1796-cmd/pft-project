# Virtual Mechanics Lab – Experiment 5

> **Collision of Elastic Bodies** — A full-stack virtual laboratory for engineering students at **St. John College of Engineering and Management, Palghar (Semester I)**.

---

## 🚀 Quick Start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173  
- API:      http://localhost:4000  
- Database: localhost:5432

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + CSS Variables |
| State | Zustand |
| Charts | Recharts |
| Simulator | HTML Canvas |
| Formulas | KaTeX |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT (httpOnly cookies) + bcrypt |
| PDF | Puppeteer |
| Validation | Zod |

---

## 🛠 Manual Setup (Development)

### Prerequisites

- Node.js ≥ 18
- PostgreSQL 14+
- npm or pnpm

### 1. Clone & install

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Environment

```bash
cp .env.example .env
# Edit DATABASE_URL and JWT secrets
```

### 3. Database setup

```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Start dev servers

```bash
# Terminal 1 – API
cd server && npm run dev

# Terminal 2 – Frontend
cd client && npm run dev
```

---

## 👤 Default Seed Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sjcem.edu.in | Admin@123 |
| Teacher | teacher@sjcem.edu.in | Teacher@123 |
| Student | student@sjcem.edu.in | Student@123 |

---

## 🧪 Running Tests

```bash
# API tests
cd server && npm test

# Frontend unit tests
cd client && npm test
```

---

## 📁 Project Structure

```
pft/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── stores/       # Zustand stores
│   │   ├── hooks/        # Custom hooks
│   │   ├── utils/        # Physics calculations
│   │   └── types/        # TypeScript types
│   └── Dockerfile
├── server/               # Express + Prisma backend
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── middleware/   # Auth, validation, rate limiting
│   │   ├── services/     # Business logic
│   │   └── utils/        # Helpers
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 🌐 Deployment

| Service | Platform |
|---------|---------|
| Frontend | Vercel / Netlify |
| API + DB | Render / Railway |

Set the environment variables per platform from `.env.example`.

---

## 📖 Physics

The coefficient of restitution is defined as:

```
e = -(V_A - V_B) / (U_A - U_B)
```

Where velocities are computed from projectile landing distances:

```
U_A = √(2gh)    V_A = X_A / t
U_B = 0         V_B = X_B / t
t = √(2y/g)     g = 9.81 m/s²
```

---

## 📜 License

MIT — St. John College of Engineering and Management, Palghar
