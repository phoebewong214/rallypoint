# RallyPoint — Milestone 2 Submission (Backend Component)

Author: Phoebe Wang · ACIS 498 Capstone, Northwestern University
Repository: https://github.com/phoebewong214/rallypoint
Live API: `https://api.tryrallypoint.com` · Interactive docs: `/api/docs/`

This is the index for the Milestone 2 (Backend Component) submission. RallyPoint
is an AI-powered tennis/pickleball partner-matching app; Milestone 2 delivers the
**backend REST API fully integrated with a relational database**.

---

## What was built

A **Flask 3 + SQLAlchemy** REST API — an application factory with **9 blueprints**
exposing **55 endpoints** over **15 database tables**, with:

- **JWT auth** (httpOnly cookie + CSRF for browsers, `Authorization: Bearer` for
  API clients), token revocation, email verification, and password reset.
- **Pydantic v2 validation** on every write body → structured 422s, never 500s.
- **AI matching**: a transparent, explainable 0–100 scoring heuristic plus an
  optional semantic bio-embedding "playing style" signal, each emitting a reason
  chip; an optional LLM rewrites reason *wording* only.
- **Full feature set**: partner matching, saved players, courts with real
  Haversine distance, check-ins, open games with a waitlist, two-phase game
  invites, an admin dashboard, trust & safety reports, and a support desk.
- **PostgreSQL-ready**: one `DATABASE_URL` switch from dev SQLite to prod
  Postgres, no code change (already live on Render).

---

## Deliverables → rubric map

| Rubric criterion | Points | Deliverable | Where |
|---|---:|---|---|
| **API List with Expected Input/Output + Test Case Documentation** | 20 | Complete endpoint list with auth, expected input, and sample JSON I/O for all 55 routes | **[MILESTONE_2_API_REFERENCE.md](./MILESTONE_2_API_REFERENCE.md)** + interactive Swagger at `/api/docs/` |
| **Database Design and Implementation** | 20 | 15-table schema: ER diagram, per-table columns/types/keys/constraints, indexes, design rationale, generated DDL | **[MILESTONE_2_DATABASE_DESIGN.md](./MILESTONE_2_DATABASE_DESIGN.md)** + [schema_ddl.sql](./schema_ddl.sql) |
| **API Testing Results and Live demonstration** | 60 | 120 passing automated tests + a 36-call live run showing the DB change after **each** operation | **[MILESTONE_2_TEST_RESULTS.md](./MILESTONE_2_TEST_RESULTS.md)** + [pytest_output.txt](./pytest_output.txt) + [api_demo_output.txt](./api_demo_output.txt) |

Assignment requirements checklist:

- [x] **Finalized backend APIs** to support the capstone solution — 55 endpoints.
- [x] **List of APIs with expected input/output + sample JSON** — API reference.
- [x] **Database design and tables** — 15 tables, ER diagram, DDL.
- [x] **Test case documents and test results** — 120 tests + case table.
- [x] **Full integration with the database** — every endpoint reads/writes via
  SQLAlchemy; the live demo proves the DB updates per operation.
- [x] **Working backend API code with test results** — `pytest` green, in CI.
- [x] **Evidence of the database update after EACH operation** — the
  `api_demo.py` transcript prints the row-level delta after every write.
- [ ] **6–10 minute video** — script in
  [MILESTONE_2_DEMO.md](./MILESTONE_2_DEMO.md) (to be recorded).

---

## How to run everything from a clean checkout

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Automated tests  → 120 passed
pytest -v

# 2. Live DB-evidence demo  → request/response/DB-delta for 36 calls
python api_demo.py

# 3. Run the server + browse the interactive API
python seed.py          # 6 users, 8 Chicago courts, 6 sessions
python app.py           # → http://localhost:5050
open http://localhost:5050/api/docs/
```

Sample logins after `seed.py` (password `rally1234`): `alex@rally.app`,
`maya@rally.app`, `jordan@rally.app`, `marcus@rally.app`, `sofia@rally.app`,
`aisha@rally.app`.

---

## Tech stack (backend)

| Layer | Choice |
|---|---|
| Framework | Flask 3 (application factory + blueprints) |
| ORM / DB | SQLAlchemy + Flask-Migrate · SQLite (dev) → PostgreSQL (prod) |
| Auth | PyJWT (HS256, 7-day) · httpOnly cookie + double-submit CSRF · Flask-Limiter |
| Validation | Pydantic v2 |
| AI | Explainable heuristic + OpenAI bio embeddings (optional LLM for wording) |
| Docs | flasgger (Swagger/OpenAPI) at `/api/docs/` |
| Tests | pytest + pytest-flask (120 cases, CI on every push) |

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full data model and the
architecture decision records (ADRs) explaining each choice.
