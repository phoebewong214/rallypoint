/* ============================================================
   API client — fetch wrapper.
   - Auth rides in an httpOnly cookie (set by the backend), so we send
     credentials: "include" and never touch the JWT from JS.
   - VITE_API_URL points to the deployed API in production; localhost is only
     the Vite dev fallback.
   - For unsafe methods we echo the readable CSRF cookie in X-CSRF-Token
     (double-submit-cookie CSRF defense).
   - Parses JSON, throws ApiError on non-2xx.
   - On 401, fires a 'auth:expired' window event so AuthContext can logout.
   ============================================================ */

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:5050/api";
  throw new Error("Missing VITE_API_URL for production build.");
}

const API_BASE = resolveApiBase();

const CSRF_COOKIE = "rp_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/* Free-tier cold start: Render sleeps after inactivity and the first request can
   take ~50s. We must NOT abort (a request that's waking the server up should be
   allowed to finish) — instead we flag the request "slow" after a threshold and
   broadcast it (ref-counted across concurrent requests) so the UI can show a
   non-blocking "server waking up" banner. */
const SLOW_AFTER_MS = 4000;
let slowCount = 0;
function setSlow(delta: number): void {
  const before = slowCount;
  slowCount = Math.max(0, slowCount + delta);
  if (typeof window === "undefined") return;
  if (before === 0 && slowCount > 0) window.dispatchEvent(new CustomEvent("api:slow", { detail: true }));
  else if (before > 0 && slowCount === 0) window.dispatchEvent(new CustomEvent("api:slow", { detail: false }));
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = opts;
  const method = (rest.method || "GET").toUpperCase();
  const csrf = readCookie(CSRF_COOKIE);
  let markedSlow = false;
  const slowTimer = setTimeout(() => { markedSlow = true; setSlow(+1); }, SLOW_AFTER_MS);
  try {
    const res = await fetch(API_BASE + path, {
      ...rest,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(!SAFE_METHODS.has(method) && csrf ? { "X-CSRF-Token": csrf } : {}),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      // 401 → broadcast so the AuthContext can sign the user out.
      if (res.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
      throw new ApiError(parsed?.error || res.statusText, res.status, parsed);
    }
    return parsed as T;
  } finally {
    clearTimeout(slowTimer);
    if (markedSlow) setSlow(-1);
  }
}
