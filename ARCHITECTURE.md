# Architecture

This document captures the data model and the *why* behind key technical
decisions. Read this if you're picking up the codebase, joining the project,
or evaluating it.

---

## Data model

```
┌──────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ users            │1       *│ sport_profiles   │*       1│ courts          │
│──────────────────│─────────│──────────────────│─────────│─────────────────│
│ id  PK           │         │ id  PK           │         │ id  PK          │
│ email  unique    │         │ user_id  FK      │         │ slug  unique    │
│ password_hash    │         │ sport            │         │ name            │
│ name             │         │ ntrp             │         │ address         │
│ handle  unique   │         │ availability_summary       │ lat, lng        │
│ location         │         │ home_court_id  FK──────────│ primary_sport   │
│ bio              │         └──────────────────┘         │ sports (csv)    │
│ primary_sport    │                                      │ court_count     │
│ avatar_color/fg  │         ┌──────────────────┐         │ surface, lights │
│ created_at       │1       *│ availability_slots│        └─────────────────┘
└─────────┬────────┘─────────│──────────────────│
          │                  │ id  PK           │         ┌─────────────────┐
          │                  │ user_id  FK      │         │ feed_posts      │
          │                  │ day_of_week 0-6  │         │─────────────────│
          │                  │ time_band        │         │ id  PK          │
          │                  │ status 0|1|2     │         │ author_id  FK   │
          │                  └──────────────────┘         │ type (enum)     │
          │                                                │ text            │
          │1     2*  ┌────────────────────┐               │ match_id  FK    │
          ├──────────│ sessions           │               │ likes/comments  │
          │          │────────────────────│               │ created_at      │
          │          │ id  PK             │               └─────────────────┘
          │          │ host_id  FK        │
          │          │ guest_id  FK       │               ┌─────────────────┐
          │          │ court_id  FK       │               │ ai_match_logs   │
          │          │ sport              │               │─────────────────│
          │          │ scheduled_at       │               │ id  PK          │
          │          │ status (enum)      │               │ viewer_id  FK   │
          │          │ result W|L, score  │               │ candidate_id FK │
          │          └────────────────────┘               │ sport           │
          │                                                │ score 0-100     │
          │1                                          *   │ reason          │
          └────────────────────────────────────────────────│ source: heur|ai │
                                                          │ outcome (later) │
                                                          │ created_at      │
                                                          └─────────────────┘
```

**Cardinality notes:**

- A `User` has **0..N `SportProfile`s** (typically 1–2 — Tennis + Pickleball).
  NTRP, availability, and home court are per-sport, not per-user, because a
  3.5 pickleball player can be a 4.0 tennis player.
- A `Session` connects exactly **two users**: `host_id` (initiator) +
  `guest_id` (invitee). The host's perspective ("sent by me") is implicit
  from the viewer's id.
- `AIMatchLog` has a **unique constraint on `(viewer_id, candidate_id, sport)`**
  so re-running matching updates the row rather than appending. This makes
  the AI verdict stable across page loads.

---

## Request flow

A typical "Find Partner" request:

```
Browser (React)                Flask backend                 SQLite
───────────────                ─────────────                 ──────
usePlayers({sport:"Pickleball",
            ntrpMin:3,
            ntrpMax:4})
      │
      ▼
GET /api/players?sport=...
Authorization: Bearer <jwt>
      │
      └─────────────────────►  @require_auth
                                  │ decode JWT → user_id
                                  │ User.query.get(user_id)
                                  ▼
                               list_players()
                                  │ SELECT users JOIN sport_profiles
                                  │ WHERE sport = ? AND ntrp BETWEEN ?
                                  ▼ ────────────────────────► candidates
                               for each candidate:
                                  score_and_reason(viewer, cand)
                                  upsert AIMatchLog cache
                                  │
                                  ▼ ──────────────────────────► commit
                               return JSON
      │
      ◄─────────────────────  { players: [...], count: N }
TanStack Query caches by
queryKey ['players', filters]
for staleTime: 30s
```

---

## ADRs (Architecture Decision Records)

Short rationale for every non-obvious choice. Format: **decision → why → alternatives rejected**.

### ADR-001: Vite over Create React App

