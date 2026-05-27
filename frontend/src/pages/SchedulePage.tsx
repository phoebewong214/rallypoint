import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TopNav, Icon } from "../rally-shared";
import { useToast } from "../contexts/ToastContext";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  out.setDate(out.getDate() - dow);
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth() &&
         a.getDate()     === b.getDate();
}

const TIME_SLOTS = [
  "6 AM", "8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM",
];

const BOOKINGS = [
  {
    id: 1, day: 1, slot: 1, span: 1, sport: "pickleball",
    title: "vs Maya Patel", time: "8:00 AM", court: "Oak Park",
    next: true,
  },
  {
    id: 2, day: 3, slot: 6, span: 1, sport: "tennis",
    title: "vs Jordan W.", time: "6:30 PM", court: "Berkeley #4",
  },
  {
    id: 3, day: 5, slot: 1, span: 1, sport: "pickleball",
    title: "vs Aisha J.", time: "9:30 AM", court: "Chavez Park",
  },
  {
    id: 4, day: 5, slot: 5, span: 1, sport: "open",
    title: "Open slot", time: "Recurring", court: "Free · 4–6 PM",
  },
  {
    id: 5, day: 6, slot: 2, span: 1, sport: "tennis",
    title: "vs Marcus C.", time: "10:00 AM", court: "Strawberry · pending",
  },
];

const RECURRING = [
  { day: "Sat", time: "4–6 PM", label: "Open play",    sport: "open"  },
  { day: "Sun", time: "10 AM",  label: "Pickup match", sport: "tennis" },
];

