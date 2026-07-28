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
          │                  │ user_id  FK      │         │ game_invites    │
          │                  │ day_of_week 0-6  │         │─────────────────│
          │                  │ time_band        │         │ id  PK          │
          │                  │ status 0|1|2     │         │ proposer_id  FK │
          │                  └──────────────────┘         │ invitee_id  FK  │
          │                                                │ court_id  FK    │
          │1     2*  ┌────────────────────┐               │ proposed_at     │
          ├──────────│ sessions           │               │ phase / status  │
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
- **Newer tables** extend the core: `saved_players` (server-backed player
  bookmarks), `court_favorites`, `court_appointments` + `appointment_participants`
  (open games with a waitlist), `court_checkins` (a ~2h "here now" signal), and
  `game_invites` (the two-phase request / time-negotiation flow). `feed_posts`
  was removed along with the Community feed.
- `users.bio_embedding` stores a JSON OpenAI vector of the bio; matching adds a
  semantic "playing style" signal from the cosine similarity of two bios, and
  degrades gracefully to nothing when an embedding or API key is missing.

---

## Request flow

A typical "Find Partner" request:

```
Browser (React)                Flask backend                 SQLite/Postgres
───────────────                ─────────────                 ──────
usePlayers({sport:"Pickleball",
            ntrpMin:3,
            ntrpMax:4})
      │
      ▼
GET /api/players?sport=...
Cookie: rp_session
(or Authorization: Bearer <jwt> for API/test clients)
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
                                  no writes on the hot GET path
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

### ADR-004: JWT in an httpOnly cookie + CSRF double-submit (migrated from localStorage)

**Decision:** Store the JWT in an httpOnly cookie the browser sends automatically (`credentials: "include"`); defend unsafe methods with a double-submit CSRF token — a readable `rp_csrf` cookie echoed in an `X-CSRF-Token` header. JS never holds the token; `localStorage` caches only the non-secret user object for instant first paint.
**Why:** The original capstone build kept the JWT in `localStorage` (simplest — no CSRF or cookie-domain setup) but that is XSS-exfiltratable. We migrated to the httpOnly-cookie + CSRF approach this ADR originally flagged as the production target.
**Trade-off:** More setup (cookie domain across frontend/backend, CSRF echo on writes) in exchange for a token unreachable from JavaScript.
**Superseded:** localStorage JWT + `Authorization: Bearer` (XSS-exfiltratable); also rejected server-side sessions (server state — defeats the stateless API).

### ADR-005: Pydantic v2 for request validation

**Decision:** Validate every POST/PUT body with a Pydantic schema.
**Why:** Type-safe, declarative, returns structured field-level error messages. Better than hand-rolled `data.get(...)` checks.
**Rejected:** Marshmallow (older API, more verbose), Flask-WTF (form-oriented, not JSON), no validation (production-broken).

### ADR-006: SQLite for dev, Postgres-ready

**Decision:** Default `DATABASE_URL=sqlite:///rallypoint.db`. Production sets it to Postgres.
**Why:** Zero setup for contributors, identical SQLAlchemy ORM code regardless of backend. `psycopg2-binary` is already in `requirements.txt`.
**Caveat:** SQLite's single-writer lock makes it unsuitable for multi-user concurrency. Switch before any user load.

### ADR-007: Explainable matching (transparent heuristic + semantic embeddings); optional LLM for wording only

**Decision:** `/api/players` produces a transparent score (0-100) from real signals, each emitting a human-readable reason chip: skill closeness (0-36, dominant), court proximity by great-circle distance (0-20, continuous), weekly preferred-times grid overlap (0-16), shared home court (0-12), a genuine AI signal — semantic "playing style" similarity (0-12) from the cosine of two players' bio embeddings — and same primary sport (+4). Weights sum to exactly 100 (`SCORE_VERSION = 2`; v1 summed to 125 and clamped, which flattened ranking at the top). The score is tiered (great ≥ 56 / good ≥ 36 / worth-a-try). The served path writes no match logs. A separate, optional `/api/ai/match-reason` endpoint can call `gpt-4o-mini` to rewrite the reason *text only* (cached in `ai_match_logs`); it never affects the score.
**Why:**
- Transparent + auditable: every point maps to a reason chip — no black box, and no fake "AI Match" label.
- Real AI where it helps: the embedding signal adds genuine semantic matching and degrades gracefully to zero with no bio (or a bio under `MIN_BIO_CHARS` — near-empty bios embed to noise) or no API key, so it only ever adds information. Its cosine→points window is env-tunable (`SEMANTIC_SIM_LO`/`SEMANTIC_SIM_HI`); `python manage.py calibrate-semantic` prints the real pairwise-similarity distribution and a suggested window.
- The served list stays fast and side-effect free; the LLM is bounded (wording only, cached).
**Rejected:** LLM-only ranker (cost + latency + hallucinated, unauditable justifications), a fake "AI" badge over a heuristic (removed), pure trained-ML ranker (needs a labeled accept/decline history — now being collected, see ADR-011).

