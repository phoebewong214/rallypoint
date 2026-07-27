# Milestone 3 — Frontend & Backend Integration

Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University
Live app: https://app.tryrallypoint.com · Live API: https://api.tryrallypoint.com

This document explains **how the React frontend is integrated with the Flask
backend via REST APIs**, and maps every page of the UI to the endpoints it
calls and the database tables those endpoints read/write.

---

## 1. Architecture at a glance

```
┌─────────────────────────┐   HTTPS + JSON (REST)   ┌──────────────────────────┐
│  React 19 + TypeScript  │ ──────────────────────► │  Flask 3 REST API        │
│  Vite build → Vercel    │   httpOnly-cookie JWT   │  9 blueprints, 60 routes │
│  app.tryrallypoint.com  │ ◄────────────────────── │  api.tryrallypoint.com   │
└─────────────────────────┘                         └───────────┬──────────────┘
        TanStack Query cache                            SQLAlchemy ORM
        (retry, invalidation)                               │
                                                ┌───────────▼──────────────┐
                                                │  PostgreSQL (Render)     │
                                                │  17 tables               │
                                                │  SQLite in local dev     │
                                                └──────────────────────────┘
```

- **Every** piece of data on screen comes from the REST API — there is no
  hard-coded data in the frontend. Delete the API and the app renders only
  skeletons and error states.
- The same frontend runs against local dev (`http://localhost:5050/api`) and
  production (`VITE_API_URL`) with **zero code changes**.

## 2. The integration layer, file by file

### 2.1 One fetch wrapper: [`frontend/src/api/client.ts`](../frontend/src/api/client.ts)

All 60 endpoints are called through a single `api<T>()` function that
centralizes the cross-cutting concerns:

| Concern | How it is handled |
|---|---|
| Base URL | `VITE_API_URL` env var (prod) with a `localhost:5050` dev fallback |
| Auth | JWT lives in an **httpOnly cookie** — JS never touches the token; every request sends `credentials: "include"` |
| CSRF | For unsafe methods the readable `rp_csrf` cookie is echoed in an `X-CSRF-Token` header (double-submit-cookie defense) |
| Errors | Non-2xx responses throw a typed `ApiError { status, body }`; pages render the structured message, not a blank screen |
| Session expiry | A 401 fires a global `auth:expired` event → `AuthContext` signs the user out everywhere at once |
| Cold starts | If any request exceeds 4 s (Render free tier waking up, ~50 s), a ref-counted `api:slow` event shows a non-blocking "server waking up" banner instead of aborting |

### 2.2 Typed API modules: `frontend/src/api/*.ts`

Nine modules (`auth`, `players`, `savedPlayers`, `invites`, `sessions`,
`courts`, `appointments`, `support`, `admin`) wrap `api<T>()` with TypeScript
request/response types, so a backend shape change fails the frontend
**typecheck in CI** instead of failing at runtime.

### 2.3 Server state: TanStack Query hooks (`frontend/src/hooks/`)

`usePlayers`, `useSessions`, `useInvites`, `useCourts`, `useCourtDetail`,
`useSavedPlayers` wrap the API modules with **TanStack Query**: caching,
retries, loading/error states, and — most importantly — **invalidation**:
after any mutation (e.g. accepting an invite) the affected query keys are
invalidated and the UI refetches from the database, so what you see is always
DB truth, never optimistic guesswork.

### 2.4 Auth state: [`frontend/src/contexts/AuthContext.tsx`](../frontend/src/contexts/AuthContext.tsx)

On mount the app calls `GET /api/auth/me`; a valid cookie hydrates the user,
anything else renders the login page (`ProtectedRoute` guards every private
route). Login/signup/logout all go through the same REST endpoints.

## 3. Page → REST API → database table map

URL prefixes: `auth → /api/auth`, `players → /api/players`, `sessions →
/api/sessions`, `courts → /api/courts`, `invites → /api/invites`, `admin →
/api/admin`, `support → /api/support`, `ai → /api/ai`, appointments under
`/api`.

