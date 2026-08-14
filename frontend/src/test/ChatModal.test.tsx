import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ChatModal } from "../components/ChatModal";
import { chatApi, type ApiChatMessage } from "../api/invites";

vi.mock("../api/invites", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../api/invites")>();
  return {
    ...mod,
    chatApi: { list: vi.fn(), send: vi.fn(), markRead: vi.fn(), unreadTotal: vi.fn() },
  };
});

const list = vi.mocked(chatApi.list);
const markRead = vi.mocked(chatApi.markRead);

const msg = (over: Partial<ApiChatMessage>): ApiChatMessage => ({
  id: 1,
  inviteId: 7,
  senderId: 1,
  senderName: "Alex",
  mine: false,
  body: "hello",
  createdAt: "2026-08-10T18:00:00+00:00",
  ...over,
});

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ChatModal inviteId={7} opp="Alex" when="Thu, Aug 20 · 6:00 PM" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { qc, onClose };
}

describe("ChatModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markRead.mockResolvedValue({ unread: 0 });
  });

  it("renders a dialog with the opponent, the game time, and the thread", async () => {
    list.mockResolvedValue({ messages: [msg({ body: "I'll bring balls" })] });
    renderModal();

    const dialog = screen.getByRole("dialog", { name: "Chat with Alex" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Thu, Aug 20 · 6:00 PM")).toBeInTheDocument();
    expect(await screen.findByText("I'll bring balls")).toBeInTheDocument();
  });

  it("closes from the header button", async () => {
    list.mockResolvedValue({ messages: [] });
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("reports the newest message id as read once the thread renders", async () => {
    list.mockResolvedValue({
      messages: [msg({ id: 11 }), msg({ id: 12, body: "second" })],
    });
    renderModal();
    await screen.findByText("second");
    // Debounced (400ms), then reported with the newest id.
    await waitFor(() => expect(markRead).toHaveBeenCalledWith(7, 12), { timeout: 2000 });
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it("reports again when a newer message lands while open — but never for an empty thread", async () => {
    list.mockResolvedValue({ messages: [] });
    const { qc } = renderModal();
    await screen.findByText(/No messages yet/);

    // Nothing to read → nothing reported.
    await new Promise((r) => setTimeout(r, 600));
    expect(markRead).not.toHaveBeenCalled();

    // A new message arrives (SSE nudge → refetch): the open dialog reads it.
    list.mockResolvedValue({ messages: [msg({ id: 21, body: "you there?" })] });
    qc.invalidateQueries({ queryKey: ["chat", 7] });
    await screen.findByText("you there?");
    await waitFor(() => expect(markRead).toHaveBeenCalledWith(7, 21), { timeout: 2000 });
  });
});