### ADR-011: Training data via invite-time snapshots, not hot-path logging

**Decision:** When an invite is sent, `routes/invites.py` upserts an `ai_match_logs` row freezing the pair's score, per-signal point breakdown (`signals` JSON), and `score_version` — in its own transaction after the invite commits, so a snapshot failure can never break the invite. Accept / confirm-opponent / decline later stamp `outcome` + `outcome_at` on that frozen row (the label attaches to the score that was actually shown, never a recomputed one).
**Why:** The heuristic's weights are hand-picked. Once enough labeled rows accumulate, a simple logistic regression of `outcome` on `signals` re-fits the weights from real accept/decline behavior — impossible without the breakdown, and unpriceable later (missed impressions never come back). The invite POST paths are low-frequency writes; the hot `/api/players` GET stays write-free.
**Rejected:** logging every candidate on every GET (the write amplification ADR-007 removed), logging total score only (can't re-fit weights from a collapsed sum).

### ADR-008: Flask-Limiter on auth routes

**Decision:** 5/min on `/signup`, 10/min on `/login`, 200/min global default.
**Why:** Blocks naive credential brute-force without making legitimate development annoying.
**Rejected:** No rate limit (insecure), nginx-level limit (couples app to a specific deploy).

### ADR-009: Migrations are the deploy path (`manage.py upgrade-db`); `init-db` demoted to dev convenience

**Decision:** Deploys run `python manage.py upgrade-db` at startup: a fresh DB gets the full Alembic chain; a DB that predates migrations (built by the old `create_all` bootstrap) is adopted once via `flask db stamp` at `LEGACY_STAMP_REVISION`, then upgraded; a migrated DB just applies pending revisions. Runs at web startup (still no paid release job needed on Render's free tier) and is idempotent. `init-db` remains for local dev; `seed.py` remains dev-only and destructive.
**Why:** Production now holds real user data — schema changes must be versioned, reviewable, and rollback-able. `create_all` never alters existing tables, silently missing anything but new-table changes (the `_ensure_columns` patch list it required was drift codified).
**Superseded:** startup `create_all` + hand-maintained `_ensure_columns` (kept only to heal legacy DBs at adoption time).

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
| Token theft via XSS | JWT in httpOnly cookie — unreachable from JS; logout on 401 | ✅ |
| CSRF | Double-submit token (`rp_csrf` cookie echoed in `X-CSRF-Token`) on unsafe methods | ✅ |
| Password storage | werkzeug `generate_password_hash` (scrypt) | ✅ |
| CORS | Allowlist of origins from `CORS_ORIGINS` env | ✅ |
| Dev SECRET_KEY leaking into prod | Boot refuses to start when `DATABASE_URL` is Postgres but `SECRET_KEY` is the dev default | ✅ |
| Blind production errors | Sentry via `SENTRY_DSN` env (no-op when unset) | ✅ code-side — set the DSN in Render |
| Rate limit storage in-memory | OK for single-instance dev | ⚠️ Use Redis in prod |

---

## Performance characteristics

- **Frontend dev startup:** ~1s (Vite)
- **Frontend prod bundle:** ~250 KB gzipped (React 19 + Router + TQ)
- **Backend cold start:** ~600ms (Flask + SQLAlchemy)
- **`/api/players` typical latency:** <50ms for 6 candidates (heuristic path)
- **`/api/ai/match-reason` with OpenAI:** ~2s for one on-demand reason; batch/background generation would need a worker queue
- **DB:** SQLite single-writer; first bottleneck under concurrent load

---

## Open questions

1. ~~Structured availability matching~~ **(done)** — matching now scores overlap of the real weekly `availability_slots` grid, not free-text summaries.
2. **Real-time presence** — "online now" and new-session notifications are still static/poll-driven. Polling vs WebSocket vs SSE?
3. ~~Production migrations~~ **(done)** — deploys run `manage.py upgrade-db` (Alembic); legacy DBs are stamp-adopted (ADR-009).
4. **Frontend design system** — `rally-shared.css` is effective but large; split tokens, shared components, and page styles before the next major UI expansion.
5. **Weight re-fit** — once `ai_match_logs` accumulates enough labeled rows (ADR-011), regress outcomes on the signal breakdown and replace the hand-picked weights; bump `SCORE_VERSION`.
6. **Semantic window calibration** — run `manage.py calibrate-semantic` against prod once enough bios have embeddings; set `SEMANTIC_SIM_LO/HI` accordingly.
