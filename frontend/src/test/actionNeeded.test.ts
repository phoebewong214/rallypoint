import { describe, it, expect } from "vitest";

import { actionNeededCount } from "../lib/actionNeeded";
import type { ApiInvite } from "../api/invites";

const invite = (phase: ApiInvite["phase"], yourTurn: boolean) => ({ phase, yourTurn });
const session = (bucket: "upcoming" | "requests" | "past") => ({ bucket });

describe("actionNeededCount (My Games nav badge)", () => {
  it("counts an awaiting invite only for the invitee (their turn)", () => {
    expect(actionNeededCount([], [invite("awaiting_opponent", true)])).toBe(1);
    expect(actionNeededCount([], [invite("awaiting_opponent", false)])).toBe(0);
  });

  it("counts a settling invite only for the side that must answer the open proposal", () => {
    expect(actionNeededCount([], [invite("settling_time", true)])).toBe(1);
    expect(actionNeededCount([], [invite("settling_time", false)])).toBe(0);
  });

  it("never counts settled invites, even if a stale yourTurn flag rides along", () => {
    expect(
      actionNeededCount([], [
        invite("confirmed", true),
        invite("declined", true),
        invite("cancelled", true),
      ]),
    ).toBe(0);
  });

  it("still counts legacy session requests, and only those", () => {
    expect(
      actionNeededCount([session("requests"), session("upcoming"), session("past")], []),
    ).toBe(1);
  });

  it("sums invites needing action with legacy session requests", () => {
    expect(
      actionNeededCount(
        [session("requests"), session("upcoming")],
        [invite("awaiting_opponent", true), invite("settling_time", true), invite("settling_time", false)],
      ),
    ).toBe(3);
  });

  it("treats missing feeds as zero (badge hidden while queries load)", () => {
    expect(actionNeededCount(undefined, undefined)).toBe(0);
  });
});
