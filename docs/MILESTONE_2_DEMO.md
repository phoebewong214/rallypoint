# Milestone 2 — Backend Demo / Video Script

> Target length: **6–10 minutes**.
> Tool: QuickTime Player → File → New Screen Recording (or Zoom local recording).
>
> Companion deliverable docs (open these in tabs):
> [MILESTONE_2_SUBMISSION.md](./MILESTONE_2_SUBMISSION.md) ·
> [API reference](./MILESTONE_2_API_REFERENCE.md) ·
> [Database design](./MILESTONE_2_DATABASE_DESIGN.md) ·
> [Test results](./MILESTONE_2_TEST_RESULTS.md)

---

## Setup before pressing record

```bash
cd backend
source .venv/bin/activate
python seed.py          # fresh DB: 6 users, 8 courts, 6 sessions
python app.py           # starts on http://localhost:5050
```

Have these ready:
- Browser tabs: `http://localhost:5050/api/health` and
  `http://localhost:5050/api/docs/` (Swagger UI — the centerpiece).
- A second terminal in `backend/` for `python api_demo.py` and `pytest`.
- VS Code open with `app.py`, `models/`, `routes/`, `services/matching.py`.

Close noisy apps; phone on silent.

---

## 🎬 Demo flow

### Section 1 — Intro (45s)
> "Hi, I'm Phoebe. This is Milestone 2 of my capstone, RallyPoint — an
> AI-powered tennis and pickleball partner-matching app. Milestone 1 was the
> React front end; today is the **backend**: a Flask REST API with 55 endpoints
> over a 15-table SQLAlchemy database, JWT auth, Pydantic validation, and an
> explainable AI matching service."

Show the README architecture diagram briefly.

### Section 2 — Architecture (45s)
Open `app.py`: point at `create_app()` and `register_blueprints()`. Open
`routes/__init__.py` — **9 blueprints**: auth, players, sessions, ai, courts,
appointments, invites, admin, support.
> "It's an application factory with nine blueprints. Auth is JWT-based; every
> write body is validated by a Pydantic schema; auth routes are rate-limited."

### Section 3 — Database schema (90s) ⭐
Open `MILESTONE_2_DATABASE_DESIGN.md` and show the ER diagram, then the
`models/` folder.
> "The schema is 15 tables. A few design choices I want to call out:"
- `user.py` → "Profiles are **per sport** — `sport_profiles` — so someone can be
  a 4.0 tennis player and a 3.0 pickleball player."
- `session_model.py` → "A session links two users, host and guest, with a
  viewer-relative status."
- `game_invite.py` → "Two-phase invites — first you agree to play, then you settle
  the time — and when a time locks, a real `sessions` row is materialized."
- `ai_match_log.py` → "Match verdicts are cached with a unique constraint on
  `(viewer, candidate, sport)`, so calling it twice **upserts** instead of
  duplicating."

### Section 4 — Swagger UI (90s) ⭐⭐ centerpiece
Switch to `http://localhost:5050/api/docs/`.
1. Show the endpoint list grouped by tag.
2. Expand `POST /auth/login` → "Try it out" → `{ "email": "alex@rally.app",
   "password": "rally1234" }` → Execute → copy the token.
3. Click **Authorize**, paste `Bearer <token>`.
4. `GET /auth/me` → your user comes back.
5. `GET /players?sport=Pickleball` → **AI-scored matches** with `matchScore`,
   `matchTier`, and `matchReasons` chips.

### Section 5 — Validation + security (45s)
In Swagger, `POST /auth/signup` with `{ "email": "not-an-email", "password":
"short", "name": "" }` → show the **structured 422** with field errors.
> "Bad input never crashes the API — Pydantic returns a 422 with per-field
> messages. Auth also uses a JWT in an httpOnly cookie with CSRF on writes, and
> a spoofed `X-User-Id` header is rejected — there's a test for exactly that."

### Section 6 — Live database evidence (2 min) ⭐⭐⭐ the key requirement
In the terminal:
```bash
python api_demo.py | less
```
> "This is the part the assignment asks for — proof the database updates after
> **each** operation. This script makes 36 real API calls and, after every one,
> prints the change in the database."

Scroll through and narrate a few:
- **Signup** → `DB DELTA: users 2->3 (+1); sport_profiles 2->3 (+1)`.
- **Accept session** → `ROW BEFORE status=pending` → `ROW AFTER status=confirmed`.
- **Join a full game** → participant added as **waitlisted**; **leave** → next
  person **promoted**.
- **Accept invite time** → `sessions +1` and the invite row's `phase → confirmed,
  session_id → 2` — the materialization.
- **Admin reviews a report with suspend** → report `status → reviewed`, reported
  user `is_active 1 → 0`.
> "Inserts show a +1 row delta, deletes show −1, and in-place updates show the
> exact before/after field values."

### Section 7 — Tests + CI (45s)
```bash
pytest -v
```
Pause on `120 passed`.
> "120 automated tests across 14 files cover the whole surface — auth, matching,
> sessions, invites, appointments, courts, admin, support — plus the security
> invariants. They run on every push via GitHub Actions."

### Section 8 — Close (20s)
> "That's the Milestone 2 backend: 55 endpoints, 15 tables, JWT auth, Pydantic
> validation, explainable AI matching, all integrated with the database and
> verified by 120 tests and a live per-operation demo. Thanks for watching."

**Stop recording.**

---

## Anticipated questions

**"Walk me through login."** → Frontend POSTs `{email,password}` to
`/api/auth/login`; validated by `LoginSchema`; `User` looked up by email; Werkzeug
`check_password_hash` verifies the scrypt hash; `issue_token(user_id,
token_version)` builds an HS256 JWT (sub/iat/exp, 7-day); returned as a token and
set as an httpOnly `rp_session` cookie.

**"What does `@require_auth` do?"** → `utils/decorators.py`: reads the Bearer
header or `rp_session` cookie, decodes+verifies the JWT (signature, expiry, and
`token_version` match), loads the `User`, and rejects suspended accounts. Attaches
the user to `g` for `current_user()`.

**"How does match scoring work?"** → `services/matching.py::score_and_reason`:
skill closeness 0–45 (dominant), proximity 0–25 (Haversine), weekly schedule
overlap 0–20, shared home court 0–15, same primary sport +5, plus an optional
bio-embedding cosine "playing style" signal 0–15. Each contributor emits a reason
chip; tier = great ≥70 / good ≥45 / worth-a-try.

**"Why does calling match-reason twice not add a row?"** → `ai_match_logs` has a
unique constraint on `(viewer_id, candidate_id, sport)`; the route upserts, so
the verdict is stable across page loads.

**"SQLite vs Postgres?"** → Identical SQLAlchemy ORM; production sets
`DATABASE_URL` to Postgres (live on Render). `psycopg2-binary` is already a
dependency. See ADR-006.

**"What happens with no OpenAI key?"** → Graceful degradation: the embedding
signal contributes nothing, `match-reason` returns `source:"heuristic"`, and
support chat returns a "leave a message" reply — never an error.

---

## 📦 What to submit to Canvas

1. **Video** (.mp4/.mov, < 500 MB) recorded from this script.
2. **GitHub repository link** (this repo).
3. The three deliverable docs in `docs/`:
   `MILESTONE_2_API_REFERENCE.md`, `MILESTONE_2_DATABASE_DESIGN.md`,
   `MILESTONE_2_TEST_RESULTS.md` (+ the index `MILESTONE_2_SUBMISSION.md`).
4. **AI_DISCLOSURE.md** (already in the repo root).