| Page (route) | Main user actions | REST endpoints called | Tables read/written |
|---|---|---|---|
| **Login** (`/`) | Sign up (with preferred times + neighborhood onboarding), log in | `POST /auth/signup` · `POST /auth/login` | `users`, `sport_profiles`, `availability_slots` |
| **Verify email** (`/verify-email`, pending page) | Verify token, resend link | `POST /auth/verify-email` · `POST /auth/resend-verification` | `users` |
| **Reset password** (`/reset-password`) | Request + perform reset | `POST /auth/forgot-password` · `POST /auth/reset-password` | `users` |
| **Find Partner** (`/find`) | AI-matched player list with reason chips, filters; save a player; two-phase game invite; report a player | `GET /players` (scoring + semantic signal) · `POST/DELETE /players/{id}/save` · `POST /invites` · `POST /players/{id}/report` · `GET /courts` | `users`, `sport_profiles`, `availability_slots`, `availability_overrides`, `saved_players`, `game_invites`, `user_reports`, `ai_match_logs` |
| **Profile** (`/profile`) | Edit profile & ratings, weekly availability grid, date-specific overrides, upload/remove photo, saved-players list | `PATCH /auth/me` · `PUT/DELETE /auth/me/photo` · `GET /players/saved` · `GET /players/{id}/photo` | `users`, `sport_profiles`, `availability_slots`, `availability_overrides`, `user_photos`, `saved_players` |
| **Sessions** (`/sessions`) | Timeline of games; accept/decline/cancel/reschedule; negotiate invite times | `GET /sessions` · `POST /sessions/{id}/accept·decline·cancel·reschedule` · `GET /invites` · `POST /invites/{id}/confirm-opponent·propose-time·accept-time·decline·cancel` | `sessions`, `game_invites`, `time_proposals` |
| **Courts** (`/courts`) | Browse Chicago courts by distance, favorite | `GET /courts` (Haversine sort) · `POST/DELETE /courts/{slug}/favorite` | `courts`, `court_favorites` |
| **Court detail** (`/courts/:slug`) | Open games (create/join/leave/delete), check in at the court | `GET /courts/{slug}` · `POST /courts/{slug}/appointments` · `POST /appointments/{id}/join·leave` · `DELETE /appointments/{id}` · `POST/DELETE /courts/{slug}/checkin` | `court_appointments`, `appointment_participants`, `court_checkins` |
| **Admin** (`/admin`) | Ops stats, user CRUD + moderation, reports, support desk, court CRUD | `GET /admin/stats·overview·users·reports·support·courts` · `PATCH/DELETE /admin/users/{id}` · `PATCH /admin/reports/{id}` · `PATCH /admin/support/{id}` · `POST/PATCH/DELETE /admin/courts` | `users`, `user_photos`, `user_reports`, `support_tickets`, `courts` |
| **Support widget** (every page) | AI support chat, escalate to a ticket | `POST /support/chat` · `POST /support/escalate` | `support_tickets` |

Every write goes through **Pydantic v2 validation** on the backend (bad input
→ structured `422`, surfaced by `ApiError` in the UI) and through
**SQLAlchemy** into the database — the frontend never talks to the DB
directly, and the backend never renders UI. Clean REST separation.

## 4. One request, end to end (worked example)

"Alex invites Maya to play" on the Find Partner page:

1. UI: Alex picks a court + proposed times → `useCreateInvite().mutate(...)`.
2. `invitesApi.create()` → `api("/invites", { method: "POST", body })` —
   fetch attaches the auth cookie and `X-CSRF-Token` header.
3. Flask `invites` blueprint: JWT decoded → Pydantic validates the body →
   business rules checked (no duplicate open invite, etc.).
4. SQLAlchemy inserts a `game_invites` row (status `pending_opponent`) plus
   its `time_proposals` rows; the response returns the serialized invite.
5. TanStack Query invalidates `["invites"]`; Sessions page refetches
   `GET /api/invites` and Maya sees the invite — read fresh from PostgreSQL.
6. Failure paths: `422` renders field errors; `401` logs out via
   `auth:expired`; a sleeping server shows the wake-up banner and the request
   completes when Render is up.

## 5. Cross-domain auth (prod-specific integration work)

Frontend (`app.tryrallypoint.com`, Vercel) and API (`api.tryrallypoint.com`,
Render) are different origins, so the integration relies on:

- Cookies scoped to `COOKIE_DOMAIN=.tryrallypoint.com` with `SameSite=Lax` —
  both subdomains are the same *site*, so the auth cookie flows.
- `CORS_ORIGINS=https://app.tryrallypoint.com` with credentials allowed.
- `<img>` tags can't send the cross-site auth cookie, so profile photos are a
  **public GET** (`/players/{id}/photo`) with a `?v=<photoVersion>`
  cache-buster instead of an authenticated blob fetch.

See [ISSUES_AND_RESOLUTIONS.md](./ISSUES_AND_RESOLUTIONS.md) for the problems
this design had to solve.
