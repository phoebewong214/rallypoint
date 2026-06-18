import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { IconName } from "../types";
import { TopNav, Icon, Avatar } from "../rally-shared";
import { useSessions, useAcceptSession, useDeclineSession } from "../hooks/useSessions";
import { useToast } from "../contexts/ToastContext";

const SESSIONS = [
  // ----- Upcoming -----
  {
    id: 1, bucket: "upcoming", status: "confirmed",
    opp: "Maya Patel", oppHandle: "@mayap",
    sport: "Pickleball",
    court: "Maggie Daley Park Tennis", courtMiles: "0.6",
    day: "06", month: "Jun", weekday: "Tomorrow", time: "8:00 AM",
    next: true,
  },
  {
    id: 2, bucket: "upcoming", status: "pending",
    opp: "Jordan Williams", oppHandle: "@jordanw",
    sport: "Tennis",
    court: "Lincoln Park Cultural Center Tennis Courts", courtMiles: "3.1",
    day: "08", month: "Jun", weekday: "Thu", time: "6:30 PM",
    sentByMe: true,
  },
  {
    id: 3, bucket: "upcoming", status: "confirmed",
    opp: "Aisha Johnson", oppHandle: "@aishaj",
    sport: "Pickleball",
    court: "Lake Shore Park", courtMiles: "1.2",
    day: "10", month: "Jun", weekday: "Sat", time: "9:30 AM",
  },

  // ----- Requests (received) -----
  {
    id: 4, bucket: "requests", status: "requested",
    opp: "Marcus Chen", oppHandle: "@marcusc",
    sport: "Tennis",
    court: "Wicker Park Tennis Courts", courtMiles: "3.4",
    day: "11", month: "Jun", weekday: "Sun", time: "10:00 AM",
    note: "Up for an early Sunday match? I'll bring new balls.",
  },

  // ----- Past -----
  {
    id: 5, bucket: "past", status: "completed",
    opp: "Maya Patel",
    sport: "Pickleball",
    court: "Maggie Daley Park Tennis",
    day: "01", month: "Jun", weekday: "Sun", time: "8:00 AM",
    result: "W", score: "11–7, 11–9",
  },
  {
    id: 6, bucket: "past", status: "completed",
    opp: "Jordan Williams",
    sport: "Tennis",
    court: "Grant Park Tennis Center",
    day: "30", month: "May", weekday: "Fri", time: "6:30 PM",
    result: "W", score: "6–3, 4–6, 7–5",
  },
  {
    id: 7, bucket: "past", status: "completed",
    opp: "Marcus Chen",
    sport: "Tennis",
    court: "Wicker Park Tennis Courts",
    day: "26", month: "May", weekday: "Mon", time: "7:00 AM",
    result: "L", score: "3–6, 2–6",
  },
  {
    id: 8, bucket: "past", status: "completed",
    opp: "Aisha Johnson",
    sport: "Pickleball",
    court: "Lake Shore Park",
    day: "23", month: "May", weekday: "Fri", time: "9:00 AM",
    result: "W", score: "11–4, 11–8",
  },
  {
    id: 9, bucket: "past", status: "completed",
    opp: "Sofía Rodríguez",
    sport: "Pickleball",
    court: "Welles Park",
    day: "20", month: "May", weekday: "Tue", time: "5:00 PM",
    result: "L", score: "9–11, 7–11",
  },
];

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

