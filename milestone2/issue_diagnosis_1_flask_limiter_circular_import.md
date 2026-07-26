# Issue Diagnosis #1 — Flask-Limiter circular import in app-factory layout

**Project:** RallyPoint (Milestone 2 backend)
**Stack:** Flask 3.0.3, Flask-Limiter 3.8.0, Flask-SQLAlchemy 3.1.1

---

## Symptom

After adding rate limiting to the `/api/auth/login` route to prevent brute-force
attacks, the Flask app refused to start:

```
ImportError: cannot import name 'limiter' from partially initialized module
'app' (most likely due to a circular import)
```

The failure happened on the first request, not on import — which made it
easy to miss in unit tests that don't hit the app object.

---

## Diagnosis

I sketched the import graph by hand:

```
app.py
 └── creates `limiter = Limiter(...)`
 └── imports register_blueprints from routes/__init__.py
        └── imports auth_bp from routes/auth.py
              └── needs `from app import limiter`  ← cycle
```

The cycle exists because the `Limiter` instance lived in the same module
(`app.py`) as the application factory that registers the blueprints. Any
blueprint that wants to *use* `@limiter.limit(...)` has to import from
`app.py` *while* `app.py` is itself mid-import of that very blueprint.

This is the same family of bug as the classic Flask-SQLAlchemy circular
import — anything you want to share between blueprints and the factory
cannot live in the factory module.

---

## Resolution

Created a dedicated `extensions.py` module that holds **bare** extension
singletons with no app attached yet:

```python
# backend/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute"],
)
```

Then `app.py` calls `limiter.init_app(app)` *inside* the factory, and any
blueprint imports `from extensions import limiter` — which works because
`extensions.py` has no dependency on `app.py` or the blueprints.

```python
# routes/auth.py
from extensions import limiter

@auth_bp.post("/login")
@limiter.limit("10 per minute")
def login(): ...
```

---

## Why this matters

The "extensions module" pattern is documented in the Flask docs but only as
an aside for big apps. For a 5-blueprint capstone it is already the right
choice — without it, every new blueprint that wants `limiter`, `db`, or
`migrate` recreates the cycle. The cost is one extra file; the payoff is
that the dependency graph stops having any cycles at all.

If you are reading this and hit the same error: do **not** try to import
inside the function body, do **not** delay the decorator with a factory
function. Move the extension to its own module. Five lines of refactor,
zero workarounds.
