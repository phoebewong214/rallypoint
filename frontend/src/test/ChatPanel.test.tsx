import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ChatPanel } from "../components/ChatPanel";
import { chatApi, type ApiChatMessage } from "../api/invites";

vi.mock("../api/invites", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../api/invites")>();
  return { ...mod, chatApi: { list: vi.fn(), send: vi.fn() } };
});

const list = vi.mocked(chatApi.list);
const send = vi.mocked(chatApi.send);

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

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChatPanel inviteId={7} opp="Alex" />
    </QueryClientProvider>,
  );
}

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the thread with mine/theirs alignment", async () => {
    list.mockResolvedValue({
      messages: [
        msg({ id: 1, body: "I'll bring balls", mine: false }),
        msg({ id: 2, body: "see you at 6", mine: true, senderId: 2 }),
      ],
    });
    renderPanel();

    expect(await screen.findByText("I'll bring balls")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(7);
    const theirs = screen.getByText("I'll bring balls").closest(".chat-msg");
    const mine = screen.getByText("see you at 6").closest(".chat-msg");
    expect(theirs).not.toHaveClass("mine");
    expect(mine).toHaveClass("mine");
  });

  it("shows an empty-state hint when there are no messages", async () => {
    list.mockResolvedValue({ messages: [] });
    renderPanel();
    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });

  it("sends the trimmed draft, clears the input, and refetches the thread", async () => {
    list.mockResolvedValue({ messages: [] });
    send.mockResolvedValue({ message: msg({ id: 3, body: "on my way", mine: true }) });
    renderPanel();

    const input = await screen.findByLabelText("Chat message");
    fireEvent.change(input, { target: { value: "  on my way  " } });
    fireEvent.submit(input.closest("form")!); // Enter-to-send path

    await waitFor(() => expect(send).toHaveBeenCalledWith(7, "on my way"));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
    // Success invalidates ['chat', 7] → the thread refetches.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("does not send an empty draft and disables the button", async () => {
    list.mockResolvedValue({ messages: [] });
    renderPanel();

    const input = await screen.findByLabelText("Chat message");
    const button = screen.getByRole("button", { name: /Send/ });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(button).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    expect(send).not.toHaveBeenCalled();
  });

  it("surfaces a send failure without losing the draft", async () => {
    list.mockResolvedValue({ messages: [] });
    send.mockRejectedValue(new Error("network down"));
    renderPanel();

    const input = await screen.findByLabelText("Chat message");
    fireEvent.change(input, { target: { value: "important detail" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't send/);
    expect((input as HTMLInputElement).value).toBe("important detail");
  });
});
