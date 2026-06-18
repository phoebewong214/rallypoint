# AI Tool Disclosure

Per ACIS 498 syllabus requirements ("Use of Generative AI" section),
this document records all AI tool usage in the development of RallyPoint.

---

## Tools used

| Tool | Provider | What for |
|---|---|---|
| Claude (Opus 4.7) | Anthropic | Pair programming, architecture review, debugging |
| ChatGPT (occasional) | OpenAI | Quick syntax lookups |

---

## Where AI was used

### Scaffolding & boilerplate
- Initial React component templates for the 7 pages
- Pydantic schema boilerplate (LoginSchema, SignupSchema, etc.)
- Flask blueprint stubs

### Debugging
- Diagnosed a CSS cascade bug (duplicate `.hero-badges` rule between
  Profile and Courts page sections)
- Resolved Vite + Python 3.14 + Pydantic-core PyO3 compatibility issue
- Fixed CSS Grid cascading-displacement bug on the Schedule page calendar
- Helped trace circular import in Flask-Limiter initialization

### Architecture review
- Discussed trade-offs between CRA / Vite / Next.js
- JWT in localStorage vs httpOnly cookies (security trade-off)
- Heuristic AI matching vs full LLM (documented in ADR-007)
- See `ARCHITECTURE.md` for full Architecture Decision Records

### Writing
- README.md and ARCHITECTURE.md initial drafts
- Test case scaffolding (pytest fixtures, Vitest setup)

---

## What I did NOT use AI for

- **Project scoping**: Decision to build a sports partner matching app,
  feature list, target audience — all my own.
- **Database schema design**: 6 tables (User, SportProfile, Court,
  Session, AvailabilitySlot, FeedPost, AIMatchLog) were designed
  based on the app requirements I scoped.
- **The AI matching algorithm itself**: The heuristic scoring rules
  (NTRP closeness + same primary sport + same city + availability
  overlap, weighted to 0–100) are my own design.
- **Real Chicago court data**: Lat/lng for the 8 courts were
  hand-verified against Google Maps.
- **All architectural decisions**: AI suggested options; I picked
  and documented the rationale in ADRs.

---

## Example prompts used

A few representative prompts (full transcripts available on request):

> "Help me design a SQLAlchemy schema for an app where users can have
> multiple sport profiles, each with their own NTRP rating."

> "Review my Pydantic validator for the NTRP field — does this catch
> all the invalid values?"

> "Why is my CSS Grid calendar showing time labels in the wrong column?"
> (This led to discovering the cascading-displacement bug.)

> "What's the right way to handle 401 errors globally in TanStack Query?"

---

## My responsibilities

I have read and personally understand every line of code in this project.
Specifically, I can explain (without AI assistance):

- How JWT auth flows from `/api/auth/login` → AuthContext → protected routes
- The Pydantic validation pipeline including the 422 response format
- The TanStack Query cache invalidation pattern used in `useSessions`
- The heuristic matching algorithm in `backend/services/matching.py`
- The CSS Grid layout strategy for the Schedule page calendar
- The Leaflet integration for the Courts map

If asked to modify or extend any part of the code in a live setting,
I am able to do so.

---

_Disclosure last updated: 2026-05-27_
