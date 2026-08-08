import type { ApiSession } from "../api/sessions";
import type { ApiInvite } from "../api/invites";

/* An invite in any other phase is settled — nobody needs to act on it. */
const OPEN_PHASES = new Set<ApiInvite["phase"]>(["awaiting_opponent", "settling_time"]);

/** How many My Games items are waiting on the viewer — drives the nav badge.
    Counts open invites where it's the viewer's turn (awaiting → the invitee
    must confirm; settling → the side that didn't author the open proposal
    must respond) plus legacy session requests (bucket "requests"). */
export function actionNeededCount(
  sessions: Pick<ApiSession, "bucket">[] | undefined,
  invites: Pick<ApiInvite, "phase" | "yourTurn">[] | undefined,
): number {
  const inviteCount = (invites ?? []).filter(
    (i) => OPEN_PHASES.has(i.phase) && i.yourTurn,
  ).length;
  const sessionCount = (sessions ?? []).filter((s) => s.bucket === "requests").length;
  return inviteCount + sessionCount;
}
