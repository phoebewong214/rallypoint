import React, { useState } from "react";
import { TopNav, Icon } from "../rally-shared";

const USER = {
  name: "Alex Rivera",
  initials: "AR",
  handle: "@alexr",
  ntrp: "3.5",
  primarySport: "Pickleball",
  secondarySport: "Tennis",
  location: "Berkeley, CA",
  joined: "Jan 2025",
  bio: "Capstone student picking up pickleball this semester. Looking for steady weekend partners around Berkeley — I play three times a week and I'm working on my third shot drop and dinking consistency. Tennis background (NTRP 3.0 backhand still in progress).",
  stats: { played: 27, wins: 18, losses: 9, winRate: 67, streak: 4 },
};

const RECENT_MATCHES = [
  { id: 1, opp: "Maya Patel",       sport: "Pickleball", court: "Oak Park Courts",   score: "11–7, 11–9",      date: "2 days ago",   result: "W" },
  { id: 2, opp: "Jordan Williams",  sport: "Tennis",     court: "UC Berkeley · #4",  score: "6–3, 4–6, 7–5",   date: "4 days ago",   result: "W" },
  { id: 3, opp: "Marcus Chen",      sport: "Tennis",     court: "Strawberry Canyon", score: "3–6, 2–6",        date: "Last week",    result: "L" },
  { id: 4, opp: "Aisha Johnson",    sport: "Pickleball", court: "Cesar Chavez Park", score: "11–4, 11–8",      date: "Last week",    result: "W" },
  { id: 5, opp: "Sofía Rodríguez",  sport: "Pickleball", court: "Oak Park Courts",   score: "9–11, 7–11",      date: "2 weeks ago",  result: "L" },
];

const AVAILABILITY = [
  { label: "MORN",  row: [0, 0, 0, 0, 0, 2, 2] },
  { label: "AFT",   row: [0, 0, 1, 0, 1, 1, 1] },
  { label: "EVE",   row: [0, 2, 0, 2, 0, 1, 0] },
];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const ACHIEVEMENTS = [
  { icon: "flame",    name: "5-game streak",  unlocked: true },
  { icon: "trophy",   name: "First Win",      unlocked: true },
  { icon: "bolt",     name: "Level Up: 3.5",  unlocked: true },
  { icon: "users",    name: "10 Partners",    unlocked: true },
  { icon: "calendar", name: "Daily Player",   unlocked: false },
  { icon: "stats",    name: "100 Matches",    unlocked: false },
];

