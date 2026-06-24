import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { IconName } from "../types";
import { TopNav, Icon, Avatar } from "../rally-shared";
import {
  useSessions, useAcceptSession, useDeclineSession,
  useCancelSession, useRescheduleSession,
} from "../hooks/useSessions";
import {
  useInvites, useAcceptTime, useConfirmOpponent,
  useProposeTime, useDeclineInvite, useCancelInvite,
} from "../hooks/useInvites";
import { useToast } from "../contexts/ToastContext";
import { ScheduleModal } from "../components/ScheduleModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";

// `status` is already viewer-relative (see Session.display_status): "pending"
// means you proposed and are waiting on them; "requested" means it's your turn.
const StatusPill = ({ status }) => {
  const map = {
    confirmed: { label: "Confirmed", cls: "confirmed" },
    pending:   { label: "Waiting on them", cls: "pending" },
    requested: { label: "Needs your reply", cls: "requested" },
    completed: { label: "Completed", cls: "completed" },
    cancelled: { label: "Cancelled", cls: "cancelled" },
    declined:  { label: "Declined", cls: "cancelled" },
  };
  const m = map[status] || { label: status, cls: "" };
  return (
    <span className={"status-pill " + m.cls}>
      <span className="pulse" />
      {m.label}
    </span>
  );
};

// Unified row callbacks — each takes the row and branches on s.kind at the page
// level (invite vs legacy session), so SessionRow stays presentational.
type RowHandlers = {
  onAccept: (s: any) => void;          // accept the time on the table → confirm
  onDecline: (s: any) => void;         // invited player rejects the invite
  onCancel: (s: any) => void;          // either party calls it off / withdraws
  onTimeChange: (s: any) => void;      // propose / counter / reschedule a time
  onConfirmOpponent: (s: any) => void; // phase-1: agree to play (window invites)
};

