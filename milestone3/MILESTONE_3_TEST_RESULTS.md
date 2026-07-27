# Milestone 3 — Testing & Debugging Results

Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University

Three layers of testing back the integrated app, all green:

| Layer | Tool | Result | Evidence |
|---|---|---:|---|
| Backend API + DB (all 60 endpoints) | pytest + pytest-flask | **124 passed** | [pytest_output.txt](./pytest_output.txt) (local run, 2026-07-27) |
| Frontend units (auth state, UI) | Vitest + Testing Library (jsdom) | **7 passed** (2 files) | [vitest_ci_output.txt](./vitest_ci_output.txt) (CI on `main`) |
| API-contract typecheck + prod build | `tsc --noEmit` + `vite build` | **0 errors** | same CI run |

All three run in **GitHub Actions CI on every push and pull request**
(`.github/workflows/ci.yml`, jobs *Backend (pytest)* and *Frontend (build +
vitest)*) — the linked transcript is from the latest push to `main`
(run `30223980123`, 2026-07-26). Milestone 2 additionally recorded a 39-call
live run showing the row-level DB delta after every write operation
([api_demo_output.txt](../milestone2/api_demo_output.txt)).

---

## 1. Backend suite — 124 tests over every blueprint

Each test file spins up the Flask app with a fresh database, exercises real
HTTP requests against the REST API, and asserts on both the JSON response
**and the resulting database state** — i.e. these are integration tests of
the API + ORM + DB stack, not mocked unit tests.

| Test file | Tests | What it proves |
|---|---:|---|
| `test_auth.py` | 22 | signup/login/logout, JWT cookie + CSRF, email verification, password reset, rate limiting |
| `test_invites.py` | 14 | two-phase game invites: create, confirm, time proposals, accept→session, decline, cancel |
| `test_profile.py` | 13 | profile PATCH, weekly availability grid, date-specific overrides, photo upload/removal |
| `test_admin.py` | 13 | admin auth guard, stats/overview, user moderation |
| `test_sessions.py` | 9 | session lifecycle: accept, decline, cancel, reschedule |
| `test_reports.py` | 8 | trust & safety reports end to end |
| `test_admin_courts.py` | 8 | admin court CRUD |
| `test_courts.py` | 7 | court list w/ Haversine distance, detail, favorites, check-ins |
| `test_players.py` | 6 | /players matching endpoint, saved players |
| `test_support.py` | 6 | support chat + escalation to tickets |
| `test_matching.py` | 5 | scoring heuristic: skill/schedule/proximity signals + reason chips |
| `test_admin_user_delete.py` | 5 | account deletion cascades across tables |
| `test_support_desk.py` | 4 | admin support-desk workflow |
| `test_appointments.py` | 4 | open games: create/join/leave + waitlist |
| **Total** | **124** | |

Reproduce locally:

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -v          # → 124 passed
```

## 2. Frontend suite — the integration seam, tested

```bash
cd frontend && npm ci
npm test           # vitest → 7 passed
npm run typecheck  # tsc --noEmit → clean
npm run build      # production build → clean
```

- `AuthContext.test.tsx` (4) — the auth glue between frontend and backend:
  hydrating the session from `GET /auth/me`, login state transitions, and
  signing out globally when a 401 fires `auth:expired`.
- `Skeleton.test.tsx` (3) — loading-state components shown while REST
  requests are in flight.

The **typecheck is itself an integration test**: every API response is typed,
so a backend contract change breaks CI instead of production (this caught the
missing `photoVersion` field — see
[ISSUES_AND_RESOLUTIONS.md](./ISSUES_AND_RESOLUTIONS.md), issue 4).

## 3. Manual end-to-end test plan (used in the demo video)

Each row is a frontend interaction whose effect is verified in the database
layer through the REST API (DevTools Network tab open throughout):

| # | UI action | REST call observed | DB evidence |
|---|---|---|---|
| 1 | Sign up a new account | `POST /api/auth/signup` → 201 | new `users` + `availability_slots` rows; verification email arrives |
| 2 | Log in | `POST /api/auth/login` → 200 + `Set-Cookie` | httpOnly JWT cookie; `GET /auth/me` hydrates the header |
| 3 | Edit profile + availability, reload the page | `PATCH /api/auth/me` → 200 | changes persist across reload (read back from PostgreSQL) |
| 4 | Upload a profile photo | `PUT /api/auth/me/photo` | avatar renders from `GET /players/{id}/photo?v=…`; `user_photos` row |
| 5 | Find Partner list loads | `GET /api/players` | live match scores + reason chips computed from DB profiles |
| 6 | Save a player | `POST /api/players/{id}/save` | heart persists on reload (`saved_players`) |
| 7 | Invite a player (pick court + times) | `POST /api/invites` | invite appears for the *other* account (`game_invites`, `time_proposals`) |
| 8 | Other account accepts a time | `POST /api/invites/{id}/accept-time` | a `sessions` row is created; both timelines update |
| 9 | Favorite a court, check in | `POST /courts/{slug}/favorite`, `…/checkin` | `court_favorites`, `court_checkins` rows |
| 10 | Admin: resolve a support ticket | `PATCH /api/admin/support/{id}` | ticket status flips (`support_tickets`) |
| 11 | Invalid input (e.g. malformed signup) | → `422` with field errors | UI shows the structured message; no row written |
| 12 | Expired session | any call → `401` | app signs out cleanly via `auth:expired` |

## 4. Debugging practices used during integration

- **DevTools Network tab first** — every integration bug above (cookies,
  CORS, deploy race) was diagnosed by reading real request/response headers.
- **`curl` against production** to isolate frontend vs backend (JSON error =
  backend live; HTML 404 = stale deploy).
- **CI as a tripwire** — typecheck + both suites on every PR, so contract
  drift is caught before merge.
- The six representative bugs and their diagnoses are written up in
  [ISSUES_AND_RESOLUTIONS.md](./ISSUES_AND_RESOLUTIONS.md).

> Note: the frontend suite's evidence above is the CI transcript. On the
> submission machine vitest's worker pool hangs (a local Node/macOS quirk,
> not a test failure) — the identical suite passes in CI on every push,
> which is the authoritative environment.
