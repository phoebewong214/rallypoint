# Issue Diagnosis #2 — Pydantic v2 install fails on Python 3.14 (pydantic-core / PyO3)

**Project:** RallyPoint (Milestone 2 backend)
**Stack:** Python 3.14.4, Pydantic 2.x, Flask 3.0.3

---

## Symptom

Setting up the backend on a fresh venv, `pip install -r requirements.txt`
crashed in the middle of installing `pydantic-core`:

```
error: failed to run custom build command for `pydantic-core v2.x`
...
PyO3's maximum supported version is 3.12, but you are linking against
Python 3.14. Update PyO3 or downgrade Python.
```

`pydantic` (the pure-Python facade) installed fine; the Rust extension
`pydantic-core` did not. Without it, no validation runs and every request
to a Pydantic-validated endpoint would 500.

---

## Diagnosis

Pydantic v2 split itself into two packages:

- `pydantic` — the user-facing Python API
- `pydantic-core` — a Rust core compiled via PyO3, shipped as
  per-CPython-version wheels (cp310, cp311, cp312, ...)

When `pip` can't find a prebuilt wheel matching the active Python ABI, it
tries to build from source. Building from source needs a Rust toolchain
**plus** a `pyo3` version that supports your CPython. The `pydantic-core`
version pinned in older Pydantic releases used a PyO3 with a 3.12 ceiling,
so Python 3.14 fell off the supported range.

I confirmed it was a wheel-availability issue (not a Rust install issue)
by running:

```bash
pip download pydantic-core --no-deps --only-binary=:all:
# → "No matching distribution found for pydantic-core" on Python 3.14
```

That made it clear: the fix was on the Pydantic side, not my toolchain.

---

## Resolution

Pinned Pydantic to a version recent enough to ship cp314 wheels:

```diff
# backend/requirements.txt
- pydantic[email]>=2.0
+ pydantic[email]>=2.11.0
```

Pydantic 2.11 bumped its bundled `pydantic-core` to a release with PyO3
0.22+, which lists Python 3.14 in its compatibility matrix and publishes
cp314 wheels on PyPI. After the version bump:

```bash
pip install -U pip
pip install -r requirements.txt
# → pydantic-core installs from the prebuilt cp314 wheel, no Rust needed
```

Verified with `pytest`: all 11 backend tests (including the four that
exercise the Pydantic `LoginSchema` / `SignupSchema` 422 path) pass.

---

## Lessons learned

1. **Python 3.14 is still very fresh.** Any package with native code is a
   candidate for this exact failure mode. The fix is almost always
   "upgrade the native-code package", not "install Rust" — pinning to
   the latest version is the right first move.
2. **`pip download --only-binary=:all:`** is a quick way to test whether
   a wheel exists for your CPython before going down the
   build-from-source rabbit hole.
3. **The error message blamed PyO3, but PyO3 wasn't the layer I needed to
   touch.** PyO3 is internal to `pydantic-core`; bumping the parent
   package is the only handle the user has. The lesson: when a Rust
   ext blows up in Python, climb back up to the *Python* package and
   look for a newer release before fighting the toolchain.

---

## Why I didn't downgrade Python instead

I considered it. Python 3.13 would have made the error go away in five
minutes. But:

- The frontend was already on Node 22 / Vite 6 — modern stack everywhere.
- Pinning Pydantic forward is one number; pinning Python backward
  cascades into venv recreation across team machines.
- Future me will install more native-code packages. Fixing the pattern
  once is cheaper than handling it per-package.

So: pin forward, not down. Recorded as ADR-style note in
`ARCHITECTURE.md`.
