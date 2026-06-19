import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { IconName } from "../types";
import type { ApiSession } from "../api/sessions";
import { TopNav, Icon, Avatar } from "../rally-shared";
import {
  useSessions, useAcceptSession, useDeclineSession,
  useCancelSession, useRescheduleSession,
} from "../hooks/useSessions";
import { useToast } from "../contexts/ToastContext";
import { ScheduleModal } from "../components/ScheduleModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";

const StatusPill = ({ status, sentByMe }) => {
  const map = {
    confirmed: { label: "Confirmed", cls: "confirmed" },
    pending:   { label: sentByMe ? "Awaiting reply" : "Awaiting your reply", cls: "pending" },
    requested: { label: "New request", cls: "requested" },
    completed: { label: "Completed", cls: "completed" },
    cancelled: { label: "Cancelled", cls: "cancelled" },
  };
  const m = map[status] || { label: status, cls: "" };
  return (
    <span className={"status-pill " + m.cls}>
      <span className="pulse" />
      {m.label}
    </span>
  );
};

function SessionRow({ s, onAccept, onDecline, onCancel, onReschedule, busy }: {
  s: any;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onCancel: (s: any) => void;
  onReschedule: (s: any) => void;
  busy?: boolean;
}) {
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
            <span className="sess-meta-item">
              <Icon name="pin" size={14} /> {s.court}
              {s.courtMiles && (
                <span style={{ color: "var(--text-low)" }}>· {s.courtMiles} mi</span>
              )}
            </span>
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
          ) : (
            <span className="status-pill" style={{ opacity: 0.7 }}>Past game</span>
          )
        ) : (
          <StatusPill status={s.status} sentByMe={s.sentByMe} />
        )}

        <div className="sess-actions">
          {s.bucket !== "past" && s.status === "confirmed" && (
            <>
              <button className="btn-sm ghost" type="button" onClick={() => onReschedule(s)} disabled={busy}>Reschedule</button>
              <button className="btn-sm danger" type="button" onClick={() => onCancel(s)} disabled={busy}>Cancel</button>
            </>
          )}
          {s.bucket !== "past" && s.status === "pending" && (
            <>
              <button className="btn-sm ghost" type="button" onClick={() => onReschedule(s)} disabled={busy}>Reschedule</button>
              <button className="btn-sm danger" type="button" onClick={() => onCancel(s)} disabled={busy}>Cancel</button>
            </>
          )}
          {s.bucket !== "past" && s.status === "requested" && (
            <>
              <button className="btn-sm primary" type="button" onClick={() => onAccept(s.id)} disabled={busy}>
                <Icon name="check" size={14} stroke={2.5} /> {busy ? "…" : "Accept"}
              </button>
              <button className="btn-sm ghost" type="button" onClick={() => onReschedule(s)} disabled={busy}>Propose new time</button>
              <button className="btn-sm danger" type="button" onClick={() => onDecline(s.id)} disabled={busy}>Decline</button>
            </>
          )}
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
  const sessions: ApiSession[] = apiData?.sessions ?? [];

  const accept = useAcceptSession();
  const decline = useDeclineSession();
  const cancel = useCancelSession();
  const reschedule = useRescheduleSession();

  // The session being rescheduled / cancelled (each opens its own modal).
  const [reschedTarget, setReschedTarget] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  const handleAccept = (id: number) => {
    accept.mutate(id, {
      onSuccess: () => show("Game confirmed", "success"),
      onError:   () => show("Couldn't accept — try again", "error"),
    });
  };
  const handleDecline = (id: number) => {
    decline.mutate(id, {
      onSuccess: () => show("Request declined", "success"),
      onError:   () => show("Couldn't decline — try again", "error"),
    });
  };
  // Cancelling a confirmed game is irreversible and notifies the other player,
  // so it goes through a confirmation dialog rather than firing on one tap.
  const confirmCancel = () => {
    if (!cancelTarget) return;
    cancel.mutate(cancelTarget.id, {
      onSuccess: () => {
        setCancelTarget(null);
        show("Game cancelled — we let them know", "success");
      },
      onError: () => show("Couldn't cancel — try again", "error"),
    });
  };
  const handleReschedule = (iso: string, note?: string) => {
    if (!reschedTarget) return;
    reschedule.mutate(
      { id: reschedTarget.id, scheduledAt: iso, note },
      {
        onSuccess: () => {
          setReschedTarget(null);
          show("New time proposed — waiting on them to confirm", "success");
        },
        onError: () => show("Couldn't reschedule — try again", "error"),
      },
    );
  };
  const busyId = accept.isPending
    ? accept.variables
    : decline.isPending
    ? decline.variables
    : cancel.isPending
    ? cancel.variables
    : reschedule.isPending
    ? reschedTarget?.id
    : null;

  const counts = useMemo(() => ({
    upcoming: sessions.filter((s: any) => s.bucket === "upcoming").length,
    requests: sessions.filter((s: any) => s.bucket === "requests").length,
    past:     sessions.filter((s: any) => s.bucket === "past").length,
  }), [sessions]);

  // Real stats derived from the session list (no hardcoded numbers, no scores).
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

  const visible = sessions.filter((s: any) => s.bucket === tab);

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
              aria-selected={tab === t.id}
              className={"tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon as IconName} size={15} /> {t.label}
              <span className="tab-count">{counts[t.id]}</span>
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

            <div className="session-list">
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
                  <SessionRow
                    key={s.id}
                    s={s}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onCancel={setCancelTarget}
                    onReschedule={setReschedTarget}
                    busy={busyId === s.id}
                  />
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

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this game?"
          body={
            cancelTarget.status === "confirmed"
              ? `Your confirmed game with ${cancelTarget.opp ?? "your partner"} will be called off and they'll be notified. This can't be undone.`
              : `We'll withdraw this request${cancelTarget.opp ? ` to ${cancelTarget.opp}` : ""}. This can't be undone.`
          }
          confirmLabel="Yes, cancel"
          cancelLabel="Keep it"
          danger
          busy={cancel.isPending}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}

    </>
  );
}

export default SessionsPage;
