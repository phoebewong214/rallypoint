# Milestone 2 — Backend Demo Script

> Target length: **6–8 minutes**.
> Tool: QuickTime Player → File → New Screen Recording.

---

## Setup before pressing record

```bash
# 1. Make sure backend is clean
cd ~/Desktop/rallypoint/backend
.venv/bin/python seed.py        # fresh data
.venv/bin/python app.py         # starts on :5050
```

```bash
# 2. In a SECOND terminal, prep the curl-friendly setup
cd ~/Desktop/rallypoint/backend
# (you'll paste commands here during the demo)
```

```bash
# 3. (Optional but impressive) Open DB Browser for SQLite
# Free: https://sqlitebrowser.org/dl/
# Open: ~/Desktop/rallypoint/backend/rallypoint.db
```

Also have these tabs open in your browser:
- `http://localhost:5050/api/health`        (proves server alive)
- `http://localhost:5050/api/docs/`         (Swagger UI — the centerpiece)

Close any other distracting apps. Hide your dock if you can.

---

## 🎬 Demo Flow

### Section 1 — Intro (45 seconds)

**Say:**
> "Hi, I'm Phoebe. This is Milestone 2 of my capstone project, RallyPoint —
> an AI-powered sports partner matching app. Today I'll
> walk through the backend component: a Flask REST API integrated with a
> SQLAlchemy database, JWT authentication, and the AI matching service."

**Show:** Open `README.md` in VSCode. Scroll the "Architecture" ASCII diagram briefly.

---

### Section 2 — Tech stack overview (30 seconds)

**Say:**
> "The backend stack is **Flask 3, SQLAlchemy ORM, SQLite for development
> (Postgres-ready in production via a single env var), with PyJWT for auth
> and Pydantic v2 for request validation**. The whole thing is structured
> as an application factory with four blueprints."

**Show:** Open `backend/app.py`. Point at:
- `create_app()` function
- `register_blueprints(app)`
- Open `routes/__init__.py` to show 5 blueprints (`auth`, `players`, `sessions`, `ai`, `courts`)

---

### Section 3 — Database schema (1 minute) ⭐ KEY

**Say:**
> "The schema has six models. Let me show you."

**Show:** Open `backend/models/` folder in VSCode sidebar.
- Click `user.py`: "User + SportProfile. One user can have multiple sport profiles — separate NTRP per sport."
- Click `court.py`: "Court has lat/lng for the Chicago map."
- Click `session_model.py`: "Session connects two users, tracks status enum (requested/pending/confirmed/completed)."
- Click `ai_match_log.py`: "**Key innovation**: every AI match is logged here for stability and future training."

**If you have DB Browser open**, switch to it and click through the tables:
- `users` — 6 rows (alex, maya, jordan, sofia, marcus, aisha)
- `sport_profiles` — 8 rows (some users play both sports)
- `courts` — 8 Chicago courts
- `sessions` — 6 rows (mix of confirmed/pending/completed)
- `ai_match_logs` — empty for now, will populate when we hit /players

---

### Section 4 — Swagger UI (90 seconds) ⭐⭐ CENTERPIECE

**Say:**
> "Instead of using Postman, I integrated **Swagger / OpenAPI** so the API
> is fully self-documented and interactively testable from the browser."

**Show:** Switch to browser → `http://localhost:5050/api/docs/`

**Walk through:**
1. Point at the 8 endpoints listed
2. Click "Authorize" button → mention "this is where the JWT goes"
3. Expand `POST /auth/login` → click "Try it out"
4. Fill in:
   ```json
   { "email": "alex@rally.app", "password": "rally1234" }
   ```
5. Click Execute → **show the response**, copy the token

**Say:** "The token is signed with HS256 and expires in 7 days. Now I'll
authorize the rest of the requests with it."

6. Scroll up, click "Authorize" → paste `Bearer <your-token>`
7. Try `GET /auth/me` → show your user data comes back
8. Try `GET /players?sport=Pickleball` → **show the AI-scored matches** with
   reasons like "Maya fits because: identical NTRP 3.5, both in Chicago…"

---

### Section 5 — Pydantic validation (45 seconds)