function SessionRow({ s, onAccept, onDecline, onSoon, busy }: {
  s: any;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onSoon: (feature: string) => void;
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
        {s.status === "completed" && s.result ? (
          <div className="result-line">
            <span className={"result-tag " + s.result.toLowerCase()}>{s.result}</span>
            {s.score}
          </div>
        ) : (
          <StatusPill status={s.status} sentByMe={s.sentByMe} />
        )}

        <div className="sess-actions">
          {s.status === "confirmed" && (
            <>
              <button className="btn-sm primary" type="button" onClick={() => onSoon("Messaging")}>
                <Icon name="message" size={14} stroke={2.4} /> Message
              </button>
              <button className="btn-sm icon-only" title="Reschedule" type="button" onClick={() => onSoon("Rescheduling")}>
                <Icon name="calendar" size={15} />
              </button>
              <button className="btn-sm icon-only" title="More" type="button" onClick={() => onSoon("More actions")}>
                <Icon name="more" size={16} />
              </button>
            </>
          )}
          {s.status === "pending" && (
            <>
              <button className="btn-sm ghost" type="button" onClick={() => onSoon("Rescheduling")}>Reschedule</button>
              <button className="btn-sm danger" type="button" onClick={() => onDecline(s.id)} disabled={busy}>Cancel</button>
            </>
          )}
          {s.status === "requested" && (
            <>
              <button className="btn-sm primary" type="button" onClick={() => onAccept(s.id)} disabled={busy}>
                <Icon name="check" size={14} stroke={2.5} /> {busy ? "…" : "Accept"}
              </button>
              <button className="btn-sm danger" type="button" onClick={() => onDecline(s.id)} disabled={busy}>Decline</button>
            </>
          )}
          {s.status === "completed" && (
            <>
              <button className="btn-sm ghost" type="button" onClick={() => onSoon("Match details")}>View Details</button>
              <button className="btn-sm primary" type="button" onClick={() => onSoon("Rematch booking")}>
                <Icon name="bolt" size={13} stroke={2.4} /> Rematch
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

const TABS = [
  { id: "upcoming", label: "Upcoming",  icon: "calendar" },
  { id: "requests", label: "Requests",  icon: "bell" },
  { id: "past",     label: "Past",      icon: "trophy" },
];

function SessionsPage() {
  const [tab, setTab] = useState("upcoming");
  const { show, soon } = useToast();

  /* Live sessions from the API. An EMPTY array is a real "no sessions yet"
     answer (new users) — only fall back to the demo array when the backend
     never responds, so real users never see fabricated matches. */
  const { data: apiData } = useSessions();
  const liveSessions = apiData ? apiData.sessions : null;
  const sessions = liveSessions ?? (SESSIONS as any);
  const dataSource: "live" | "demo" = liveSessions ? "live" : "demo";

  const accept = useAcceptSession();
  const decline = useDeclineSession();

  const handleAccept = (id: number) => {
    accept.mutate(id, {
      onSuccess: () => show("Session accepted", "success"),
      onError:   () => show("Couldn't accept — try again", "error"),
    });
  };
  const handleDecline = (id: number) => {
    decline.mutate(id, {
      onSuccess: () => show("Session declined", "success"),
      onError:   () => show("Couldn't decline — try again", "error"),
    });
  };
  const busyId = accept.isPending
    ? accept.variables
    : decline.isPending
    ? decline.variables
    : null;

  const counts = useMemo(() => ({
    upcoming: sessions.filter((s: any) => s.bucket === "upcoming").length,
    requests: sessions.filter((s: any) => s.bucket === "requests").length,
    past:     sessions.filter((s: any) => s.bucket === "past").length,
  }), [sessions]);

  // Real stats derived from the session list (no hardcoded numbers).
  const stats = useMemo(() => {
    const completed = sessions.filter((s: any) => s.status === "completed");
    const wins = completed.filter((s: any) => s.result === "W").length;
    const losses = completed.filter((s: any) => s.result === "L").length;
    const decided = wins + losses;
    const pending = sessions.filter((s: any) => s.status === "pending");
    const pendingSent = pending.filter((s: any) => s.sentByMe).length;
    return {
      completed: completed.length,
      wins,
      losses,
      winRate: decided ? Math.round((wins / decided) * 100) : null,
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
              {dataSource === "demo"
                ? "Showing example sessions while we reconnect"
                : `${counts.upcoming} upcoming · ${counts.requests} request${counts.requests === 1 ? "" : "s"}`}
            </div>
            <h1 className="h1">My <em>sessions.</em></h1>
            <p className="sub">
              Track every match — from the request to the final score.
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
          <div className="stat-card">
            <span className="label">Games Played</span>
            <span className="value">{stats.completed}</span>
            <span className="sub">{stats.completed === 0 ? "No games yet" : "Completed"}</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Win Rate</span>
            <span className="value">{stats.winRate === null ? "—" : `${stats.winRate}%`}</span>
            <span className="sub">{stats.wins}W · {stats.losses}L</span>
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

        <div className="section-head">
          <h2 className="section-title">
            {tab === "upcoming" && <>Upcoming <span className="count">{counts.upcoming} scheduled</span></>}
            {tab === "requests" && <>Game Requests <span className="count">{counts.requests} waiting</span></>}
            {tab === "past"     && <>Match History <span className="count">{counts.past} completed</span></>}
          </h2>
        </div>

        <div className="session-list">
          {visible.length === 0 ? (
            <div className="empty">
              <div className="ico-wrap"><Icon name="calendar" size={24} /></div>
              <h3 className="empty-title">Nothing here yet</h3>
              <p className="empty-sub">When you book a game, it'll show up right here.</p>
              <Link className="btn-primary" to="/find">
                <Icon name="search" size={15} stroke={2.4} /> Find a Partner
              </Link>
            </div>
          ) : (
            visible.map((s: any) => (
              <SessionRow
                key={s.id}
                s={s}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onSoon={soon}
                busy={busyId === s.id}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}

export default SessionsPage;
