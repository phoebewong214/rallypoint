import { api } from "./client";

export interface SupportTurn {
  role: "user" | "assistant";
  content: string;
}

export const supportApi = {
  /** Ask the AI assistant. `history` is the prior turns (excluding `message`). */
  chat: (message: string, history: SupportTurn[]) =>
    api<{ reply: string; source: "ai" | "unavailable" }>("/support/chat", {
      method: "POST",
      body: { message, history },
    }),

  /** "Talk to a human" — emails the support inbox. */
  escalate: (message: string, history: SupportTurn[]) =>
    api<{ ok: boolean; error?: string }>("/support/escalate", {
      method: "POST",
      body: { message, history },
    }),
};
