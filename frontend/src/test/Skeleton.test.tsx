import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { Skeleton, PlayerCardSkeleton } from "../components/Skeleton";

describe("Skeleton", () => {
  it("renders with the .skeleton class and aria-hidden", () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    const node = container.firstChild as HTMLElement;
    expect(node).toHaveClass("skeleton");
    expect(node).toHaveAttribute("aria-hidden");
  });

  it("applies custom width/height as inline style", () => {
    const { container } = render(<Skeleton width={42} height={7} radius={3} />);
    const node = container.firstChild as HTMLElement;
    expect(node.style.width).toBe("42px");
    expect(node.style.height).toBe("7px");
    expect(node.style.borderRadius).toBe("3px");
  });

  it("PlayerCardSkeleton marks itself as aria-busy for screen readers", () => {
    const { container } = render(<PlayerCardSkeleton />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("aria-label", "Loading player");
  });
});
