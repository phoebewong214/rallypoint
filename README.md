# RallyPoint

> AI-powered sports partner matching for college players.
> Northwestern University · ACIS 498 Capstone
>
> **Live demo:** https://app.tryrallypoint.com

RallyPoint matches tennis and pickleball players on **skill (NTRP)**, **schedule overlap**, and **court proximity**, then explains *why* each match makes sense — heuristically by default, or via an LLM when an OpenAI key is provided.

---

## Screenshots

> _Add screenshots to `docs/screenshots/` and reference them here._
>
> - `find.png` — Find Partner page (live AI matches)
> - `profile.png` — Profile with availability heatmap
> - `sessions.png` — Sessions timeline
> - `dark.png` — Dark mode

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 19 + TypeScript + Vite** | Fast HMR (~1s startup), TS catches API/data shape errors |
| Routing | **react-router-dom v7** | Standard; `NavLink` makes active state trivial |
| Data fetching | **TanStack Query** | Cache, retry, loading/error states out of the box |
| Auth (client) | **AuthContext + localStorage JWT** | Token validated against `/api/auth/me` on every mount |
| Backend | **Flask 3 + SQLAlchemy + Flask-Migrate** | Familiar Python web stack for capstone scope |
| DB | **SQLite (dev) → PostgreSQL (prod)** | Switch via `DATABASE_URL` env var, no code change |
| Auth (server) | **PyJWT (HS256) + Flask-Limiter** | 7-day tokens; login limited to 10/min, signup 5/min |
| Validation | **Pydantic v2** | Type-safe request bodies, structured 422 errors |
| AI matching | **Heuristic scoring + optional OpenAI** | Falls back gracefully; results cached in `ai_match_logs` |

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 20+
- (Optional) PostgreSQL if you want to skip SQLite

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # edit SECRET_KEY for prod
python seed.py                   # creates DB + sample users
python app.py                    # → http://localhost:5050
```

Test login:
```bash
curl -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@rally.app","password":"rally1234"}'
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # → http://localhost:3000
```

The frontend reads `VITE_API_URL` from `.env.development`
(defaults to `http://localhost:5050/api`).

### Sample logins (after `python seed.py`)

| Email | Password | Role |
|---|---|---|
| `alex@rally.app` | `rally1234` | The "you" user — has sessions |
| `maya@rally.app` | `rally1234` | Pickleball 3.5, best match |
| `jordan@rally.app` | `rally1234` | Tennis 4.0 |
| `marcus@rally.app` | `rally1234` | Tennis 4.5 |
| `sofia@rally.app` | `rally1234` | Pickleball 3.0 |
| `aisha@rally.app` | `rally1234` | Pickleball 3.5 |

---

## Architecture (high-level)

```
                     ┌──────────────────────────┐
                     │  React + Vite (port 3000) │
                     │                          │
                     │  AuthContext  ──► JWT in │
                     │  TanStack Query  localStorage
                     └─────────┬────────────────┘
                               │ Authorization: Bearer <jwt>
                               ▼
                     ┌──────────────────────────┐
                     │  Flask 3 (port 5050)     │
                     │                          │
                     │  ┌────────────────────┐  │
                     │  │ @require_auth      │  │  validates JWT
                     │  │ Pydantic schemas   │  │  validates body
                     │  │ Flask-Limiter      │  │  brute-force guard
                     │  └────────────────────┘  │
                     │                          │
                     │   /auth /players         │
                     │   /sessions  /ai         │
                     └─────────┬────────────────┘
                               │
                     ┌─────────▼────────────────┐
                     │  SQLAlchemy ORM          │
                     │  7 tables: users,        │
                     │   sport_profiles,        │
                     │   courts, sessions,      │
                     │   availability_slots,    │
                     │   court_favorites,       │
                     │   ai_match_logs          │
                     └─────────┬────────────────┘
                               │
                            SQLite (dev)
                         or Postgres (prod)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data model + ADRs (architecture
decision records explaining *why* each choice was made).

---

## API surface

All endpoints under `/api`. JSON in / JSON out.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | Liveness probe |
| POST | `/auth/signup` | — | rate-limited 5/min; Pydantic-validated |
| POST | `/auth/login` | — | rate-limited 10/min; returns JWT |
| GET | `/auth/me` | JWT | refresh cached user |
| GET | `/players?sport=&ntrpMin=&ntrpMax=` | JWT | AI-scored candidates |
| GET | `/sessions` | JWT | bucketed (upcoming/requests/past) |
| POST | `/sessions` | JWT | create new |
| POST | `/sessions/<id>/accept` | JWT | guest only |
| POST | `/sessions/<id>/decline` | JWT | guest only |
| POST | `/ai/match-reason` | JWT | heuristic or LLM (not yet wired to UI) |
| GET | `/courts?sport=&q=` | JWT | real courts + distance/regulars/upcoming |
| GET | `/courts/<slug>` | JWT | single court |
| POST/DELETE | `/courts/<slug>/favorite` | JWT | (un)favorite a court |

---

## Project layout

```
rallypoint/
├── README.md                ← you are here
├── ARCHITECTURE.md          ← data model, ADRs
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── .env.development     ← VITE_API_URL
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/             ← fetch wrapper + per-resource clients
│       ├── hooks/           ← TanStack Query hooks
│       ├── contexts/        ← Auth + Theme
│       ├── components/      ← ProtectedRoute, etc.
│       ├── pages/           ← 9 route components
│       ├── types/           ← shared TS types
│       ├── rally-shared.tsx ← TopNav + Icon + Avatar
│       └── rally-shared.css ← design tokens + all CSS
│
└── backend/
    ├── app.py               ← create_app factory + entry point
    ├── config.py
    ├── extensions.py        ← db, migrate, limiter
    ├── requirements.txt
    ├── seed.py              ← drop + create + sample data
    ├── .env.example
    ├── models/              ← 7 SQLAlchemy models
    ├── routes/              ← 5 blueprints (auth/players/sessions/courts/ai)
    ├── schemas/             ← Pydantic request bodies
    ├── services/            ← auth (JWT), matching (AI)
    ├── utils/               ← @require_auth, parse_json
    └── tests/               ← pytest
```

---

## Development workflow

```bash
# Backend tests
cd backend && .venv/bin/pytest

# Frontend type check + production build
cd frontend && npm run build

# Reseed database (destructive)
cd backend && .venv/bin/python seed.py
```

CI runs both on every push — see `.github/workflows/ci.yml`.

---

## Roadmap

- [x] Switch SQLite → Postgres in deployment (live on Render)
- [x] Geocoded distance (Haversine on court lat/lng)
- [ ] WebSocket presence for "online now"
- [ ] OAuth (Google) instead of email/password
- [ ] Mobile bottom tab bar
- [ ] Background AI matching with Celery (currently sync per request)

---

## License

MIT — see [LICENSE](./LICENSE) (TODO).

## Authors

- Phoebe Wang ([@phoebewong214](https://github.com/phoebewong214))