function ProfilePage() {
  // eslint-disable-next-line no-unused-vars
  const [tab, setTab] = useState("matches");

  return (
    <>
      <TopNav active={null} user={{ name: USER.name, initials: USER.initials }} />

      <main className="page">
        {/* Hero */}
        <section className="profile-hero">
          <div className="cover" />
          <div className="hero-body">
            <div className="hero-avatar-wrap">
              <div className="hero-avatar">
                {USER.initials}
                <span className="online" />
              </div>
            </div>

            <div className="hero-info">
              <h1 className="hero-name">{USER.name}</h1>
              <div className="hero-meta">
                <span>{USER.handle}</span>
                <span className="dot" />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="pin" size={13} /> {USER.location}
                </span>
                <span className="dot" />
                <span>Joined {USER.joined}</span>
              </div>
              <div className="hero-badges">
                <span className="badge skill">NTRP {USER.ntrp}</span>
                <span className="badge"><Icon name="paddle" size={11} /> {USER.primarySport}</span>
                <span className="badge sport"><Icon name="tennis" size={11} /> {USER.secondarySport}</span>
                <span className="badge blue"><Icon name="flame" size={11} /> {USER.stats.streak}-win streak</span>
              </div>
            </div>

            <div className="hero-actions">
              <button className="btn-ghost">
                <Icon name="share" size={15} /> Share
              </button>
              <button className="btn-primary">
                <Icon name="edit" size={15} stroke={2.4} /> Edit Profile
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="label">Matches Played</span>
            <span className="value">{USER.stats.played}</span>
            <span className="sub">All time</span>
          </div>
          <div className="stat-card">
            <span className="label">Wins</span>
            <span className="value">{USER.stats.wins}</span>
            <span className="sub">+3 this month</span>
          </div>
          <div className="stat-card">
            <span className="label">Losses</span>
            <span className="value">{USER.stats.losses}</span>
            <span className="sub">+1 this month</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Win Rate</span>
            <span className="value">{USER.stats.winRate}%</span>
            <span className="sub">▲ 4% vs last mo.</span>
          </div>
          <div className="stat-card">
            <span className="label">Current Streak</span>
            <span className="value">{USER.stats.streak}W</span>
            <span className="sub">Personal best: 6</span>
          </div>
        </section>

        {/* Body grid */}
        <section className="body-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* About */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">
                  <span className="ico"><Icon name="user" size={15} /></span>
                  About
                </h2>
                <button className="panel-action">
                  <Icon name="edit" size={13} /> Edit
                </button>
              </div>
              <p className="bio">{USER.bio}</p>
            </div>

            {/* Recent matches */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">
                  <span className="ico green"><Icon name="trophy" size={15} /></span>
                  Recent Matches
                </h2>
                <button className="panel-action">
                  View all <Icon name="chevron-r" size={13} />
                </button>
              </div>
              <div className="match-list">
                {RECENT_MATCHES.map((m) => (
                  <div key={m.id} className="match-row">
                    <div className={"result-badge " + (m.result === "W" ? "w" : "l")}>
                      {m.result}
                    </div>
                    <div className="match-main">
                      <p className="match-opp">vs {m.opp}</p>
                      <span className="match-meta">{m.sport} · {m.court}</span>
                    </div>
                    <div className="match-score">{m.score}</div>
                    <div className="match-date">{m.date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Preferences */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">
                  <span className="ico blue"><Icon name="settings" size={15} /></span>
                  Preferences
                </h2>
              </div>
              <div className="info-list">
                <div className="info-row">
                  <span className="ico green"><Icon name="paddle" size={16} /></span>
                  <div>
                    <div className="label">Primary Sport</div>
                    <div className="value">{USER.primarySport}</div>
                  </div>
                </div>
                <div className="info-row">
                  <span className="ico"><Icon name="tennis" size={16} /></span>
                  <div>
                    <div className="label">Also plays</div>
                    <div className="value">{USER.secondarySport}</div>
                  </div>
                </div>
                <div className="info-row">
                  <span className="ico green"><Icon name="bolt" size={16} /></span>
                  <div>
                    <div className="label">Skill Level</div>
                    <div className="value value-mono">NTRP {USER.ntrp}</div>
                  </div>
                </div>
                <div className="info-row">
                  <span className="ico blue"><Icon name="pin" size={16} /></span>
                  <div>
                    <div className="label">Home Court</div>
                    <div className="value">Oak Park Courts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">
                  <span className="ico green"><Icon name="calendar" size={15} /></span>
                  Availability
                </h2>
                <button className="panel-action">
                  <Icon name="edit" size={13} /> Edit
                </button>
              </div>

              <div className="avail-wrap">
                <div className="avail-label-col" />
                <div className="avail-grid">
                  {DAYS.map((d, i) => (
                    <div key={i} className="avail-cell day-label">{d}</div>
                  ))}
                </div>

                {AVAILABILITY.map((band) => (
                  <React.Fragment key={band.label}>
                    <div className="avail-label-col">{band.label}</div>
                    <div className="avail-grid">
                      {band.row.map((v, i) => (
                        <div
                          key={i}
                          className={"avail-cell " + (v === 2 ? "on" : v === 1 ? "half" : "")}
                          title={v === 2 ? "Available" : v === 1 ? "Maybe" : "Unavailable"}
                        />
                      ))}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div style={{
                display: "flex", gap: 14, marginTop: 14,
                fontSize: 11, color: "var(--text-low)", fontWeight: 600
              }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "var(--green)", borderRadius: 3 }} /> Available
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "var(--green-soft)", border: "1px solid var(--green)", borderRadius: 3 }} /> Maybe
                </span>
              </div>
            </div>

            {/* Achievements */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">
                  <span className="ico green"><Icon name="flame" size={15} /></span>
                  Achievements
                </h2>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-low)", fontWeight: 600 }}>
                  4 / 6
                </span>
              </div>
              <div className="ach-grid">
                {ACHIEVEMENTS.map((a, i) => (
                  <div key={i} className={"ach" + (a.unlocked ? "" : " locked")}>
                    <span className={"ico-circ" + (a.unlocked ? "" : " locked")}>
                      <Icon name={a.icon} size={16} stroke={2.4} />
                    </span>
                    <span className="name">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

export default ProfilePage;
