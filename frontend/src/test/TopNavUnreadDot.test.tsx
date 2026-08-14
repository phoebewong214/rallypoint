import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

import { TopNav } from "../rally-shared";
import { useChatUnread } from "../hooks/useChat";
import { useSessions } from "../hooks/useSessions";
import { useInvites } from "../hooks/useInvites";

/* TopNav pulls everything through hooks — stub them all so the nav renders
   standalone. The dot must be driven ONLY by the ['chatUnread'] total. */
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Jasper", initials: "JF", isAdmin: false },
    logout: vi.fn(),
    isAuthenticated: true,
  }),
}));
vi.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", toggle: vi.fn() }),
}));
vi.mock("../hooks/useSessions", () => ({ useSessions: vi.fn() }));
vi.mock("../hooks/useInvites", () => ({ useInvites: vi.fn() }));
vi.mock("../hooks/useChat", () => ({ useChatUnread: vi.fn() }));

const sessions = vi.mocked(useSessions);
const invites = vi.mocked(useInvites);
const unread = vi.mocked(useChatUnread);

function renderNav() {
  return render(
    <MemoryRouter>
      <TopNav />
    </MemoryRouter>,
  );
}

describe("TopNav chat-unread dot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessions.mockReturnValue({ data: undefined } as any);
    invites.mockReturnValue({ data: undefined } as any);
  });

  it("renders the red dot (desktop nav) when the unread total is positive", () => {
    unread.mockReturnValue({ data: { total: 3 } } as any);
    renderNav();
    expect(screen.getAllByLabelText("New chat messages").length).toBeGreaterThan(0);
  });

  it("renders nothing when the total is 0 (and while it hasn't loaded)", () => {
    unread.mockReturnValue({ data: { total: 0 } } as any);
    renderNav();
    expect(screen.queryByLabelText("New chat messages")).not.toBeInTheDocument();

    unread.mockReturnValue({ data: undefined } as any);
    renderNav();
    expect(screen.queryByLabelText("New chat messages")).not.toBeInTheDocument();
  });

  it("keeps the green to-do badge independent: both can show at once", () => {
    // One pending legacy request → green badge 1; unread chat → dot too.
    sessions.mockReturnValue({ data: { sessions: [{ bucket: "requests" }] } } as any);
    unread.mockReturnValue({ data: { total: 2 } } as any);
    renderNav();
    expect(screen.getAllByLabelText("1 pending request").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("New chat messages").length).toBeGreaterThan(0);
  });
});
