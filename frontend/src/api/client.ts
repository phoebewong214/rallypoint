/* ============================================================
   API client — fetch wrapper.
   - Auth rides in an httpOnly cookie (set by the backend), so we send
     credentials: "include" and never touch the JWT from JS.
   - For unsafe methods we echo the readable CSRF cookie in X-CSRF-Token
     (double-submit-cookie CSRF defense).
   - Parses JSON, throws ApiError on non-2xx.
   - On 401, fires a 'auth:expired' window event so AuthContext can logout.
   ============================================================ */

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:5050/api";

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

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = opts;
  const method = (rest.method || "GET").toUpperCase();
  const csrf = readCookie(CSRF_COOKIE);
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
}