// Short "Mon 3:00 PM – 5:00 PM" range for a time-window invite (the materialized
// date-block only shows the window start).
function windowRange(s: any): string | null {
  if (!s.proposalEnd) return null;
  try {
    const end = new Date(s.proposalEnd).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${s.time} – ${end}`;
  } catch {
    return null;
  }
}

// The action buttons for one game/invite. Invites (kind === "invite") negotiate
// in two phases; legacy sessions keep their original accept/reschedule/cancel.
function RowActions({ s, h, busy }: { s: any; h: RowHandlers; busy?: boolean }) {
  const isInvite = s.kind === "invite";
  // The dismiss action: the invited player declines; the inviter withdraws.
  const dismiss = isInvite && !s.sentByMe
    ? <button className="btn-sm danger" type="button" onClick={() => h.onDecline(s)} disabled={busy}>Decline</button>
    : <button className="btn-sm danger" type="button" onClick={() => h.onCancel(s)} disabled={busy}>Cancel</button>;

  if (s.bucket === "past") return null;

  if (!isInvite) {
    // Legacy session: confirmed/pending → reschedule+cancel; requested → accept flow.
    if (s.status === "confirmed" || s.status === "pending") {
      return (
        <>
          <button className="btn-sm ghost" type="button" onClick={() => h.onTimeChange(s)} disabled={busy}>Reschedule</button>
          <button className="btn-sm danger" type="button" onClick={() => h.onCancel(s)} disabled={busy}>Cancel</button>
        </>
      );
    }
    if (s.status === "requested") {
      return (
        <>
          <button className="btn-sm primary" type="button" onClick={() => h.onAccept(s)} disabled={busy}>
            <Icon name="check" size={14} stroke={2.5} /> {busy ? "…" : "Accept"}
          </button>
          <button className="btn-sm ghost" type="button" onClick={() => h.onTimeChange(s)} disabled={busy}>Propose new time</button>
          <button className="btn-sm danger" type="button" onClick={() => h.onDecline(s)} disabled={busy}>Decline</button>
        </>
      );
    }
    return null;
  }

  // Invite, your turn (status "requested").
  if (s.status === "requested") {
    return (
      <>
        {/* A specific time is on the table you didn't propose → one-tap accept. */}
        {!s.isWindow && (
          <button className="btn-sm primary" type="button" onClick={() => h.onAccept(s)} disabled={busy}>
            <Icon name="check" size={14} stroke={2.5} /> {busy ? "…" : "Accept"}
          </button>
        )}
        {/* Phase 1 for a window invite: agree to play before settling the time. */}
        {s.phase === "awaiting_opponent" && s.isWindow && (
          <button className="btn-sm primary" type="button" onClick={() => h.onConfirmOpponent(s)} disabled={busy}>
            <Icon name="check" size={14} stroke={2.5} /> {busy ? "…" : "Confirm opponent"}
          </button>
        )}
        <button className="btn-sm ghost" type="button" onClick={() => h.onTimeChange(s)} disabled={busy}>
          {s.isWindow ? "Suggest a time" : "Propose new time"}
        </button>
        {dismiss}
      </>
    );
  }

  // Invite, waiting on the other player (status "pending").
  if (s.status === "pending") {
    return (
      <>
        <button className="btn-sm ghost" type="button" onClick={() => h.onTimeChange(s)} disabled={busy}>Propose new time</button>
        {dismiss}
      </>
    );
  }

  return null;
}

function SessionRow({ s, h, busy }: { s: any; h: RowHandlers; busy?: boolean }) {
  const range = s.kind === "invite" && s.isWindow ? windowRange(s) : null;
  return (
    <article className={"session" + (s.next ? " next" : "")}>
      <div className="date-block">
        <span className="date-month">{s.month}</span>
        <span className="date-day">{s.day}</span>
        <span className="date-weekday">{s.weekday}</span>
        <span className="date-time">{s.time}</span>
      </div>

      <div className="sess-body">
        <Avatar name={s.opp} size="md" />
        <div className="sess-info">
          <div className="sess-line1">
            <span className="sess-vs">vs</span>
            <span className="sess-opp">{s.opp}</span>
          </div>
          <div className="sess-meta">
            <span className="sess-meta-item">
              <b>{s.sport}</b>
            </span>
            {s.court && (
              <span className="sess-meta-item">
                <Icon name="pin" size={14} /> {s.court}
                {s.courtMiles && (
                  <span style={{ color: "var(--text-low)" }}>· {s.courtMiles} mi</span>
                )}
              </span>
            )}
            {range && (
              <span className="sess-meta-item">
                <Icon name="clock" size={14} /> any time {range}
              </span>
            )}
            {s.note && (
              <span style={{
                width: "100%",
                marginTop: 6,
                padding: "8px 12px",
                background: "var(--blue-ghost)",
                border: "1px solid var(--blue-border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
                fontStyle: "italic",
                lineHeight: 1.45,
              }}>
                "{s.note}"
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="sess-right">
        {s.bucket === "past" ? (
          s.status === "cancelled" ? (
            <span className="status-pill cancelled">Cancelled</span>
          ) : s.status === "declined" ? (
            <span className="status-pill cancelled">Declined</span>
          ) : (
            <span className="status-pill" style={{ opacity: 0.7 }}>Past game</span>
          )
        ) : (
          <StatusPill status={s.status} />
        )}

        <div className="sess-actions">
          <RowActions s={s} h={h} busy={busy} />
        </div>
      </div>
    </article>
  );
}

const TABS = [
  { id: "requests", label: "Requests",  icon: "bell" },
  { id: "upcoming", label: "Upcoming",  icon: "calendar" },
  { id: "past",     label: "Past",      icon: "trophy" },
];

// Tab-specific empty-state copy so an empty tab tells the user what belongs here.
const EMPTY_COPY: Record<string, { title: string; sub: string }> = {
  upcoming: { title: "No games scheduled", sub: "Find a partner and send a request to set one up." },
  requests: { title: "No pending requests", sub: "When someone invites you, accept or propose a new time here." },
  past:     { title: "No past games yet", sub: "Games move here automatically once their time passes — RallyPoint just makes the intro, no scores kept." },
};

/* A few shimmer rows shown while the first sessions load (instead of flashing
   fabricated demo data at real users). */
function SessionListSkeleton() {
  return (
    <div className="session-list" aria-busy="true" aria-label="Loading your games">
      {Array.from({ length: 3 }).map((_, i) => (
        <article className="session" key={i}>
          <div className="date-block">
            <Skeleton width={36} height={12} />
            <Skeleton width={28} height={26} style={{ margin: "4px 0" }} />
            <Skeleton width={40} height={12} />
          </div>
          <div className="sess-body">
            <Skeleton width={54} height={54} radius="50%" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width="55%" height={18} />
              <Skeleton width="75%" height={13} />
            </div>
          </div>
          <div className="sess-right">
            <Skeleton width={90} height={24} radius={999} />
          </div>
        </article>
      ))}
    </div>
  );
}


function SessionsPage() {
  const [tab, setTab] = useState("upcoming");
  const { show, soon } = useToast();

  /* Live sessions from the API. While the first request is in flight we show a
     skeleton; on error a retry state. We never fall back to fabricated demo
     data — a real user with no games should see a true empty state. */
  const { data: apiData, isLoading, isError, refetch } = useSessions();
  const { data: invitesData } = useInvites();

  // One viewer-relative feed of legacy sessions + two-phase invites. Both share
  // the same bucket/status/date shape; `kind` drives the negotiation actions.
  // Confirmed invites aren't listed (they show as the materialized session), so
  // nothing is double-counted.
  const sessions: any[] = useMemo(
    () => [
      ...(apiData?.sessions ?? []).map((s) => ({ kind: "session", ...s })),
      ...(invitesData?.invites ?? []),
    ],
    [apiData, invitesData],
  );

  // On first load, open straight to Requests if any are waiting on a reply, so
  // incoming invites aren't hidden behind the default Upcoming tab. After that
  // the user's own tab choice wins.
  const initialTabApplied = useRef(false);
  useEffect(() => {
    if (initialTabApplied.current) return;
    if (!apiData && !invitesData) return;
    initialTabApplied.current = true;
    if (sessions.some((s) => s.bucket === "requests")) setTab("requests");
  }, [apiData, invitesData, sessions]);

  // Legacy session mutations.
  const accept = useAcceptSession();
  const decline = useDeclineSession();
  const cancel = useCancelSession();
  const reschedule = useRescheduleSession();
  // Invite mutations.
  const acceptTime = useAcceptTime();
  const confirmOpponent = useConfirmOpponent();
  const proposeTime = useProposeTime();
  const declineInvite = useDeclineInvite();
  const cancelInvite = useCancelInvite();

  // Modal targets: rescheduling a legacy session vs. proposing a time on an
  // invite use the same picker but different mutations; cancel goes through a
  // confirm dialog for both.
  const [reschedTarget, setReschedTarget] = useState<any | null>(null);
  const [proposeTarget, setProposeTarget] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  const handleAccept = (s: any) => {
    if (s.kind === "invite") {
      acceptTime.mutate(s.id, {
        onSuccess: () => show("Game confirmed 🎾 — see it in Upcoming", "success"),
        onError: (e: any) => show(e?.message || "Couldn't accept — try again", "error"),
      });
    } else {
      accept.mutate(s.id, {
        onSuccess: () => show("Game confirmed", "success"),
        onError:   () => show("Couldn't accept — try again", "error"),
      });
    }
  };
  const handleDecline = (s: any) => {
    if (s.kind === "invite") {
      declineInvite.mutate({ id: s.id }, {
        onSuccess: () => show("Invite declined", "success"),
        onError:   () => show("Couldn't decline — try again", "error"),
      });
    } else {
      decline.mutate(s.id, {
        onSuccess: () => show("Request declined", "success"),
        onError:   () => show("Couldn't decline — try again", "error"),
      });
    }
  };
  const handleConfirmOpponent = (s: any) => {
    confirmOpponent.mutate(s.id, {
      onSuccess: () => show("You're in — now suggest a time", "success"),
      onError: (e: any) => show(e?.message || "Couldn't confirm — try again", "error"),
    });
  };
  const handleTimeChange = (s: any) => {
    if (s.kind === "invite") setProposeTarget(s);
    else setReschedTarget(s);
  };
  // Cancelling notifies the other player, so it goes through a confirm dialog.
  const confirmCancel = () => {
    if (!cancelTarget) return;
    const done = (msg: string) => () => { setCancelTarget(null); show(msg, "success"); };
    if (cancelTarget.kind === "invite") {
      cancelInvite.mutate(cancelTarget.id, {
        onSuccess: done(cancelTarget.sentByMe ? "Invite withdrawn" : "Invite cancelled"),
        onError: () => show("Couldn't cancel — try again", "error"),
      });
    } else {
      cancel.mutate(cancelTarget.id, {
        onSuccess: done("Game cancelled — we let them know"),
        onError: () => show("Couldn't cancel — try again", "error"),
      });
    }
  };
  const handleReschedule = (startISO: string, _endISO: string | null, note?: string) => {
    if (!reschedTarget) return;
    reschedule.mutate(
      { id: reschedTarget.id, scheduledAt: startISO, note },
      {
        onSuccess: () => {
          setReschedTarget(null);
          show("New time proposed — waiting on them to confirm", "success");
        },
        onError: () => show("Couldn't reschedule — try again", "error"),
      },
    );
  };
  const handlePropose = (startISO: string, endISO: string | null) => {
    if (!proposeTarget) return;
    proposeTime.mutate(
      { id: proposeTarget.id, startAt: startISO, endAt: endISO },
      {
        onSuccess: () => {
          setProposeTarget(null);
          show("Time proposed — waiting on them to accept", "success");
        },
        onError: (e: any) => show(e?.message || "Couldn't propose — try again", "error"),
      },
    );
  };

  const handlers: RowHandlers = {
    onAccept: handleAccept,
    onDecline: handleDecline,
    onCancel: setCancelTarget,
    onTimeChange: handleTimeChange,
    onConfirmOpponent: handleConfirmOpponent,
  };

  // Session and invite ids live in different tables and can collide, so rows are
  // keyed by kind+id (for React keys AND busy tracking).
  const rowKey = (s: any) => (s.kind === "invite" ? "i" : "s") + s.id;
  const busyKeys = new Set<string>();
  if (accept.isPending) busyKeys.add("s" + accept.variables);
  if (decline.isPending) busyKeys.add("s" + decline.variables);
  if (cancel.isPending) busyKeys.add("s" + cancel.variables);
  if (reschedule.isPending && reschedTarget) busyKeys.add("s" + reschedTarget.id);
  if (acceptTime.isPending) busyKeys.add("i" + acceptTime.variables);
  if (confirmOpponent.isPending) busyKeys.add("i" + confirmOpponent.variables);
  if (proposeTime.isPending && proposeTarget) busyKeys.add("i" + proposeTarget.id);
  if (declineInvite.isPending) busyKeys.add("i" + (declineInvite.variables as any)?.id);
  if (cancelInvite.isPending) busyKeys.add("i" + cancelInvite.variables);

  const counts = useMemo(() => ({
    upcoming: sessions.filter((s: any) => s.bucket === "upcoming").length,
    requests: sessions.filter((s: any) => s.bucket === "requests").length,
    past:     sessions.filter((s: any) => s.bucket === "past").length,
  }), [sessions]);

  // Real stats derived from the feed (no hardcoded numbers, no scores).
  const stats = useMemo(() => {
    const pending = sessions.filter((s: any) => s.status === "pending");
    const pendingSent = pending.filter((s: any) => s.sentByMe).length;
    return {
      pending: pending.length,
      pendingSent,
      pendingReceived: pending.length - pendingSent,
      nextUp: sessions.find((s: any) => s.bucket === "upcoming") ?? null,
    };
  }, [sessions]);

  // Within a tab, show the soonest first (past: most recent first).
  const visible = useMemo(() => {
    const rows = sessions.filter((s: any) => s.bucket === tab);
    const t = (s: any) => (s.scheduledAt ? new Date(s.scheduledAt).getTime() : 0);
    rows.sort((a, b) => (tab === "past" ? t(b) - t(a) : t(a) - t(b)));
    return rows;
  }, [sessions, tab]);

  return (
    <>
      <TopNav active="matches" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="dot" />
              {isLoading
                ? "Loading your games…"
                : isError
                  ? "Couldn't reach the server"
                  : `${counts.upcoming} upcoming · ${counts.requests} request${counts.requests === 1 ? "" : "s"}`}
            </div>
            <h1 className="h1">My <em>games.</em></h1>
            <p className="sub">
              From the first request to game day. RallyPoint makes the intro — you take it from there.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <button className="btn-ghost" type="button" onClick={() => soon("Calendar sync")}>
              <Icon name="calendar" size={15} /> Calendar
            </button>
            <Link to="/find" className="btn-primary" style={{ textDecoration: "none" }}>
              <Icon name="plus" size={16} stroke={2.5} /> Schedule Game
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="label">Requests</span>
            <span className="value">{counts.requests}</span>
            <span className="sub">{counts.requests === 0 ? "None waiting" : "Waiting on you"}</span>
          </div>
          <div className="stat-card">
            <span className="label">Upcoming</span>
            <span className="value">{counts.upcoming}</span>
            <span className="sub">
              {stats.nextUp ? `Next: ${stats.nextUp.weekday}, ${stats.nextUp.time}` : "Nothing scheduled"}
            </span>
          </div>
          <div className="stat-card">
            <span className="label">Pending Confirmations</span>
            <span className="value">{stats.pending}</span>
            <span className="sub">{stats.pendingSent} sent · {stats.pendingReceived} received</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Played</span>
            <span className="value">{counts.past}</span>
            <span className="sub">{counts.past === 0 ? "No games yet" : "Games so far"}</span>
          </div>
        </section>

        {/* Tabs */}
        <div className="tab-bar" role="tablist" aria-label="Session filter">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="session-panel"
              className={"tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon as IconName} size={15} /> {t.label}
              {counts[t.id] > 0 && <span className="tab-count">{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <SessionListSkeleton />
        ) : isError ? (
          <div className="empty">
            <div className="ico-wrap"><Icon name="bolt" size={24} /></div>
            <h3 className="empty-title">Couldn't load your games</h3>
            <p className="empty-sub">Something went wrong reaching the server. Check your connection and try again.</p>
            <button className="btn-primary" type="button" onClick={() => refetch()}>
              <Icon name="bolt" size={15} stroke={2.4} /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="section-head">
              <h2 className="section-title">
                {tab === "upcoming" && <>Upcoming <span className="count">{counts.upcoming} scheduled</span></>}
                {tab === "requests" && <>Game Requests <span className="count">{counts.requests} waiting</span></>}
                {tab === "past"     && <>Past games <span className="count">{counts.past} total</span></>}
              </h2>
            </div>

            <div className="session-list" id="session-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              {visible.length === 0 ? (
                <div className="empty">
                  <div className="ico-wrap"><Icon name="calendar" size={24} /></div>
                  <h3 className="empty-title">{EMPTY_COPY[tab]?.title ?? "Nothing here yet"}</h3>
                  <p className="empty-sub">{EMPTY_COPY[tab]?.sub ?? "When you book a game, it'll show up right here."}</p>
                  {tab !== "requests" && (
                    <Link className="btn-primary" to="/find">
                      <Icon name="search" size={15} stroke={2.4} /> Find a Partner
                    </Link>
                  )}
                </div>
              ) : (
                visible.map((s: any) => (
                  <SessionRow key={rowKey(s)} s={s} h={handlers} busy={busyKeys.has(rowKey(s))} />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {reschedTarget && (
        <ScheduleModal
          title="Propose a new time"
          subtitle={`with ${reschedTarget.opp ?? "your partner"}`}
          defaultISO={reschedTarget.scheduledAt}
          submitLabel="Send new time"
          busy={reschedule.isPending}
          onSubmit={handleReschedule}
          onClose={() => setReschedTarget(null)}
        />
      )}

      {proposeTarget && (
        <ScheduleModal
          title="Suggest a time"
          subtitle={
            proposeTarget.isWindow
              ? `Pick a specific time inside ${proposeTarget.opp ?? "their"} window`
              : `with ${proposeTarget.opp ?? "your partner"}`
          }
          defaultISO={proposeTarget.scheduledAt}
          // When countering a window, keep the pick inside the offered window.
          minISO={proposeTarget.isWindow ? proposeTarget.scheduledAt : undefined}
          maxISO={proposeTarget.isWindow ? proposeTarget.proposalEnd : undefined}
          submitLabel="Send time"
          busy={proposeTime.isPending}
          onSubmit={handlePropose}
          onClose={() => setProposeTarget(null)}
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title={cancelTarget.kind === "invite" && cancelTarget.sentByMe ? "Withdraw this invite?" : "Cancel this game?"}
          body={
            cancelTarget.status === "confirmed"
              ? `Your confirmed game with ${cancelTarget.opp ?? "your partner"} will be called off and they'll be notified. This can't be undone.`
              : cancelTarget.kind === "invite" && cancelTarget.sentByMe
                ? `We'll withdraw your invite${cancelTarget.opp ? ` to ${cancelTarget.opp}` : ""}. This can't be undone.`
                : `We'll call off this game${cancelTarget.opp ? ` with ${cancelTarget.opp}` : ""}. This can't be undone.`
          }
          confirmLabel="Yes, cancel"
          cancelLabel="Keep it"
          danger
          busy={cancel.isPending || cancelInvite.isPending}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}

    </>
  );
}

export default SessionsPage;