function SchedulePage() {
  const { soon } = useToast();
  /* weekOffset: 0 = current week, -1 = previous, +1 = next */
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const weekStart = addDays(startOfWeek(today), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);

  const DAYS = useMemo(
    () =>
      DAY_LABELS.map((label, i) => {
        const d = addDays(weekStart, i);
        return {
          label,
          date: String(d.getDate()),
          today: weekOffset === 0 && sameDate(d, today),
          fullDate: d,
        };
      }),
    [weekStart, today, weekOffset]
  );

  const weekRangeLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
      : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;

  /* Only show bookings if we're on the "demo" week (offset 0). Other weeks empty. */
  const visibleBookings = weekOffset === 0 ? BOOKINGS : [];

  return (
    <>
      <TopNav active="schedule" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="dot" /> Week of {weekRangeLabel} · {visibleBookings.length} sessions
            </div>
            <h1 className="h1">Your weekly <em>schedule.</em></h1>
            <p className="sub">
              See every booked session, find open slots, and lock in your next match.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <button className="btn-ghost" type="button" onClick={() => soon("Calendar sync")}>
              <Icon name="calendar" size={15} /> Sync Calendar
            </button>
            <Link to="/find" className="btn-primary" style={{ textDecoration: "none" }}>
              <Icon name="plus" size={16} stroke={2.5} /> Schedule Game
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="label">Booked This Week</span>
            <span className="value">5</span>
            <span className="sub">8.5 hours total</span>
          </div>
          <div className="stat-card">
            <span className="label">Open Slots</span>
            <span className="value">12</span>
            <span className="sub">in next 7 days</span>
          </div>
          <div className="stat-card">
            <span className="label">Recurring</span>
            <span className="value">2</span>
            <span className="sub">Sat & Sun</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Next Match</span>
            <span className="value">Tue · 8 AM</span>
            <span className="sub">vs Maya Patel</span>
          </div>
        </section>

        <div className="sched-layout">
          {/* Main calendar */}
          <div>
            {/* Week navigation */}
            <div className="week-nav">
              <div className="week-nav-label">
                Week of <b style={{ color: "var(--text)" }}>{weekRangeLabel}</b>
              </div>
              <div className="week-nav-controls">
                <button
                  className="week-nav-btn"
                  title="Previous week"
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                >
                  <Icon name="chevron-r" size={14} style={{ transform: "rotate(180deg)" }} />
                </button>
                <button
                  className="btn-sm ghost"
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  disabled={weekOffset === 0}
                  style={{ opacity: weekOffset === 0 ? 0.5 : 1 }}
                >
                  Today
                </button>
                <button
                  className="week-nav-btn"
                  title="Next week"
                  type="button"
                  onClick={() => setWeekOffset((w) => w + 1)}
                >
                  <Icon name="chevron-r" size={14} />
                </button>
              </div>
            </div>

            {/* Calendar grid — every child has an explicit gridColumn/gridRow.
                That way the absolutely-placed booking blocks below cannot push
                the auto-flow cells out of position (cascading-displacement bug). */}
            <div className="sched-grid">
              <div className="sched-corner" style={{ gridColumn: 1, gridRow: 1 }} />
              {DAYS.map((d, ci) => (
                <div
                  key={d.label}
                  className={"sched-day-head" + (d.today ? " today" : "")}
                  style={{ gridColumn: ci + 2, gridRow: 1 }}
                >
                  <span className="day-name">{d.label}</span>
                  <span className="day-num">{d.date}</span>
                </div>
              ))}

              {TIME_SLOTS.map((slot, ri) => (
                <React.Fragment key={ri}>
                  <div
                    className="sched-time"
                    style={{ gridColumn: 1, gridRow: ri + 2 }}
                  >
                    {slot}
                  </div>
                  {DAYS.map((d, ci) => (
                    <div
                      key={ci}
                      className={"sched-cell" + (d.today ? " today-col" : "")}
                      style={{ gridColumn: ci + 2, gridRow: ri + 2 }}
                      onClick={() => soon(`Book ${d.label} ${slot}`)}
                    />
                  ))}
                </React.Fragment>
              ))}

              {/* Booked blocks layered on top of the grid cells. */}
              {visibleBookings.map((b) => (
                <div
                  key={b.id}
                  className={"sched-block " + b.sport + (b.next ? " next" : "")}
                  style={{
                    gridColumn: b.day + 2,
                    gridRow: `${b.slot + 2} / span ${b.span}`,
                  }}
                  onClick={() => soon("Session detail view")}
                >
                  <div className="sched-block-top">
                    <div className="sched-block-title">{b.title}</div>
                    <div className="sched-block-meta">{b.court}</div>
                  </div>
                  <div className="sched-block-time">{b.time}</div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="sched-legend">
              <span className="lgi"><span className="sw pickleball" /> Pickleball</span>
              <span className="lgi"><span className="sw tennis" /> Tennis</span>
              <span className="lgi"><span className="sw open" /> Open / Recurring</span>
              <span className="lgi"><span className="sw empty" /> Available — click to book</span>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="feed-side">
            {/* Today's schedule */}
            <div className="side-panel">
              <h3 className="side-title">
                <Icon name="calendar" size={14} stroke={2.4} /> Today
              </h3>
              <div className="empty" style={{ padding: "28px 16px", marginTop: -4 }}>
                <div className="ico-wrap"><Icon name="sparkles" size={20} stroke={2.4} /></div>
                <h3 className="empty-title">Free Monday</h3>
                <p className="empty-sub">No sessions on the books today.</p>
                <Link className="btn-sm primary" to="/find" style={{ textDecoration: "none" }}>
                  <Icon name="search" size={13} stroke={2.4} /> Find a Partner
                </Link>
              </div>
            </div>

            {/* Recurring slots */}
            <div className="side-panel">
              <h3 className="side-title">
                <Icon name="bolt" size={14} stroke={2.4} /> Recurring Slots
              </h3>
              <div className="rec-list">
                {RECURRING.map((r, i) => (
                  <div key={i} className="rec-row">
                    <div className={"rec-dot " + r.sport} />
                    <div className="rec-info">
                      <p className="rec-label">{r.label}</p>
                      <span className="rec-meta">{r.day} · {r.time}</span>
                    </div>
                    <button className="btn-sm ghost" type="button" onClick={() => soon("Recurring slot editing")}>Edit</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick schedule actions */}
            <div className="side-panel">
              <h3 className="side-title">
                <Icon name="plus" size={14} stroke={2.4} /> Quick Schedule
              </h3>
              <div className="quick-list">
                <Link to="/find" className="quick-row">
                  <span className="qico green"><Icon name="search" size={15} /></span>
                  <div className="quick-text">
                    <p className="quick-title">Find a partner</p>
                    <span className="quick-meta">Match by skill & time</span>
                  </div>
                  <Icon name="chevron-r" size={14} />
                </Link>
                <Link to="/courts" className="quick-row">
                  <span className="qico blue"><Icon name="pin" size={15} /></span>
                  <div className="quick-text">
                    <p className="quick-title">Browse courts</p>
                    <span className="quick-meta">Check open slots</span>
                  </div>
                  <Icon name="chevron-r" size={14} />
                </Link>
                <button className="quick-row" type="button" onClick={() => soon("Time blocking")}>
                  <span className="qico"><Icon name="bookmark" size={15} /></span>
                  <div className="quick-text">
                    <p className="quick-title">Block time</p>
                    <span className="quick-meta">Mark unavailable hours</span>
                  </div>
                  <Icon name="chevron-r" size={14} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

export default SchedulePage;
