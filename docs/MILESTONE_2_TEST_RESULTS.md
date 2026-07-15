# RallyPoint — Milestone 2 Test Cases & Results

**Deliverable 3 of 3 — API Testing Results & Live Demonstration**
Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University
Repository: https://github.com/phoebewong214/rallypoint

This document is the testing evidence for the RallyPoint backend. It has two
parts:

1. **Automated test suite** — 120 pytest cases across 14 files, all passing,
   covering the full API surface and its security invariants.
2. **Live API demonstration** — a scripted 36-call end-to-end run that shows,
   **after every single write operation, the exact change in the database**
   (row inserted/deleted, or the affected row's fields before → after). This
   satisfies the requirement to demonstrate the database update after *each* REST
   operation.

Both are **reproducible from a clean checkout** — commands are given below.

---

## Part 1 — Automated test suite

### 1.1 How to run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -v
```

Each test runs against a **fresh in-memory SQLite database** (see
`tests/conftest.py`), so tests are fully isolated and leave no state behind. The
same suite runs in CI on every push (`.github/workflows/ci.yml`).

### 1.2 Result

```
============================= 120 passed in 34.80s =============================
```

**120 passed, 0 failed.** Full verbose output is captured in
`docs/pytest_output.txt`.

### 1.3 Coverage by area

| Test file | Cases | Area under test |
|---|---:|---|
| `test_auth.py` | 22 | Signup/login, JWT issue+verify, httpOnly cookie + CSRF, email verification, password reset, logout-all/token revocation, coordinate rounding, unique handles |
| `test_invites.py` | 14 | Two-phase invite lifecycle, turn logic, idempotency, window vs specific time, materialization into a session |
| `test_admin.py` | 13 | Admin auth gate, user search/paginate/filter, edit, self-suspend guard, "can't grant admin via API" |
| `test_sessions.py` | 9 | Request→accept→reschedule→cancel, viewer-relative status, duplicate guard, opponent payload |
| `test_profile.py` | 9 | Profile PATCH, sport-profile upsert/remove, availability grid replace |
| `test_reports.py` | 8 | Filing reports, collapse of repeat reports, admin review + suspend-in-one-step |
| `test_admin_courts.py` | 8 | Court CRUD, soft-close, slug uniqueness |
| `test_courts.py` | 7 | Court list + real Haversine distance, favorites toggle, court-scoped session |
| `test_support.py` | 6 | Support chat degrade path, escalation persists a ticket |
| `test_players.py` | 6 | Match list shape, save/unsave, self-save guard, suspended users hidden |
| `test_matching.py` | 5 | Score ordering (strong > weak), cosine embedding math, style chip presence/absence, score spread |
| `test_admin_user_delete.py` | 5 | Account deletion, self-delete guard, cascade behavior |
| `test_support_desk.py` | 4 | Admin ticket desk, resolve/reopen, history round-trip |
| `test_appointments.py` | 4 | Open-game create/join/**waitlist/promote**, host-only cancel, check-in distance guard |
| **Total** | **120** | |

### 1.4 Representative test cases (input → expected → result)

A selection across the surface. Every row **PASSED**.

| # | Test | Input / action | Expected result | Status |
|---|---|---|---|---|
| T1 | `test_signup_returns_jwt_and_user` | POST signup with valid body | 201; body has `user` + signed `token` | ✅ |
| T2 | `test_signup_with_bad_input_returns_422` | email="not-an-email", password="short", name="" | 422 with field-level errors | ✅ |
| T3 | `test_login_with_wrong_password_is_401` | correct email, wrong password | 401, no token | ✅ |
| T4 | `test_protected_route_rejects_x_user_id_header` | spoof `X-User-Id` header, no JWT | 401 (header bypass is dead) | ✅ |
| T5 | `test_cookie_auth_enforces_csrf_on_unsafe_methods` | cookie session, POST without `X-CSRF-Token` | rejected | ✅ |
| T6 | `test_reset_password_updates_pw_revokes_sessions_and_is_single_use` | use reset token twice | 1st ok, 2nd rejected; old JWTs invalid | ✅ |
| T7 | `test_strong_match_beats_weak_match` | score two candidates | closer skill/distance ranks higher | ✅ |
| T8 | `test_semantic_signal_adds_style_chip` | two similar bios w/ embeddings | "playing style" chip + extra points | ✅ |
| T9 | `test_request_is_a_request_to_the_guest_and_pending_to_the_host` | A requests B | B sees `requested`/`requests`; A sees `pending`/`upcoming` | ✅ |
| T10 | `test_host_cannot_accept_own_request` | host calls accept | 403 | ✅ |
| T11 | `test_duplicate_request_to_same_player_is_rejected` | 2nd active request, same pair+sport | 409 returning the existing session | ✅ |
| T12 | `test_cancel_keeps_a_trace_in_past` | cancel a confirmed game | row kept, `status=cancelled`, `bucket=past` for both | ✅ |
| T13 | `test_accept_specific_time_one_tap_confirms_and_materializes` | invitee accepts specific time | invite→confirmed; a real `sessions` row is created | ✅ |
| T14 | `test_create_past_time_rejected` | invite `startAt` in 2020 | 422 "time must be in the future" | ✅ |
| T15 | `test_create_join_waitlist_and_promote` | fill a game, extra joiner, someone leaves | joiner waitlisted, then promoted on leave | ✅ |
| T16 | `test_checkin_rejected_when_far_away` | check-in with coords >3 mi from court | 400 | ✅ |
| T17 | `test_admin_rejects_non_admin` | non-admin hits `/api/admin/*` | 403 | ✅ |
| T18 | `test_admin_cannot_grant_admin_via_api` | PATCH user with `isAdmin:true` | ignored — no privilege escalation | ✅ |
| T19 | `test_admin_edits_user_support_desk_fields` | admin suspends a user | `is_active=false`, tokens revoked | ✅ |
| T20 | `test_escalate_persists_even_if_email_fails` (`test_support.py`) | POST escalate | `support_tickets` row created even if email fails | ✅ |

---

## Part 2 — Live API demonstration (database update after each operation)

### 2.1 How to run

```bash
cd backend
python api_demo.py                 # prints the transcript to stdout
python api_demo.py > ../docs/api_demo_output.txt
```

`api_demo.py` is self-contained: it builds a **fresh SQLite database**, seeds two
players (`alex`, an admin, and `maya`) plus one court (`grant-park`), then
exercises **36 API calls** covering every functional area. After each call it
prints:

```
request body  ->  HTTP status + response body  ->  DB DELTA (+ ROW BEFORE/AFTER)
```

The `DB DELTA` line is computed by counting rows in all 15 tables immediately
before and after the call. For in-place UPDATEs (which don't change row counts),
a `ROW BEFORE` / `ROW AFTER` pair shows the exact column values that changed.

The complete transcript is `docs/api_demo_output.txt`. Highlights follow.

### 2.2 Every write operation and its database effect

| Step | Operation | HTTP | Database change (evidence) |
|---|---|---|---|
| 1 | Signup (Casey) | 201 | `users 2→3 (+1); sport_profiles 2→3 (+1)` |
| 2 | Login (admin) | 200 | none (issues a JWT — no write) |
| 3 | Bad login | 401 | none |
| 4 | Invalid signup | 422 | none (structured field errors) |
| 5 | GET /auth/me | 200 | none (read) |
| 6 | PATCH profile + availability | 200 | `availability_slots 0→3 (+3)`; row: `location "The Loop" → "Gold Coast"`, `bio` updated |
| 7 | GET /players (AI ranked) | 200 | none (read; score computed inline) |
| 8 | Save player | 200 | `saved_players 0→1 (+1)` |
| 9 | Un-save player | 200 | `saved_players 1→0 (−1)` |
| 10 | Report player | 201 | `user_reports 0→1 (+1)` |
| 11 | AI match-reason | 200 | `ai_match_logs 0→1 (+1)` |
| 12 | AI match-reason (again) | 200 | none — **upsert**, no duplicate row |
| 13 | Create session (request) | 201 | `sessions 0→1 (+1)`, `status=pending` |
| 14 | Duplicate request | 409 | none — returns the existing session |
| 15 | Accept session | 200 | row: `status pending → confirmed` |
| 16 | Reschedule | 200 | row: `host/guest swapped`, new time, `status → pending` |
| 17 | GET /sessions | 200 | none (read) |
| 18 | Cancel session | 200 | row: `status → cancelled` (kept as a trace) |
| 19 | GET /courts | 200 | none (read; real distance) |
| 20 | Favorite court | 200 | `court_favorites 0→1 (+1)` |
| 21 | Check in | 200 | `court_checkins 0→1 (+1)` |
| 22 | Create open game | 201 | `court_appointments 0→1 (+1); appointment_participants 0→1 (+1)` |
| 23 | Maya joins | 200 | `appointment_participants 1→2 (+1)` |
| 24 | Casey joins (full) | 200 | `appointment_participants 2→3 (+1)` — **waitlisted** |
| 25 | Maya leaves | 200 | `appointment_participants 3→2 (−1)` — Casey **promoted** off waitlist |
| 26 | Check out | 200 | `court_checkins 1→0 (−1)` |
| 27 | Create invite (window) | 201 | `game_invites 0→1 (+1); time_proposals 0→1 (+1)` |
| 28 | Confirm opponent | 200 | row: `phase awaiting_opponent → settling_time` |
| 29 | Propose specific time | 200 | `time_proposals 1→2 (+1)` (old one superseded) |
| 30 | Accept time | 200 | `sessions 1→2 (+1)`; invite row: `phase → confirmed, session_id → 2` |
| 31 | Escalate support | 200 | `support_tickets 0→1 (+1)` |
| 32 | Admin overview | 200 | none (read aggregate) |
| 33 | Admin list users | 200 | none (read) |
| 34 | Admin list reports | 200 | none (read) |
| 35 | Admin review report + suspend | 200 | report row: `status open → reviewed`; user `is_active 1 → 0` |
| 36 | Admin close ticket | 200 | ticket row: `status open → closed`, `resolution_note` set |

Every write is accounted for: **INSERTs** show a `+1` (or `+N`) row delta,
**DELETEs** show `−1`, and **in-place UPDATEs** show the concrete before/after
field values.

### 2.3 Sample transcript excerpts

**INSERT — signup creates a user + sport profile:**
```
STEP 1: Sign up a brand-new account (INSERT users + sport_profiles)
  POST /api/auth/signup   ->  HTTP 201
  DB DELTA: users 2->3 (+1 row); sport_profiles 2->3 (+1 row)
```

**UPDATE — accepting a request flips status (no new row):**
```
STEP 15: Maya accepts the request (UPDATE sessions status -> confirmed)
  POST /api/sessions/1/accept   ->  HTTP 200
  DB DELTA: (no row-count change — in-place UPDATE or read-only)
  ROW BEFORE: {'id': 1, 'host_id': 1, 'guest_id': 2, 'status': 'pending',   'scheduled_at': '2026-07-22 ...'}
  ROW AFTER:  {'id': 1, 'host_id': 1, 'guest_id': 2, 'status': 'confirmed', 'scheduled_at': '2026-07-22 ...'}
```

**UPSERT — calling AI match-reason twice does not duplicate the cache row:**
```
STEP 11: On-demand AI match reason, cached (INSERT ai_match_logs)
  DB DELTA: ai_match_logs 0->1 (+1 row)
STEP 12: Same call again — upserts the cached row (no new row)
  DB DELTA: (no row-count change — in-place UPDATE or read-only)
```

**MATERIALIZE — accepting an invite time creates a confirmed session:**
```
STEP 30: Alex accepts the time -> materializes a confirmed session
  POST /api/invites/1/accept-time   ->  HTTP 200
  DB DELTA: sessions 1->2 (+1 row)
  ROW BEFORE: {'id': 1, 'phase': 'settling_time', 'session_id': None}
  ROW AFTER:  {'id': 1, 'phase': 'confirmed',     'session_id': 2}
```

**CASCADING UPDATE — resolving a report suspends the reported account:**
```
STEP 35: Admin reviews the report + suspends the account
  PATCH /api/admin/reports/1   ->  HTTP 200
  ROW BEFORE: {'id': 1, 'status': 'open',     'reported_is_active': 1}
  ROW AFTER:  {'id': 1, 'status': 'reviewed', 'reported_is_active': 0}
```

### 2.4 Final database state after the run

```
users                        3
sport_profiles               3
availability_slots           3
courts                       1
court_favorites              1
court_checkins               0
court_appointments           1
appointment_participants     2
saved_players                0
sessions                     2
game_invites                 1
time_proposals               2
ai_match_logs                1
user_reports                 1
support_tickets              1
```

Total API calls exercised: **36**. Every write above shows its database delta
inline.

---

## 3. Negative / edge cases exercised

Beyond the happy path, the suite and demo confirm the API fails *safely*:

- **AuthN/AuthZ:** missing token → 401; garbage token → 401; spoofed
  `X-User-Id` → 401; non-admin on admin routes → 403; acting on someone else's
  session → 403.
- **Validation:** malformed email / weak password / blank name → 422 with
  field-level detail (never a 500); past scheduled times → 422.
- **Business rules:** self-invite / self-save / self-report → 400; duplicate
  session or invite → 409 returning the existing one; check-in from >3 mi → 400;
  privilege escalation via `isAdmin` in a profile PATCH → silently ignored.
- **Graceful degradation:** support chat with no `OPENAI_API_KEY` returns a
  "leave a message" reply (`source: "unavailable"`); the embedding match signal
  contributes nothing (rather than erroring) with no key.

---

## 4. Reproducibility checklist

| Artifact | Command | Output |
|---|---|---|
| Automated tests | `cd backend && pytest -v` | `120 passed` → `docs/pytest_output.txt` |
| Live DB-evidence demo | `cd backend && python api_demo.py` | `docs/api_demo_output.txt` |
| Interactive API docs | `python app.py` then open `/api/docs/` | Swagger UI |
| Schema DDL | generated by the models | `docs/schema_ddl.sql` |

All commands run against a clean checkout with only `requirements.txt`
installed — no external services required (OpenAI/SMTP are optional and degrade
gracefully).
