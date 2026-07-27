# Milestone 3 — Integration Issues Encountered & How They Were Resolved

Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University

The rubric asks for the issues encountered while integrating the frontend
with the backend, and how they were resolved. These are the six most
instructive ones, in the order they were hit. (Two additional backend-side
issues — a Flask-Limiter circular import and a Pydantic/Python 3.14 build
failure — were written up in Milestone 2:
[issue #1](../milestone2/issue_diagnosis_1_flask_limiter_circular_import.md),
[issue #2](../milestone2/issue_diagnosis_2_pydantic_python314_pyo3.md).)

---

## Issue 1 — Login worked locally but not in production (cross-site cookies)

**Symptom.** Locally everything worked. Deployed (frontend on Vercel, API on
Render), login returned 200 — but every subsequent request was 401. The JWT
cookie was set and then never sent back.

**Diagnosis.** The auth cookie is `httpOnly` + `SameSite=Lax`. With the
frontend on `*.vercel.app` and the API on `*.onrender.com`, the two are
**different sites**, so the browser silently refuses to attach the cookie to
API requests. Nothing errors — the request simply arrives anonymous.

**Resolution.** Put both apps on subdomains of one domain —
`app.tryrallypoint.com` + `api.tryrallypoint.com` — and scope the cookie with
`COOKIE_DOMAIN=.tryrallypoint.com`, plus
`CORS_ORIGINS=https://app.tryrallypoint.com` with credentials enabled. Same
site → the cookie flows; `SameSite=Lax` + the double-submit CSRF token keep
it safe. This constraint is now documented at the top of
[DEPLOY.md](../DEPLOY.md) so it never has to be rediscovered.

## Issue 2 — First request after idle took ~50 s and looked like a crash

**Symptom.** Opening the live site after some hours of inactivity, every page
sat on loading skeletons for up to a minute. Testers assumed the app was
broken and left.

**Diagnosis.** Render's free tier puts the API to sleep after inactivity; the
first request triggers a cold start (~50 s). Aborting with a timeout would be
exactly wrong — that first request is *what wakes the server up*.

**Resolution.** In [client.ts](../frontend/src/api/client.ts): never abort;
instead, any request older than 4 s flips a ref-counted `api:slow` flag that
shows a non-blocking "server is waking up" banner (`WakeBanner`), which
clears itself when the ref count returns to zero. A scheduled keep-warm ping
reduces how often users ever see it. UX problem solved without pretending the
infra constraint doesn't exist.

## Issue 3 — Email verification links 404'd in production

**Symptom.** Signup emails link to `https://app.tryrallypoint.com/verify-email?token=…`.
Clicking one in production returned Vercel's 404 page, breaking the whole
signup funnel — while the same route worked fine when navigated to in-app.

**Diagnosis.** The frontend is an SPA: `/verify-email` only exists in
react-router, in the browser. A hard load asks Vercel's static server for a
file called `/verify-email`, which doesn't exist.

**Resolution.** `frontend/vercel.json` rewrites every path to `/index.html`,
letting react-router take over on any deep link. One-line fix, but only after
diagnosing that "works in-app, 404s from email" pattern.

## Issue 4 — Profile photos: authenticated images that `<img>` can't fetch

**Symptom.** Avatars rendered as broken images in production even though the
photo-upload API worked and the bytes were in the database.

**Diagnosis.** Photos are served by the API domain, and `<img>` tags don't
attach the cross-site auth cookie — so an authenticated photo endpoint always
got anonymous requests and 401'd. A second, subtler problem: after changing a
photo, browsers kept showing the cached old one.

**Resolution.** Made the photo read endpoint (`GET /players/{id}/photo`) a
**public GET** — an explicit, documented trade-off (photos are already shown
to all logged-in players; uploads/deletes stay authenticated) — and appended a
`?v=<photoVersion>` cache-buster that increments on every upload. A bonus
catch: the shared `SavedPlayer` type was missing `photoVersion`, and the
**frontend CI typecheck** failed the build (commit `3e9ff85`) — exactly the
API-contract safety the typed integration layer is there to provide.

## Issue 5 — Right after merging a full-stack PR, the new feature 404'd

**Symptom.** Minutes after merging the profile-photos PR, the live frontend
threw 404s on the new photo endpoints. It looked like the feature was broken
in production.

**Diagnosis.** Both platforms auto-deploy on push to `main`, but not at the
same speed: Vercel ships the new frontend in ~1–2 min, Render takes several
minutes more. In that window the **new frontend** calls endpoints the **old
backend** doesn't have yet.

**Resolution.** Treat it as a known deploy race: after merging a full-stack
PR, probe the API first (`curl` the new endpoint — a JSON error means the new
backend is live, an HTML 404 means it isn't yet) before testing the UI. The
long-term fix would be backend-first ordering or versioned deploys; for this
project's scale, the documented playbook is enough.

## Issue 6 — New columns silently missing from the production database

**Symptom.** Features that added a column (e.g. `bio_embedding` for semantic
matching) worked locally but 500'd in production: `column does not exist`.

**Diagnosis.** Render's free tier has no shell/jobs, so the schema is created
at boot via `create_all()` — which **creates missing tables but never ALTERs
existing ones**. Any column added after a table's first deploy simply never
appears in PostgreSQL.

**Resolution.** `backend/manage.py init-db` now runs `_ensure_columns()`: an
idempotent, DB-agnostic helper that issues `ALTER TABLE … ADD COLUMN` for any
column listed in an `_ENSURE_COLUMNS` dict. Adding a column is now a
two-line, documented process (model + dict entry), and boot-time schema sync
is safe to run on every deploy.

---

**The common thread:** every one of these bugs lived *between* the layers —
browser cookie policy, CDN routing, deploy timing, schema drift — not inside
either codebase. The fixes that lasted were the ones that turned a debugging
session into a guardrail: a typed API layer that fails CI, a documented
deploy playbook, and an idempotent schema-sync step.
