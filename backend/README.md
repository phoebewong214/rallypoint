# RallyPoint backend

Flask 3 + SQLAlchemy + Alembic API. Full setup (venv, `.env`, seeding, sample
logins) is in the [root README](../README.md); architecture decisions are in
[ARCHITECTURE.md](../ARCHITECTURE.md). This file covers backend-local notes.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt         # Apple Silicon + Python 3.13+: see the psycopg2 note under Tests
cp .env.example .env
python seed.py     # create DB + sample users
python app.py      # → http://localhost:5050
```

`python app.py` runs the Flask dev server with `threaded=True` (one thread per
request). That matters for SSE: `GET /api/stream` holds its connection open, so
without threading a single connected tab would starve every other request. If
you change how the server is launched, keep threading on — or run the
production stack instead:

```bash
pip install gunicorn gevent   # already in requirements.txt
gunicorn wsgi_gevent:app --bind 0.0.0.0:5050 -k gevent --workers 1
```

## SSE / realtime invites

- `GET /api/stream` is a long-lived `text/event-stream` (cookie or Bearer
  auth). It emits `{"type": "invites"}` nudges when either party of an invite
  acts, plus a keepalive comment every `STREAM_HEARTBEAT_SECONDS` (default 15).
- The pub/sub broker (`services/stream.py`) is **in-process**. Production must
  therefore run a **single** worker (`-k gevent --workers 1`, see render.yaml);
  with N workers, a publisher in one process can't reach subscribers in
  another. Scaling beyond one worker needs a shared broker (e.g. Redis
  pub/sub) — out of scope for now.
- `wsgi_gevent.py` monkey-patches before importing the app so blocking calls
  (OpenAI, SMTP/Resend, photo upload) cooperate with the event loop. psycopg2
  is a C driver gevent can't patch; short queries block the loop briefly,
  which is acceptable at this app's sizes.
- `subscribe()` caps concurrent streams per user (`MAX_STREAMS_PER_USER`) and
  evicts the oldest past the cap — the endpoint is rate-limit-exempt, so this is
  what stops one account from opening unbounded connections on the single
  worker.
- Dev only: the browser holds one long-lived HTTP/1.1 connection per open tab
  for the stream, counting against its ~6-per-host cap; many tabs on
  `localhost` can crowd out other requests. Production is served over HTTP/2
  (multiplexed), where this doesn't apply.

## Tests

```bash
pytest          # in-memory SQLite; no Postgres needed
```

Note for Apple Silicon + newer Pythons (e.g. 3.14): `psycopg2-binary` may lack
a wheel and fail to build locally. Tests don't need it — install everything
else with `grep -v psycopg2-binary requirements.txt | pip install -r /dev/stdin`.
Production installs it from a wheel on the Python `.python-version` requests
(3.12 — Render resolves it to the latest patch release); set `PYTHON_VERSION`
in the Render dashboard if that file is ever not honored. (`runtime.txt` is a
Heroku convention Render ignores — don't reintroduce it.)