**Say:**
> "All write endpoints are validated by Pydantic schemas, so the API never
> blows up on bad input — it returns a structured 422 with field errors."

**Show:** In Swagger, try `POST /auth/signup` with bad data:
```json
{ "email": "not-an-email", "password": "short", "name": "" }
```

Show the response:
```json
{
  "error": "validation failed",
  "fields": {
    "email":    ["value is not a valid email address: ..."],
    "password": ["String should have at least 8 characters"],
    "name":     ["String should have at least 1 character"]
  }
}
```

**Say:** "This level of validation is what makes the API safe to expose to
the frontend."

---

### Section 6 — JWT + security (45 seconds)

**Say:**
> "Authentication is JWT-based with a `@require_auth` decorator that runs
> on every protected route. Let me show what happens without a token."

**Show:** In a terminal:
```bash
curl -s http://localhost:5050/api/players
# → 401: missing Authorization: Bearer header
```

**Then:**
```bash
curl -s http://localhost:5050/api/players -H "Authorization: Bearer GARBAGE"
# → 401: invalid token
```

**Say:** "Login is also rate-limited to 10 requests per minute via Flask-Limiter
to prevent brute force."

**Show:** Open `backend/routes/auth.py`, point at `@limiter.limit("10 per minute")`

---

### Section 7 — AI matching service (1 minute) ⭐ KEY

**Say:**
> "The AI matching is the core feature. I built it with two paths:
> a deterministic heuristic that always runs, and an optional OpenAI LLM
> path that activates when an API key is configured."

**Show:** Open `backend/services/matching.py`.
- Point at `score_and_reason()` — explain the scoring (NTRP diff → ±25,
  same primary sport → +10, same city → +10, availability overlap → +5)
- Point at `llm_reason()` — "this only runs if OPENAI_API_KEY is set"

**Show:** In Swagger, run `POST /ai/match-reason`:
```json
{ "candidateId": 2, "sport": "Pickleball" }
```

Response shows `score: 100, reason: "Maya fits because...", source: "heuristic"`.

**Say:** "**Critical detail**: the result is cached in the `ai_match_logs`
table, so repeat calls return the cached verdict without recomputing.
This is a real optimization, not a fake one."

---

### Section 8 — Tests + CI (30 seconds)

**Say:**
> "The backend has 11 pytest tests covering the auth surface and the
> security invariants — including a test that the old X-User-Id header
> bypass cannot be used."

**Show:** In terminal:
```bash
cd ~/Desktop/rallypoint/backend
.venv/bin/pytest -v
```

Pause on the green output. **Say:** "These run on every push via GitHub
Actions — `.github/workflows/ci.yml`."

---

### Section 9 — Closing (15 seconds)

**Say:**
> "That's the backend for Milestone 2: 5 blueprints, 8 endpoints, 6 database
> models, JWT auth, Pydantic validation, AI matching with optional LLM
> upgrade, all tested. Milestone 3 will wire this into the React frontend
> via TanStack Query. Thanks for watching."

**Stop recording.**

---

## 🎤 Anticipated questions Amul might ask

> Pre-loaded answers for the most likely follow-ups. Read these aloud
> until you can paraphrase them without looking.

### Q: "Walk me through what happens when a user logs in."

> "The frontend POSTs `{email, password}` to `/api/auth/login`. The route
> validates the body via the `LoginSchema` Pydantic model, returns 422 if
> bad. If valid, it queries the User table, uses Werkzeug's
> `check_password_hash` to verify the password against the stored scrypt
> hash. On success, it calls `issue_token(user_id)` which builds a JWT with
> sub, iat, exp claims signed with HS256 and SECRET_KEY, valid for 7 days.
> Returns `{user, token}`. The frontend stores the token in localStorage
> and sends it as `Authorization: Bearer <jwt>` on every subsequent
> request."

### Q: "What does @require_auth actually do?"

> "It's a decorator in `utils/decorators.py`. It reads the Authorization
> header, calls `extract_bearer` to pull out the JWT, then `decode_token`
> which uses PyJWT to verify the HS256 signature and expiry. If valid,
> it looks up the User from the database by the `sub` claim and attaches
> it to Flask's request-scoped `g.current_user`. If anything fails,
> returns 401."