**Decision:** Use Vite + esbuild + native ESM for dev.
**Why:** CRA is officially deprecated; Vite cold-start is ~10× faster (1s vs 10s+) and HMR is sub-100ms. Less bundler config too.
**Rejected:** Next.js (overkill — we're a pure SPA), Parcel (smaller community).

### ADR-002: TypeScript with loose `strict` mode

**Decision:** Adopt TS but keep `strict: false`, `noImplicitAny: false` for the initial migration.
**Why:** Full strict TS would have required typing 40+ data constants on day one; loose mode gets the IDE benefits (autocomplete, refactor) without blocking velocity. Tighten file-by-file later.
**Rejected:** Full strict from day one (too slow), plain JS (no type safety on API contracts).

### ADR-003: TanStack Query over SWR or plain fetch

**Decision:** TanStack Query for all server state.
**Why:** Built-in cache, retry, loading/error states, devtools, mutation patterns. SWR is similar but smaller community for React 19.
**Rejected:** Redux Toolkit Query (heavier, redundant with TQ in 2025), bare `useEffect + fetch` (every page reinvents loading/error).

### ADR-004: JWT in localStorage (not httpOnly cookies)

**Decision:** Store JWT in `localStorage`, send via `Authorization: Bearer`.
**Why:** Simplest path for a capstone SPA — no CSRF concerns, no cookie domain config across frontend/backend ports.
**Trade-off:** Vulnerable to XSS exfiltration. Mitigation: short-lived tokens (7 days), CSP headers in production, strict React escaping. Production should migrate to httpOnly cookies + CSRF tokens.
**Rejected:** httpOnly cookies (more setup), sessions (server state — defeats stateless API).

### ADR-005: Pydantic v2 for request validation

**Decision:** Validate every POST/PUT body with a Pydantic schema.
**Why:** Type-safe, declarative, returns structured field-level error messages. Better than hand-rolled `data.get(...)` checks.
**Rejected:** Marshmallow (older API, more verbose), Flask-WTF (form-oriented, not JSON), no validation (production-broken).

### ADR-006: SQLite for dev, Postgres-ready

**Decision:** Default `DATABASE_URL=sqlite:///rallypoint.db`. Production sets it to Postgres.
**Why:** Zero setup for contributors, identical SQLAlchemy ORM code regardless of backend. `psycopg2-binary` is already in `requirements.txt`.
**Caveat:** SQLite's single-writer lock makes it unsuitable for multi-user concurrency. Switch before any user load.

### ADR-007: Heuristic AI matching with optional LLM upgrade

**Decision:** Default scoring is deterministic (NTRP closeness + same primary sport + same city + availability overlap). If `OPENAI_API_KEY` is set, route to `gpt-4o-mini` for the *reason* string.
**Why:**
- Deterministic = testable, cheap, no external dependency.
- LLM-generated reasons are warmer and more specific, which is the "AI" part users care about visually.
- Cached in `ai_match_logs` so a re-render doesn't re-bill the API.
**Rejected:** LLM-only (cost + latency + non-determinism), pure ML (out of scope for capstone).

### ADR-008: Flask-Limiter on auth routes

**Decision:** 5/min on `/signup`, 10/min on `/login`, 200/min global default.
**Why:** Blocks naive credential brute-force without making legitimate development annoying.
**Rejected:** No rate limit (insecure), nginx-level limit (couples app to a specific deploy).

### ADR-009: Skip Flask-Migrate for now, use `seed.py` with drop+create

**Decision:** No migrations during pre-launch iteration; `seed.py` drops and recreates schema.
**Why:** Schema is changing weekly. Migrations would slow iteration with no benefit when there's no production data to preserve.
**Trigger to revisit:** First production deploy or any time real user data exists.

### ADR-010: Dark mode via CSS variable overrides

**Decision:** `[data-theme="dark"]` selector overrides design tokens; ThemeContext flips the attribute on `<html>`.
**Why:** No component code changes. Single CSS block. Respects system preference on first visit.
**Rejected:** Tailwind `dark:` variants (we don't use Tailwind), styled-components theming (extra runtime), prefers-color-scheme alone (no user override).

---

## Security model

| Threat | Mitigation | Status |
|---|---|---|
| Credential brute-force | Flask-Limiter on `/login` (10/min) | ✅ |
| SQL injection | SQLAlchemy parameterized queries | ✅ |
| XSS | React auto-escapes by default | ✅ |
| Malformed input → 500 | Pydantic schemas → 422 with details | ✅ |
| Auth header spoofing (X-User-Id) | Replaced with HS256-signed JWT | ✅ |
| Token theft via XSS | Short-lived (7-day) tokens; logout on 401 | ⚠️ Better: httpOnly cookies |
| CSRF | N/A while token is in localStorage (not auto-sent) | ⚠️ Re-eval after cookie migration |
| Password storage | werkzeug `generate_password_hash` (scrypt) | ✅ |
| CORS | Allowlist of origins from `CORS_ORIGINS` env | ✅ |
| Rate limit storage in-memory | OK for single-instance dev | ⚠️ Use Redis in prod |

---

## Performance characteristics

- **Frontend dev startup:** ~1s (Vite)
- **Frontend prod bundle:** ~250 KB gzipped (React 19 + Router + TQ)
- **Backend cold start:** ~600ms (Flask + SQLAlchemy)
- **`/api/players` typical latency:** <50ms for 6 candidates (heuristic path)
- **`/api/players` with OpenAI:** ~2s × N candidates (sync, **needs Celery for any scale**)
- **DB:** SQLite single-writer; first bottleneck under concurrent load

---

## Open questions

1. **Geocoding** — every player's `distance` is hardcoded `"1.0"` in the backend response. Need lat/lng on users + Haversine vs viewer.
2. **Real-time** — "247 players online" / new session notifications are static. Polling vs WebSocket vs SSE?
3. **Availability matching** — current heuristic does fuzzy keyword overlap (`"weekends" ∩ "weekend mornings"`). Better: structured comparison of `availability_slots` rows.
4. **Mobile** — TopNav has 5 links + theme + user pill + logout. Doesn't scale below ~600px. Bottom tab bar?
