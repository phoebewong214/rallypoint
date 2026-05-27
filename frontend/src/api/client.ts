/* ============================================================
   API client — fetch wrapper.
   - Sends Authorization: Bearer <jwt> from localStorage
   - Parses JSON, throws ApiError on non-2xx
   - On 401, fires a 'auth:expired' window event so AuthContext can logout
   ============================================================ */

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:5050/api";

export const TOKEN_STORAGE_KEY = "rallypoint.token";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = opts;
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
