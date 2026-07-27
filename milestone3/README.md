# RallyPoint — Milestone 3 Submission (Frontend & Backend Integration)

Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University
Repository: https://github.com/phoebewong214/rallypoint
Live app: **https://app.tryrallypoint.com** · Live API: `https://api.tryrallypoint.com` (Swagger at `/api/docs/`)

This is the index for the Milestone 3 submission. RallyPoint is an AI-powered
tennis/pickleball partner-matching app for Chicago public courts; Milestone 3
delivers the **React frontend fully integrated with the Flask REST API and
the PostgreSQL database behind it** — deployed and testable in production.

---

## What was built

A **React 19 + TypeScript** single-page app (10 pages) integrated with the
Milestone 2 backend (9 blueprints, 60 REST endpoints, 17 tables):

- **A single typed integration layer** — one fetch wrapper handles auth
  cookies, CSRF, structured errors, session expiry, and free-tier cold
  starts; nine typed API modules make backend contract changes fail CI.
- **TanStack Query** server state — cache, retries, and invalidation so every
  mutation refetches DB truth.
- **Full feature set through the UI**: signup/email verification, AI partner
  matching with reason chips, saved players, two-phase game invites with time
  negotiation, sessions timeline, courts with distance + favorites +
  check-ins + open games, profile with photo and weekly/date-specific
  availability, admin dashboard, and a support widget.
- **In production**: Vercel (frontend) + Render (API + PostgreSQL) with
  cross-subdomain cookie auth.

## Deliverables → rubric map

| Rubric criterion | Points | Deliverable | Where |
|---|---:|---|---|
| **Successful API Integration** | 30 | How the frontend calls all 60 REST endpoints: the fetch wrapper, typed modules, query hooks, auth flow, plus an end-to-end request walkthrough | **[MILESTONE_3_INTEGRATION.md](./MILESTONE_3_INTEGRATION.md)** §1–2, §4–5 |
| **Functional User Interface** | 20 | 10 working pages, live at app.tryrallypoint.com; demonstrated in the video | Integration doc §3 + live app + video |
| **Database Interaction via Front-End** | 20 | Page → endpoint → table map covering all 17 tables; manual test plan showing the DB effect of each UI action | Integration doc **§3** + test doc **§3** |
| **Testing and Debugging** | 20 | 124 backend + 7 frontend automated tests (CI on every push), typecheck as contract test, manual E2E plan, six diagnosed integration bugs | **[MILESTONE_3_TEST_RESULTS.md](./MILESTONE_3_TEST_RESULTS.md)** + **[ISSUES_AND_RESOLUTIONS.md](./ISSUES_AND_RESOLUTIONS.md)** |
| **Code Quality and Submission** | 10 | Typed end to end, CI-gated PR workflow (56 merged PRs), docs: [README](../README.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [DEPLOY.md](../DEPLOY.md) | repo root |

Assignment requirements checklist:

- [x] **Front-end integrated with the backend via REST APIs** — every screen
  is API-driven; no hard-coded data.
- [x] **Front-end interactions tested against the database layer via REST** —
  124 automated API+DB tests, 12-step manual E2E plan, live DB-evidence run
  from M2.
- [x] **GitHub repository with code and documentation** — this repo.
- [ ] **Demonstration video** incl. issues encountered & resolutions — script
  ready; the six issues to mention are in
  [ISSUES_AND_RESOLUTIONS.md](./ISSUES_AND_RESOLUTIONS.md) (to be recorded).

## Contents of this folder

| File | What it is |
|---|---|
| [MILESTONE_3_INTEGRATION.md](./MILESTONE_3_INTEGRATION.md) | The integration architecture + page→API→table map |
| [ISSUES_AND_RESOLUTIONS.md](./ISSUES_AND_RESOLUTIONS.md) | Six integration bugs: symptom → diagnosis → fix |
| [MILESTONE_3_TEST_RESULTS.md](./MILESTONE_3_TEST_RESULTS.md) | Automated + manual test results and debugging practices |
| [pytest_output.txt](./pytest_output.txt) | Full backend suite transcript — 124 passed |
| [vitest_ci_output.txt](./vitest_ci_output.txt) | Frontend suite + typecheck + build transcript from CI on `main` |

## How to run the integrated app from a clean checkout

```bash
# Terminal 1 — backend API on :5050
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py            # 6 users, 8 Chicago courts, 6 sessions
python app.py

# Terminal 2 — frontend on :3000 (Vite proxies nothing; it calls :5050 directly)
cd frontend
npm ci
npm run dev
```

Sample logins after `seed.py` (password `rally1234`): `alex@rally.app`,
`maya@rally.app`, `jordan@rally.app`, `marcus@rally.app`, `sofia@rally.app`,
`aisha@rally.app`. Or just use the live app — the production deployment is
the same code on `main`.