### Q: "How does the AI match scoring work?"

> "It's in `services/matching.py`, function `score_and_reason`. It takes
> the viewer, candidate, and sport. Starts at 60 base points. Adds up to
> +25 for NTRP closeness (identical = +25, 0.5 diff = +18, 1.0 diff = +5,
> further = -10). Adds +10 if both have the same primary sport. Adds +10
> if same city. Adds +5 if availability strings have any keyword overlap.
> Clamps to 0-100. Then builds a templated reason string from whichever
> signals contributed positively."

### Q: "Why SQLite and not Postgres?"

> "SQLite is for development — zero install, contributors can run the
> project in 30 seconds. The whole DB layer is SQLAlchemy ORM, so swapping
> to Postgres is one env var change. `psycopg2-binary` is already in
> requirements.txt. ADR-006 in ARCHITECTURE.md records this decision."

### Q: "Why Vite instead of Create React App?"

> "CRA was deprecated by the React team in 2023. The current React docs
> recommend Vite. Concrete benefits I felt: dev server starts in 1 second
> instead of 10+, HMR is sub-100ms. For a capstone with frequent iteration
> that matters. ADR-001 records this."

### Q: "What happens if OpenAI is down or you don't have a key?"

> "Graceful degradation. The route checks `app.config["OPENAI_API_KEY"]`
> first. If empty, it never imports the openai library — uses heuristic.
> If set, it tries the LLM and on any exception falls back to heuristic
> and logs a warning. The end user always gets a score and a reason, just
> with `source: "heuristic"` instead of `source: "openai"`."

### Q: "Show me one model class and explain it."

> Open `models/user.py`. "User has email (unique, indexed), name, handle,
> location, primary_sport, bio. Password is hashed via `set_password`
> using Werkzeug's scrypt. The `initials` property derives initials from
> the name. `sport_profiles` is a relationship — one user has many sport
> profiles, cascade delete. `to_dict()` serializes for the API and
> excludes the password hash by default unless `with_email=True`."

### Q: "What's the AIMatchLog table for?"

> "It caches every AI match decision. Three reasons: 1) Stable across page
> loads — the user sees the same score and reason on refresh instead of
> a re-computed one. 2) Future training data — if we later move to a real
> ML model, we have labeled history. 3) Audit — we can debug why a
> specific user got a specific match. The unique constraint
> `(viewer_id, candidate_id, sport)` means we upsert, not append."

### Q: "If I change User.email, will the JWT still validate?"

> "Yes, because the JWT's `sub` claim is the **user_id**, not email.
> The user could change email and the token stays valid until it expires.
> If we wanted to invalidate on email change, we'd need to add a
> `token_version` field to User and include it in the JWT payload."

### Q: "Can you modify this code right now to require email verification?"

> *Be honest if unsure.* "I'd add an `email_verified` boolean to User
> (default False), a `/api/auth/verify-email` endpoint that takes a
> token from a confirmation email, and modify the `@require_auth`
> decorator to also check `user.email_verified` for certain routes.
> Email sending I'd add as a service module using something like
> Flask-Mail."

---

## ✅ Pre-recording checklist

- [ ] `python seed.py` ran fresh (output: "Seeded 6 users, 8 courts...")
- [ ] Flask running on :5050
- [ ] `curl http://localhost:5050/api/health` returns ok
- [ ] Swagger UI loads at `/api/docs/`
- [ ] DB Browser open with `rallypoint.db` (optional but impressive)
- [ ] VSCode open with these files in tabs: `app.py`, `models/user.py`,
      `routes/auth.py`, `services/matching.py`
- [ ] Browser zoom set so text is readable in 1080p recording
- [ ] No other apps making sounds (Slack, Discord, etc.)
- [ ] Phone on silent

---

## 📦 What to submit to Canvas

1. **Video** (.mp4 / .mov, < 500 MB)
2. **Code zip** of `backend/` folder
3. **This script** (MILESTONE_2_DEMO.md) — optional but shows preparation
4. **AI Disclosure** — confirm you submitted AI_DISCLOSURE.md somewhere
