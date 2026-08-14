import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SessionRow } from "../pages/SessionsPage";
import { chatApi } from "../api/invites";

vi.mock("../api/invites", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../api/invites")>();
  return {
    ...mod,
    chatApi: { list: vi.fn(), send: vi.fn(), markRead: vi.fn(), unreadTotal: vi.fn() },
  };
});

const noop = () => {};
const handlers = {
  onAccept: noop, onDecline: noop, onCancel: noop,
  onTimeChange: noop, onConfirmOpponent: noop,
};

const confirmedRow = (over: Record<string, unknown> = {}) => ({
  kind: "session",
  id: 3,
  bucket: "upcoming",
  status: "confirmed",
  opp: "Alex",
  sport: "Tennis",
  inviteId: 7,
  unreadCount: 0,
  month: "Aug", day: "20", weekday: "Thu", time: "6:00 PM",
  ...over,
});

function renderRow(s: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionRow s={s} h={handlers} />
    </QueryClientProvider>,
  );
}

describe("SessionRow chat entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatApi.list).mockResolvedValue({ messages: [] });
    vi.mocked(chatApi.markRead).mockResolvedValue({ unread: 0 });
  });

  it("shows the unread count on the Chat button when messages are waiting", () => {
    renderRow(confirmedRow({ unreadCount: 2 }));
    const btn = screen.getByRole("button", { name: /Chat/ });
    expect(btn).toHaveTextContent("2");
    expect(screen.getByLabelText("2 unread messages")).toBeInTheDocument();
  });

  it("shows no number when nothing is unread", () => {
    renderRow(confirmedRow({ unreadCount: 0 }));
    expect(screen.getByRole("button", { name: /Chat/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread message/)).not.toBeInTheDocument();
  });

  it("opens the chat dialog on click (no inline panel) and closes back to the list", async () => {
    renderRow(confirmedRow({ unreadCount: 1 }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chat/ }));
    expect(await screen.findByRole("dialog", { name: "Chat with Alex" })).toBeInTheDocument();
    // Header carries the opponent and the game time.
    expect(screen.getByText("Thu, Aug 20 · 6:00 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers no chat entry on legacy sessions (no thread key)", () => {
    renderRow(confirmedRow({ inviteId: null }));
    expect(screen.queryByRole("button", { name: /Chat/ })).not.toBeInTheDocument();
  });
});
