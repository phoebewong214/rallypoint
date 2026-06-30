# RallyPoint

> AI-powered sports partner matching for everyday players.
> Northwestern University · ACIS 498 Capstone
>
> **Live demo:** https://app.tryrallypoint.com

RallyPoint matches tennis and pickleball players on **skill (NTRP/DUPR)**, **weekly schedule overlap**, **court proximity**, and a semantic **playing-style** signal from bio embeddings — then explains *why* with transparent reason chips. An optional LLM rewrites the reason wording when an OpenAI key is set; it never affects the score.

---

## Screenshots

> _Add screenshots to `docs/screenshots/` and reference them here._
>
> - `find.png` — Find Partner page (live AI matches)
> - `profile.png` — Profile with the preferred-times grid
> - `sessions.png` — Sessions timeline
> - `dark.png` — Dark mode

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 19 + TypeScript + Vite** | Fast HMR (~1s startup), TS catches API/data shape errors |
| Routing | **react-router-dom v7** | Standard; `NavLink` makes active state trivial |
| Data fetching | **TanStack Query** | Cache, retry, loading/error states out of the box |
| Auth (client) | **AuthContext + httpOnly-cookie JWT + CSRF** | JWT in an httpOnly cookie (JS never holds it); double-submit CSRF token; validated against `/api/auth/me` on mount |
| Backend | **Flask 3 + SQLAlchemy + Flask-Migrate** | Familiar Python web stack for capstone scope |
| DB | **SQLite (dev) → PostgreSQL (prod)** | Switch via `DATABASE_URL` env var, no code change |
| Auth (server) | **PyJWT (HS256) + Flask-Limiter** | 7-day tokens; login limited to 10/min, signup 5/min |
| Validation | **Pydantic v2** | Type-safe request bodies, structured 422 errors |
| AI matching | **Explainable heuristic + semantic embeddings** | `/players` scores skill, schedule-grid overlap, proximity, and shared court, plus a bio-embedding "playing style" signal — each emits a reason chip; optional `/ai/match-reason` LLM rewrites wording only, cached in `ai_match_logs` |

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

The frontend reads its API base URL from `VITE_API_URL`. Local development uses
`frontend/.env.development` to point at `http://localhost:5050/api`; production
deployments must set `VITE_API_URL` in Vercel to the deployed Render API, for
example `https://api.yourdomain.com/api`. Demo partner fallback is enabled
automatically in Vite dev mode; production builds only show sample partners
when `VITE_DEMO_FALLBACK=true` is set explicitly.

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
                     │  AuthContext  ──► user    │
                     │  TanStack Query  cache    │
                     └─────────┬────────────────┘
                               │ Cookie: rp_session
                               │ X-CSRF-Token on writes
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
                     │  /auth /players /courts  │
                     │  /sessions /invites      │
                     │  /appointments /admin    │
                     │  /support /ai            │
                     └─────────┬────────────────┘
                               │
                     ┌─────────▼────────────────┐
                     │  SQLAlchemy ORM          │
                     │  ~12 tables: users,      │
                     │   sport_profiles, courts,│
                     │   availability_slots,    │
                     │   sessions, game_invites,│
                     │   court_favorites,       │
                     │   saved_players,         │
                     │   appointments, checkins,│
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
| POST | `/auth/login` | — | rate-limited 10/min; sets httpOnly session + CSRF cookies and returns token for API clients/tests |
| GET | `/auth/me` | cookie/Bearer | refresh cached user |
| GET | `/players?sport=&ntrpMin=&ntrpMax=` | cookie/Bearer | match-scored candidates (tier + reason chips) |
| GET | `/sessions` | cookie/Bearer | bucketed (upcoming/requests/past) |
| POST | `/sessions` | cookie/Bearer + CSRF | create new |
| POST | `/sessions/<id>/accept` | cookie/Bearer + CSRF | guest only |
| POST | `/sessions/<id>/decline` | cookie/Bearer + CSRF | guest only |
| POST | `/ai/match-reason` | cookie/Bearer + CSRF | heuristic or LLM on-demand reason |
| GET | `/courts?sport=&q=` | cookie/Bearer | real courts + distance/regulars/upcoming |
| GET | `/courts/<slug>` | cookie/Bearer | single court |
| POST/DELETE | `/courts/<slug>/favorite` | cookie/Bearer + CSRF | (un)favorite a court |
| POST/DELETE | `/courts/<slug>/checkin` | cookie/Bearer + CSRF | "here now" busy signal (~2h) |
| POST | `/courts/<slug>/appointments` · `/appointments/<id>/join\|leave` | cookie/Bearer + CSRF | open games + waitlist |
| GET/POST | `/invites` · `/players/<id>/save` | cookie/Bearer (+CSRF) | two-phase game invites; (un)save a player |
| GET/POST | `/admin/*` · `/support` | admin / cookie | admin dashboard; in-app support message |

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
│       ├── pages/           ← route components
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
    ├── models/              ← SQLAlchemy models
    ├── routes/              ← Flask blueprints (auth/players/sessions/courts/appointments/invites/admin/support/ai)
    ├── schemas/             ← Pydantic request bodies
    ├── services/            ← auth (JWT), matching, embeddings, email, support
    ├── utils/               ← @require_auth, parse_json
    └── tests/               ← pytest
```

---

## Development workflow

```bash
# Backend tests
cd backend && .venv/bin/pytest

# Frontend type check + tests + production build
cd frontend && npm run typecheck && npm test && npm run build

# Reseed database (destructive)
cd backend && .venv/bin/python seed.py
```

CI runs both on every push — see `.github/workflows/ci.yml`.

---

## Roadmap

- [x] Switch SQLite → Postgres in deployment (live on Render)
- [x] Geocoded distance (Haversine on court lat/lng)
- [x] Explainable matching: tier + reason chips over real signals
- [x] Semantic "playing style" matching via bio embeddings (real AI)
- [x] Weekly preferred-times grid for schedule-overlap scoring
- [x] Court check-ins, open games, and two-phase game invites
- [x] Admin dashboard + in-app support widget
- [x] Flask-Migrate (Alembic) for schema migrations
- [ ] WebSocket presence for "online now"
- [ ] OAuth (Google) instead of email/password
- [ ] Wire `ai_match_logs` on the served path → learning-to-rank

---

## License

MIT — see [LICENSE](./LICENSE) (TODO).

## Authors

- Phoebe Wang ([@phoebewong214](https://github.com/phoebewong214))
