"""
Production WSGI entrypoint for the gevent worker (render.yaml / Procfile):

    gunicorn wsgi_gevent:app -k gevent --workers 1

gevent must monkey-patch the stdlib BEFORE anything imports socket/ssl, so this
module patches first and only then imports the app. (gunicorn's `-k gevent`
also patches, but only when the app isn't preloaded — importing through this
file makes the order explicit and preload-proof.) With the patch in place,
blocking calls (OpenAI, SMTP/Resend, photo upload) yield to the event loop
instead of stalling every open SSE stream on the single worker.

Known limitation: psycopg2 is a C driver gevent can't patch, so each DB query
still blocks the loop for its (short) duration — same stall profile as any
sync worker, acceptable at this app's query sizes.
"""
from gevent import monkey

monkey.patch_all()

from app import app  # noqa: E402,F401  — must import AFTER monkey.patch_all()
