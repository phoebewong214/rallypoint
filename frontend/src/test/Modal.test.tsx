import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useRef } from "react";

import { Modal } from "../components/Modal";

/* Regression suite for the "flickering chat modal" (RP-FEAT-003 rework):
   Modal's side effects (body scroll lock, Esc listener, initial focus) must be
   IMMUNE to an unstable `onClose` — callers pass inline closures, and a modal
   whose content refetches while open re-renders constantly. If the effect
   re-ran per onClose identity, the scroll lock would release/re-apply every
   render and the page would visibly flicker. */

/* Record every write to document.body.style.overflow. jsdom defines CSS
   properties as accessors on CSSStyleDeclaration.prototype, so an instance-
   level shadow sees each assignment while keeping the real behavior. */
function trackOverflowWrites() {
  const style = document.body.style;
  let proto = Object.getPrototypeOf(style);
  let desc: PropertyDescriptor | undefined;
  while (proto && !desc) {
    desc = Object.getOwnPropertyDescriptor(proto, "overflow");
    proto = Object.getPrototypeOf(proto);
  }
  if (!desc?.get || !desc?.set) throw new Error("can't instrument style.overflow");
  const writes: string[] = [];
  Object.defineProperty(style, "overflow", {
    configurable: true,
    get: () => desc!.get!.call(style),
    set: (v: string) => {
      writes.push(v);
      desc!.set!.call(style, v);
    },
  });
  return { writes, restore: () => delete (style as any).overflow };
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Modal side-effect immunity to unstable props", () => {
  it("locks body scroll exactly once, no matter how often the parent re-renders with a fresh onClose", () => {
    const tracker = trackOverflowWrites();
    try {
      document.body.style.overflow = "scroll"; // pre-existing value to restore
      tracker.writes.length = 0;

      const { rerender, unmount } = render(
        <Modal ariaLabel="test" onClose={() => {}}>hi</Modal>,
      );
      expect(document.body.style.overflow).toBe("hidden");
      expect(tracker.writes).toEqual(["hidden"]);

      // The bug's trigger: renders above the modal handing down a NEW closure
      // each time (exactly what the chat dialog's refetch churn produces).
      for (let i = 0; i < 5; i++) {
        rerender(<Modal ariaLabel="test" onClose={() => {}}>hi {i}</Modal>);
      }
      // One initial lock — zero further touches. (The old code released and
      // re-applied the lock per re-render: writes would be 11 here.)
      expect(tracker.writes).toEqual(["hidden"]);
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(tracker.writes).toEqual(["hidden", "scroll"]);
      expect(document.body.style.overflow).toBe("scroll");
    } finally {
      tracker.restore();
    }
  });

  it("attaches the Esc listener once across onClose identity churn", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const keydownAdds = () => addSpy.mock.calls.filter((c) => c[0] === "keydown").length;
    const keydownRemoves = () => removeSpy.mock.calls.filter((c) => c[0] === "keydown").length;

    const { rerender, unmount } = render(
      <Modal ariaLabel="test" onClose={() => {}}>hi</Modal>,
    );
    const addsAfterMount = keydownAdds();
    rerender(<Modal ariaLabel="test" onClose={() => {}}>hi again</Modal>);
    rerender(<Modal ariaLabel="test" onClose={() => {}}>hi again</Modal>);
    expect(keydownAdds()).toBe(addsAfterMount);
    expect(keydownRemoves()).toBe(0);
    unmount();
    expect(keydownRemoves()).toBe(1);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("Esc still calls the LATEST onClose after re-renders (ref indirection, not a stale capture)", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Modal ariaLabel="test" onClose={first}>hi</Modal>);
    rerender(<Modal ariaLabel="test" onClose={second}>hi</Modal>);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("Modal existing contract (unchanged)", () => {
  it("closes on backdrop click but not on clicks inside the card", () => {
    const onClose = vi.fn();
    render(<Modal ariaLabel="test" onClose={onClose}><span>inside</span></Modal>);

    fireEvent.click(screen.getByText("inside"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog", { name: "test" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses initialFocusRef on mount", () => {
    function Host() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Modal ariaLabel="test" onClose={() => {}} initialFocusRef={ref}>
          <button ref={ref}>go</button>
        </Modal>
      );
    }
    render(<Host />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "go" }));
  });
});
