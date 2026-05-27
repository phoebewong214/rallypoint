import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TopNav, Icon, Avatar } from "../rally-shared";

const SESSIONS = [
  // ----- Upcoming -----
  {
    id: 1, bucket: "upcoming", status: "confirmed",
    opp: "Maya Patel", oppHandle: "@mayap",
    sport: "Pickleball",
    court: "Oak Park Courts", courtMiles: "0.8",
    day: "06", month: "Jun", weekday: "Tomorrow", time: "8:00 AM",
    next: true,
  },
  {
    id: 2, bucket: "upcoming", status: "pending",
    opp: "Jordan Williams", oppHandle: "@jordanw",
    sport: "Tennis",
    court: "UC Berkeley · Court #4", courtMiles: "2.3",
    day: "08", month: "Jun", weekday: "Thu", time: "6:30 PM",
    sentByMe: true,
  },
  {
    id: 3, bucket: "upcoming", status: "confirmed",
    opp: "Aisha Johnson", oppHandle: "@aishaj",
    sport: "Pickleball",
    court: "Cesar Chavez Park", courtMiles: "1.6",
    day: "10", month: "Jun", weekday: "Sat", time: "9:30 AM",
  },

  // ----- Requests (received) -----
  {
    id: 4, bucket: "requests", status: "requested",
    opp: "Marcus Chen", oppHandle: "@marcusc",
    sport: "Tennis",
    court: "Strawberry Canyon", courtMiles: "3.7",
    day: "11", month: "Jun", weekday: "Sun", time: "10:00 AM",
    note: "Up for an early Sunday match? I'll bring new balls.",
  },

  // ----- Past -----
  {
    id: 5, bucket: "past", status: "completed",
    opp: "Maya Patel",
    sport: "Pickleball",
    court: "Oak Park Courts",
    day: "01", month: "Jun", weekday: "Sun", time: "8:00 AM",
    result: "W", score: "11–7, 11–9",
  },
  {
    id: 6, bucket: "past", status: "completed",
    opp: "Jordan Williams",
    sport: "Tennis",
    court: "UC Berkeley · Court #4",
    day: "30", month: "May", weekday: "Fri", time: "6:30 PM",
    result: "W", score: "6–3, 4–6, 7–5",
  },
  {
    id: 7, bucket: "past", status: "completed",
    opp: "Marcus Chen",
    sport: "Tennis",
    court: "Strawberry Canyon",
    day: "26", month: "May", weekday: "Mon", time: "7:00 AM",
    result: "L", score: "3–6, 2–6",
  },
  {
    id: 8, bucket: "past", status: "completed",
    opp: "Aisha Johnson",
    sport: "Pickleball",
    court: "Cesar Chavez Park",
    day: "23", month: "May", weekday: "Fri", time: "9:00 AM",
    result: "W", score: "11–4, 11–8",
  },
  {
    id: 9, bucket: "past", status: "completed",
    opp: "Sofía Rodríguez",
    sport: "Pickleball",
    court: "Oak Park Courts",
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
  };
  const m = map[status] || { label: status, cls: "" };
  return (
    <span className={"status-pill " + m.cls}>
      <span className="pulse" />
      {m.label}
    </span>
  );
};

const SportIcon = ({ sport, ...rest }) => (
  <Icon name={sport === "Tennis" ? "tennis" : "paddle"} {...rest} />
);

function SessionRow({ s }) {
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
              <SportIcon sport={s.sport} size={14} /> <b>{s.sport}</b>
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
        {s.status === "completed" ? (
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
              <button className="btn-sm primary">
                <Icon name="message" size={14} stroke={2.4} /> Message
              </button>
              <button className="btn-sm icon-only" title="Reschedule"><Icon name="calendar" size={15} /></button>
              <button className="btn-sm icon-only" title="More"><Icon name="more" size={16} /></button>
            </>
          )}
          {s.status === "pending" && (
            <>
              <button className="btn-sm ghost">Reschedule</button>
              <button className="btn-sm danger">Cancel</button>
            </>
          )}
          {s.status === "requested" && (
            <>
              <button className="btn-sm primary">
                <Icon name="check" size={14} stroke={2.5} /> Accept
              </button>
              <button className="btn-sm danger">Decline</button>
            </>
          )}
          {s.status === "completed" && (
            <>
              <button className="btn-sm ghost">View Details</button>
              <button className="btn-sm primary">
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

  const counts = useMemo(() => ({
    upcoming: SESSIONS.filter((s) => s.bucket === "upcoming").length,
    requests: SESSIONS.filter((s) => s.bucket === "requests").length,
    past:     SESSIONS.filter((s) => s.bucket === "past").length,
  }), []);

  const visible = SESSIONS.filter((s) => s.bucket === tab);

  return (
    <>
      <TopNav active="matches" user={{ name: "Alex Rivera", initials: "AR" }} />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow"><span className="dot" /> {counts.upcoming + counts.requests} upcoming & pending</div>
            <h1 className="h1">My <em>sessions.</em></h1>
            <p className="sub">
              Track every match — from the request to the final score.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <button className="btn-ghost">
              <Icon name="calendar" size={15} /> Calendar
            </button>
            <button className="btn-primary">
              <Icon name="plus" size={16} stroke={2.5} /> Schedule Game
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="label">Upcoming</span>
            <span className="value">{counts.upcoming}</span>
            <span className="sub">Next: tomorrow, 8 AM</span>
          </div>
          <div className="stat-card">
            <span className="label">Pending Confirmations</span>
            <span className="value">2</span>
            <span className="sub">1 sent · 1 received</span>
          </div>
          <div className="stat-card">
            <span className="label">Played This Month</span>
            <span className="value">5</span>
            <span className="sub">+2 vs last month</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Win Rate · 30d</span>
            <span className="value">60%</span>
            <span className="sub">3W · 2L</span>
          </div>
        </section>

        {/* Tabs */}
        <div className="tab-bar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={15} /> {t.label}
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
            visible.map((s) => <SessionRow key={s.id} s={s} />)
          )}
        </div>
      </main>
    </>
  );
}

export default SessionsPage;
