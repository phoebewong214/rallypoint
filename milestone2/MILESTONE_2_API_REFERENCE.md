# RallyPoint — Milestone 2 API Reference

**Deliverable 1 of 3 — API List with Expected Input / Output**
Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University
Repository: https://github.com/phoebewong214/rallypoint · Live API: `https://api.tryrallypoint.com`

This document is the complete list of the RallyPoint backend REST API: every
endpoint, its authentication requirement, its expected input, and a sample JSON
input/output. All routes are under `/api`; the server speaks JSON in and JSON
out. The same surface is also browsable and interactively testable via the
built-in **Swagger / OpenAPI UI at `/api/docs/`** and the raw spec at
`/api/openapi.json`.

---

## 1. Conventions

### Authentication

RallyPoint issues a **JWT (HS256, 7-day expiry)** on signup/login. There are two
ways to present it:

| Client | How the token travels |
|---|---|
| Browser SPA | httpOnly `rp_session` cookie (set automatically), plus a readable `rp_csrf` cookie echoed as an `X-CSRF-Token` header on unsafe methods |
| API / test client | `Authorization: Bearer <jwt>` header |

Protected routes are marked **🔒 Auth**. Admin-only routes are marked **🛡 Admin**
(the user's `is_admin` flag must be set). All examples below use the
`Authorization: Bearer` form for clarity.

### Standard responses

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created (a row was inserted) |
| `400` | Bad request (business-rule violation, e.g. "can't invite yourself") |
| `401` | Missing / invalid / expired token |
| `403` | Authenticated but not allowed (e.g. not a participant, not admin) |
| `404` | No such resource |
| `409` | Conflict (duplicate, or state no longer permits the action) |
| `422` | Validation failed — returns structured field errors |
| `429` | Rate limited |

### Validation error shape (422)

Every write body is validated by a Pydantic v2 schema. On failure the API returns
a structured, field-level error instead of a 500:

```json
{
  "error": "validation failed",
  "fields": {
    "email":    ["value is not a valid email address: ..."],
    "password": ["Password must contain at least one letter and one number"],
    "name":     ["Name cannot be blank"]
  }
}
```

---

## 2. Endpoint index (60 routes: 59 across 9 blueprints + health)

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| | | **Health** | | |
| 1 | GET | `/api/health` | — | Liveness probe |
| | | **Auth** (`routes/auth.py`) | | |
| 2 | POST | `/api/auth/signup` | — | Create account (rate-limited 5/min) |
| 3 | POST | `/api/auth/login` | — | Authenticate → JWT (10/min per IP) |
| 4 | GET | `/api/auth/me` | 🔒 | Current user |
| 5 | PATCH | `/api/auth/me` | 🔒 | Update profile / sports / availability |
| 6 | PUT | `/api/auth/me/photo` | 🔒 | Upload / replace profile photo (data URL) |
| 7 | DELETE | `/api/auth/me/photo` | 🔒 | Remove own photo (back to initials) |
| 8 | POST | `/api/auth/logout` | — | Clear auth cookies |
| 9 | POST | `/api/auth/logout-all` | 🔒 | Revoke every token (bump token_version) |
| 10 | POST | `/api/auth/verify-email` | — | Confirm email from link token |
| 11 | POST | `/api/auth/resend-verification` | 🔒 | Re-send the verification email |
| 12 | POST | `/api/auth/forgot-password` | — | Request a reset email (no enumeration) |
| 13 | POST | `/api/auth/reset-password` | — | Set new password from reset token |
| | | **Players / Matching** (`routes/players.py`) | | |
| 14 | GET | `/api/players` | 🔒 | AI-ranked partner list (+ reason chips) |
| 15 | GET | `/api/players/saved` | 🔒 | The viewer's saved players |
| 16 | GET | `/api/players/<id>/photo` | — | Profile photo bytes (public; suspended → 404) |
| 17 | POST | `/api/players/<id>/save` | 🔒 | Bookmark a player |
| 18 | DELETE | `/api/players/<id>/save` | 🔒 | Un-bookmark a player |
| 19 | POST | `/api/players/<id>/report` | 🔒 | File a trust & safety report |
| | | **AI** (`routes/ai.py`) | | |
| 20 | POST | `/api/ai/match-reason` | 🔒 | On-demand match reason (cached) |
| | | **Sessions** (`routes/sessions.py`) | | |
| 21 | GET | `/api/sessions` | 🔒 | Games bucketed upcoming/requests/past |
| 22 | POST | `/api/sessions` | 🔒 | Request a game |
| 23 | POST | `/api/sessions/<id>/accept` | 🔒 | Guest confirms |
| 24 | POST | `/api/sessions/<id>/decline` | 🔒 | Guest declines |
| 25 | POST | `/api/sessions/<id>/cancel` | 🔒 | Either party cancels |
| 26 | POST | `/api/sessions/<id>/reschedule` | 🔒 | Propose a new time (re-opens) |
| | | **Courts** (`routes/courts.py`) | | |
| 27 | GET | `/api/courts` | 🔒 | Courts + distance + activity |
| 28 | GET | `/api/courts/<slug>` | 🔒 | Single court + open games |
| 29 | POST | `/api/courts/<slug>/favorite` | 🔒 | Favorite a court |
| 30 | DELETE | `/api/courts/<slug>/favorite` | 🔒 | Un-favorite a court |
| | | **Appointments / Check-ins** (`routes/appointments.py`) | | |
| 31 | POST | `/api/courts/<slug>/appointments` | 🔒 | Create an open game |
| 32 | POST | `/api/courts/<slug>/checkin` | 🔒 | "I'm here now" (~2h) |
| 33 | DELETE | `/api/courts/<slug>/checkin` | 🔒 | Check out |
| 34 | POST | `/api/appointments/<id>/join` | 🔒 | Join (or waitlist if full) |
| 35 | POST | `/api/appointments/<id>/leave` | 🔒 | Leave (promotes next in queue) |
| 36 | DELETE | `/api/appointments/<id>` | 🔒 | Host cancels the open game |
| | | **Invites** (two-phase) (`routes/invites.py`) | | |
| 37 | GET | `/api/invites` | 🔒 | The viewer's open invites |
| 38 | POST | `/api/invites` | 🔒 | Create an invite (+ opening time) |
| 39 | POST | `/api/invites/<id>/confirm-opponent` | 🔒 | Invitee agrees to play |
| 40 | POST | `/api/invites/<id>/propose-time` | 🔒 | Offer / counter a time |
| 41 | POST | `/api/invites/<id>/accept-time` | 🔒 | Accept the time → materialize session |
| 42 | POST | `/api/invites/<id>/decline` | 🔒 | Invitee declines |
| 43 | POST | `/api/invites/<id>/cancel` | 🔒 | Either party calls it off |
| | | **Support** (`routes/support.py`) | | |
| 44 | POST | `/api/support/chat` | 🔒 | Ask the AI support assistant |
| 45 | POST | `/api/support/escalate` | 🔒 | "Talk to a human" → ticket |
| | | **Admin** (`routes/admin.py`) | | |
| 46 | GET | `/api/admin/overview` | 🛡 | Ops dashboard aggregate |
| 47 | GET | `/api/admin/stats` | 🛡 | Headline counts |
| 48 | GET | `/api/admin/users` | 🛡 | Paged, filterable user list |
| 49 | GET | `/api/admin/users/<id>` | 🛡 | One user (full record) |
| 50 | PATCH | `/api/admin/users/<id>` | 🛡 | Edit user / ratings / suspend |
| 51 | DELETE | `/api/admin/users/<id>/photo` | 🛡 | Strip a user's photo (trust & safety) |
| 52 | DELETE | `/api/admin/users/<id>` | 🛡 | Delete an account |
| 53 | GET | `/api/admin/reports` | 🛡 | Trust & safety report queue |
| 54 | PATCH | `/api/admin/reports/<id>` | 🛡 | Resolve a report (+ optional suspend) |
| 55 | GET | `/api/admin/support` | 🛡 | Support ticket desk |
| 56 | PATCH | `/api/admin/support/<id>` | 🛡 | Resolve / reopen a ticket |
| 57 | GET | `/api/admin/courts` | 🛡 | All courts (incl. inactive) |
| 58 | POST | `/api/admin/courts` | 🛡 | Create a court |
| 59 | PATCH | `/api/admin/courts/<id>` | 🛡 | Edit a court |
| 60 | DELETE | `/api/admin/courts/<id>` | 🛡 | Soft-close a court |

> The interactive Swagger UI at `/api/docs/` renders the same list with a
> "Try it out" button per endpoint.

---

## 3. Endpoint details with sample JSON I/O

Below are representative request/response pairs for each functional area. Every
sample was captured from a real run of the API (see
`MILESTONE_2_TEST_RESULTS.md` and `api_demo_output.txt` for the full transcript,
including the database change after each call).

### 3.1 Auth

#### POST `/api/auth/signup`  — create account
Rate-limited 5/min. Inserts a `users` row + one `sport_profiles` row (and any
onboarding availability). Returns the user and a JWT.

**Input**
```json
{
  "email": "casey@rally.app",
  "password": "rally1234",
  "name": "Casey Nguyen",
  "sport": "Pickleball",
  "ntrp": "3.5",
  "location": "West Loop, Chicago"
}
```
Optional fields: `lat`, `lng` (rounded to ~110 m), `availability` (weekly grid cells).

**Output `201`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 3,
    "name": "Casey Nguyen",
    "handle": "@caseynguyen",
    "email": "casey@rally.app",
    "emailVerified": false,
    "isAdmin": false,
    "isActive": true,
    "primarySport": "Pickleball",
    "location": "West Loop, Chicago",
    "sportProfiles": [{ "sport": "Pickleball", "ntrp": "3.5", "homeCourt": null }],
    "availability": [],
    "joined": "Jul 2026"
  }
}
```
Errors: `409` email already in use · `422` validation (weak password, bad email, blank name) · `429` rate limited.

#### POST `/api/auth/login`  — authenticate
**Input** `{ "email": "alex@rally.app", "password": "rally1234" }`
**Output `200`** `{ "user": { ... }, "token": "eyJ..." }`
Errors: `401` invalid credentials · `429` rate limited (10/min per IP, 10/15 min per account).

#### GET `/api/auth/me`  — current user  🔒
**Output `200`** `{ "user": { ...same shape as signup, with email... } }`

#### PATCH `/api/auth/me`  — update profile  🔒
Any subset of the fields may be sent (partial update). Sending `availability`
replaces the entire weekly grid; sending `sportProfiles` upserts the desired set;
sending `availabilityOverrides` replaces the entire set of date-specific tweaks.

**Input**
```json
{
  "bio": "4.0-ish dinker, quick hands at the net.",
  "location": "Gold Coast, Chicago",
  "availability": [
    { "dayOfWeek": 5, "timeBand": "MORN", "status": 2 },
    { "dayOfWeek": 6, "timeBand": "MORN", "status": 2 },
    { "dayOfWeek": 2, "timeBand": "EVE",  "status": 1 }
  ],
  "availabilityOverrides": [
    { "date": "2026-08-01", "timeBand": "MORN", "status": 0 },
    { "date": "2026-08-03", "timeBand": "EVE",  "status": 2 }
  ]
}
```
**Output `200`** `{ "user": { ...updated... } }`
(`status`: 0 = unavailable, 1 = maybe, 2 = available. `timeBand`: MORN/AFT/EVE.)

Each `availabilityOverrides` item is
`{ "date": "YYYY-MM-DD", "timeBand": "MORN" | "AFT" | "EVE", "status": 0 | 1 | 2 }`
— a date-specific exception layered over the weekly grid ("busy *this* Saturday
morning"). Unlike the grid, `status: 0` cells are stored (they override a free
weekly slot); cells with past dates are silently dropped (natural cleanup). The
`user` payload — and every player payload (e.g. from `GET /api/players`) — now
includes the future-dated `availabilityOverrides` list in the same shape.

#### Other auth routes
- `POST /api/auth/logout` → `{ "ok": true }` (clears cookies).
- `POST /api/auth/logout-all` 🔒 → `{ "ok": true }` (revokes all JWTs).
- `POST /api/auth/verify-email` `{ "token": "<link token>" }` → `{ "ok": true, "user": {...} }`.
- `POST /api/auth/resend-verification` 🔒 → `{ "ok": true, "alreadyVerified": false }`.
- `POST /api/auth/forgot-password` `{ "email": "..." }` → always `{ "ok": true }` (no account enumeration).
- `POST /api/auth/reset-password` `{ "token": "...", "password": "newpass12" }` → `{ "ok": true }`.

### 3.2 Players / Matching

#### GET `/api/players?sport=Pickleball&ntrpMin=2.0&ntrpMax=5.0`  🔒
Read-only. Returns candidates already sorted by `matchScore` descending. The
score is a **transparent 0–100 heuristic** (skill closeness 0–45, proximity
0–25, schedule overlap 0–20, shared home court 0–15, same sport +5) plus an
optional semantic "playing-style" signal from bio embeddings — each signal emits
a reason chip.

**Query params**: `sport`, `ntrpMin`, `ntrpMax`, `courts` (comma-separated home-court slugs), `timeBands` (MORN/AFT/EVE).

**Output `200`** (captured from the demo run — no `OPENAI_API_KEY`, so the
embedding "playing style" chip is absent and the score comes purely from the
transparent signals)
```json
{
  "count": 2,
  "players": [
    {
      "id": 2,
      "name": "Maya Patel",
      "initials": "MP",
      "location": "Streeterville, Chicago",
      "distance": "0.9",
      "matchScore": 72,
      "matchTier": "great",
      "matchReasons": ["Same level (DUPR 3.5)", "0.9 mi away"],
      "reason": "Same level (DUPR 3.5); 0.9 mi away",
      "sport": "Pickleball",
      "ntrp": "3.5",
      "pickleball": { "sport": "Pickleball", "ntrp": "3.5", "homeCourt": null },
      "tennis": null,
      "saved": false
    }
  ]
}
```
> With an `OPENAI_API_KEY` set, a bio-embedding cosine-similarity signal adds a
> "Similar playing style" chip and up to 15 more points; it degrades gracefully
> to nothing (as above) when absent.

#### POST `/api/players/<id>/save`  🔒 — bookmark a player
**Output `200`** `{ "id": 2, "saved": true }` · inserts a `saved_players` row (idempotent). `400` if saving yourself, `404` if no such player.

#### DELETE `/api/players/<id>/save`  🔒
**Output `200`** `{ "id": 2, "saved": false }` · deletes the `saved_players` row.

#### GET `/api/players/saved`  🔒
**Output `200`** `{ "count": 1, "players": [ { "id": 2, "name": "Maya Patel", "sports": ["Pickleball"] } ] }`

#### POST `/api/players/<id>/report`  🔒 — trust & safety report
**Input** `{ "reason": "no_show", "details": "Booked a game then never showed." }`
`reason` ∈ `harassment | no_show | fake_profile | inappropriate | safety | other`.
**Output `201`** `{ "ok": true }` · inserts a `user_reports` row (repeat open reports from the same reporter are collapsed).

### 3.3 Profile photos

Avatars live inline in the database (`user_photos`, one row per user, upserted).
The client center-crops and resizes to a 256px JPEG (~30 KB) before upload; the
server enforces a 500 KB ceiling on the decoded bytes as a safety net. User and
player payloads carry a `photoVersion` (null when no photo) that the frontend
appends as `?v=` when building the image URL.

#### PUT `/api/auth/me/photo`  🔒 — upload / replace your photo
**Input** (a base64 `data:` URL — PNG, JPEG, or WebP)
```json
{ "dataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..." }
```
**Output `200`** — the updated user; `photoVersion` bumps on every change
```json
{ "user": { "id": 3, "name": "Casey Nguyen", "photoVersion": 1784937600, "...": "..." } }
```
Errors:
- `413` `{ "error": "Image too large — keep it under 500 KB" }` (decoded size over the ceiling)
- `422` `{ "error": "Send dataUrl as a base64 PNG/JPEG/WebP data URL" }` (wrong format) · `{ "error": "Invalid base64 image data" }` · `{ "error": "Empty image" }`

#### DELETE `/api/auth/me/photo`  🔒 — remove your photo
Back to the initials avatar. Idempotent.
**Output `200`** `{ "user": { ..., "photoVersion": null } }`

#### GET `/api/players/<id>/photo`  — serve the photo bytes
Deliberately **public** (no 🔒): `<img>` tags don't send the cross-site auth
cookie in production, and avatars are shown to every signed-in user anyway.
**Output `200`** is the raw image bytes (not JSON) with `Content-Type:
image/png|jpeg|webp` and `Cache-Control: public, max-age=86400` — long caching
is safe because clients bust the cache with `?v=<photoVersion>`.
`404` `{ "error": "No photo" }` when the user has no photo, doesn't exist, or is suspended.

#### DELETE `/api/admin/users/<id>/photo`  🛡 — strip a user's photo
Trust & safety: removes the photo (the user falls back to initials and may
upload a new one). Idempotent.
**Output `200`** `{ "ok": true }` · `404` unknown user.

### 3.4 AI match reason

#### POST `/api/ai/match-reason`  🔒
Computes (or refreshes) the cached verdict for one candidate. **Upserts** an
`ai_match_logs` row keyed by `(viewer_id, candidate_id, sport)`, so calling twice
does not add a second row. Falls back to the heuristic when `OPENAI_API_KEY` is
unset.

**Input** `{ "candidateId": 2, "sport": "Pickleball" }`
**Output `200`** `{ "score": 72, "reason": "Same level (DUPR 3.5); 0.9 mi away", "source": "heuristic" }`

### 3.5 Sessions (request → accept → reschedule → cancel)

#### POST `/api/sessions`  🔒 — request a game
Inserts a `sessions` row with `status = pending`. `court` is an optional slug.

**Input**
```json
{ "guestId": 2, "sport": "Pickleball", "scheduledAt": "2026-07-22T18:00:00", "court": "grant-park", "note": "Sat morning hit?" }
```
**Output `201`**
```json
{
  "session": {
    "id": 1, "bucket": "upcoming", "status": "pending", "sentByMe": true,
    "opp": "Maya Patel", "oppId": 2, "oppNtrp": "3.5",
    "sport": "Pickleball", "court": "Grant Park Tennis Center",
    "scheduledAt": "2026-07-22T18:00:00", "note": "Sat morning hit?"
  }
}
```
Errors: `400` self / `404` no such player / `409` duplicate (returns the existing session) / `422` past time.
> **Viewer-relative status:** the same row reads as `status="requested"`, `bucket="requests"` to the *guest*, and `status="pending"`, `bucket="upcoming"` to the *host*.

#### POST `/api/sessions/<id>/accept`  🔒 (guest only)
**Output `200`** session with `status` → `confirmed`. `403` if not the guest, `409` if no longer open.

#### POST `/api/sessions/<id>/reschedule`  🔒
**Input** `{ "scheduledAt": "2026-07-23T19:00:00" }` — proposer becomes host, the game re-opens to the other party (`status` → `pending`).

#### POST `/api/sessions/<id>/decline` · `/cancel`  🔒
Move the row to `status = cancelled` (kept as a trace in Past for 30 days).

#### GET `/api/sessions`  🔒
**Output `200`** `{ "sessions": [ { ...viewer-relative dict, bucketed... } ] }`

### 3.6 Courts, check-ins & open games

#### GET `/api/courts?sport=Pickleball&q=grant`  🔒
**Output `200`**
```json
{
  "count": 1,
  "courts": [
    {
      "id": "grant-park", "name": "Grant Park Tennis Center",
      "addr": "331 E Randolph St, Chicago", "distance": 0.9, "fav": false,
      "sports": ["Tennis", "Pickleball"], "surface": "Outdoor · Hard", "lights": true,
      "regularsCount": 0, "upcomingCount": 0, "hereNow": 0, "openGames": 0
    }
  ]
}
```

#### GET `/api/courts/<slug>`  🔒
Single court enriched with `distance`, `fav`, `regulars`, `hereNow`, `checkedIn`, and the list of open `appointments`.

#### POST / DELETE `/api/courts/<slug>/favorite`  🔒
`{ "id": "grant-park", "fav": true }` / `{ "id": "grant-park", "fav": false }` — insert/delete a `court_favorites` row.

#### POST `/api/courts/<slug>/checkin`  🔒 — "I'm here now"
**Input** `{ "lat": 41.8836, "lng": -87.6189 }` (optional; a >3 mi mismatch is rejected `400`).
**Output `200`** `{ "ok": true, "checkedIn": true }` — inserts/refreshes a `court_checkins` row (active ~2h).
`DELETE` the same path → `{ "ok": true, "checkedIn": false }`.

#### POST `/api/courts/<slug>/appointments`  🔒 — create an open game
**Input** `{ "sport": "Pickleball", "scheduledAt": "2026-07-22T18:00:00", "maxPlayers": 2 }`
**Output `201`**
```json
{
  "appointment": {
    "id": 1, "courtSlug": "grant-park", "courtName": "Grant Park Tennis Center",
    "sport": "Pickleball", "scheduledAt": "2026-07-22T18:00:00", "maxPlayers": 2,
    "status": "open", "isHost": true, "confirmedCount": 1, "waitlistCount": 0,
    "spotsLeft": 1, "joined": true, "waitlisted": false
  }
}
```
Inserts a `court_appointments` row + the creator as an `appointment_participants` row.

#### POST `/api/appointments/<id>/join`  🔒
Adds an `appointment_participants` row; **waitlisted** automatically when the game
is full. **Output** the appointment dict with `waitlisted` / `queuePosition`.

#### POST `/api/appointments/<id>/leave`  🔒
Deletes the participant row; if a *confirmed* spot frees up, the next waitlisted
player is **promoted** (and emailed).

#### DELETE `/api/appointments/<id>`  🔒 (host only)
Sets `status = cancelled`. `403` if not the host.

### 3.7 Two-phase invites

The invite flow separates "will you play me?" from "when?". Phases:
`awaiting_opponent → settling_time → confirmed` (or `declined` / `cancelled`).

#### POST `/api/invites`  🔒 — create an invite
**Input** (a specific time, or a `startAt`/`endAt` window)
```json
{ "inviteeId": 2, "sport": "Pickleball", "startAt": "2026-07-22T18:00:00", "endAt": "2026-07-23T18:00:00", "court": "grant-park" }
```
**Output `201`** invite dict (`phase: "awaiting_opponent"`, `sentByMe: true`) — inserts a `game_invites` row + an opening `time_proposals` row. `409` returns an existing open invite between the pair.

#### POST `/api/invites/<id>/confirm-opponent`  🔒 (invitee)
`phase` → `settling_time`.

#### POST `/api/invites/<id>/propose-time`  🔒
**Input** `{ "startAt": "2026-07-22T18:00:00" }` — inserts a `time_proposals` row, supersedes the prior open one.

#### POST `/api/invites/<id>/accept-time`  🔒 (the non-proposer)
Locks the specific time on the table: **materializes a confirmed `sessions` row**,
sets the invite `phase` → `confirmed`, `session_id` → the new session.
**Output `200`** `{ "invite": {...}, "session": {...} }`.

#### POST `/api/invites/<id>/decline` · `/cancel`  🔒
Move the invite to `declined` / `cancelled` (decline accepts an optional `reason`).

#### GET `/api/invites`  🔒
**Output `200`** `{ "invites": [ ...viewer-relative, non-confirmed... ] }`

### 3.8 Support

#### POST `/api/support/chat`  🔒
**Input** `{ "message": "How do I request a game?", "history": [] }`
**Output `200`** `{ "reply": "...", "source": "ai" }` — or `{ "reply": "...leave a message...", "source": "unavailable" }` when no `OPENAI_API_KEY`.

#### POST `/api/support/escalate`  🔒 — "talk to a human"
**Input** `{ "message": "I can't change my home court — is that a bug?" }`
**Output `200`** `{ "ok": true, "emailed": false, "ticketId": 1 }` — persists a `support_tickets` row (source of truth) and best-effort emails the inbox.

### 3.9 Admin  🛡

All require `is_admin`. Non-admins get `403`.

#### GET `/api/admin/overview` · `/api/admin/stats`
Aggregate counts for the ops dashboard: users, active/suspended, sessions,
courts, open reports, open tickets.

#### GET `/api/admin/users?page=1&perPage=25&status=active&sport=Pickleball`
Paged, filterable user list. `GET /api/admin/users/<id>` returns one full record.

#### PATCH `/api/admin/users/<id>`
Edit name/email/handle/location/coords, per-sport ratings, admin flag, and
suspend/reactivate. **Input** e.g. `{ "isActive": false }` → suspends (and revokes tokens).
`DELETE /api/admin/users/<id>/photo` strips a user's profile photo (sample I/O in §3.3).

#### GET `/api/admin/reports` · PATCH `/api/admin/reports/<id>`
The trust & safety queue. Resolving:
**Input** `{ "status": "reviewed", "note": "Confirmed no-show pattern.", "suspend": true }`
→ sets the report `status` and, when `suspend` is true, flips the reported
user's `is_active` to `false` in the same step.

#### GET `/api/admin/support` · PATCH `/api/admin/support/<id>`
The support desk. Resolving: **Input** `{ "status": "closed", "note": "Explained the fix over email." }`.

#### GET/POST/PATCH/DELETE `/api/admin/courts`
Full court CRUD. `POST` **Input** `{ "name": "...", "slug": "...", "lat": .., "lng": .., "sports": ["Tennis"] }`.
`DELETE` soft-closes (sets `is_active = false`), preserving history.

---

## 4. Where to run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py           # creates rallypoint.db with 6 users + 8 courts
python app.py            # → http://localhost:5050
# Browse the interactive spec:
open http://localhost:5050/api/docs/
```

The full, captured request → response → **database change** transcript for a
39-call end-to-end run is in `MILESTONE_2_TEST_RESULTS.md` (and the raw
`api_demo_output.txt`), reproducible with `python api_demo.py`.
