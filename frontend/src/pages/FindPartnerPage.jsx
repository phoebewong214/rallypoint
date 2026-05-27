import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { TopNav, Icon } from "../rally-shared";

const PLAYERS = [
  {
    id: 1,
    name: "Maya Patel",
    initials: "MP",
    color: "linear-gradient(135deg, #00E07A, #00B864)",
    fg: "#062414",
    sport: "Pickleball",
    ntrp: "3.5",
    distance: "0.8",
    availability: "Weekends, mornings",
    matchScore: 96,
    reason: "Great match — same NTRP and you both prefer weekend mornings at Oak Park.",
    online: true,
  },
  {
    id: 2,
    name: "Jordan Williams",
    initials: "JW",
    color: "linear-gradient(135deg, #2EA8FF, #1B7FCC)",
    fg: "#FFFFFF",
    sport: "Tennis",
    ntrp: "4.0",
    distance: "2.3",
    availability: "Weekday evenings",
    matchScore: 91,
    reason: "Strong rally partner — competitive level, lives near your home court.",
    online: true,
  },
  {
    id: 3,
    name: "Sofía Rodríguez",
    initials: "SR",
    color: "linear-gradient(135deg, #FF6B9D, #C93B73)",
    fg: "#FFFFFF",
    sport: "Pickleball",
    ntrp: "3.0",
    distance: "1.2",
    availability: "Afternoons, weekdays",
    matchScore: 88,
    reason: "Good fit for casual play — close to your skill range and flexible afternoons.",
    online: false,
  },
  {
    id: 4,
    name: "Marcus Chen",
    initials: "MC",
    color: "linear-gradient(135deg, #FFB13C, #E07A00)",
    fg: "#2A1500",
    sport: "Tennis",
    ntrp: "4.5",
    distance: "3.7",
    availability: "Mornings, weekends",
    matchScore: 84,
    reason: "Push your game — slightly higher skill and shares your morning schedule.",
    online: true,
  },
  {
    id: 5,
    name: "Aisha Johnson",
    initials: "AJ",
    color: "linear-gradient(135deg, #B07CFF, #7B3FE4)",
    fg: "#FFFFFF",
    sport: "Pickleball",
    ntrp: "3.5",
    distance: "0.8",
    availability: "Evenings, weekends",
    matchScore: 93,
    reason: "Perfect chemistry — equal skill, walking distance, overlapping evening windows.",
    online: false,
  },
];

function NTRPRange({ value, onChange }) {
  const MIN = 2.0, MAX = 5.0, STEP = 0.5;
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const pct = (v) => ((v - MIN) / (MAX - MIN)) * 100;
  const loPct = pct(value[0]);
  const hiPct = pct(value[1]);

  const handlePointer = useCallback((e) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    let p = Math.max(0, Math.min(1, x / rect.width));
    let v = MIN + p * (MAX - MIN);
    v = Math.round(v / STEP) * STEP;
    if (drag === "lo") onChange([Math.min(v, value[1] - STEP), value[1]]);
    else onChange([value[0], Math.max(v, value[0] + STEP)]);
  }, [drag, value, onChange]);

  useEffect(() => {
    if (!drag) return;
    const move = (e) => handlePointer(e);
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, handlePointer]);

  return (
    <div>
      <div className="slider-wrap">
        <div className="slider-track" ref={trackRef}>
          <div className="slider-fill" style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }} />
          <div
            className={"slider-thumb" + (drag === "lo" ? " active" : "")}
            style={{ left: `${loPct}%` }}
            onPointerDown={(e) => { e.preventDefault(); setDrag("lo"); }}
          />
          <div
            className={"slider-thumb" + (drag === "hi" ? " active" : "")}
            style={{ left: `${hiPct}%` }}
            onPointerDown={(e) => { e.preventDefault(); setDrag("hi"); }}
          />
        </div>
      </div>
      <div className="slider-values">
        <span className="slider-value">NTRP {value[0].toFixed(1)}</span>
        <span className="slider-meta">{((value[1] - value[0]) / STEP) + 1} levels</span>
        <span className="slider-value">NTRP {value[1].toFixed(1)}</span>
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters, onFind }) {
  const setSport = (s) => setFilters((f) => ({ ...f, sport: s }));
  return (
    <div className="filter-bar">
      <div className="field">
        <label className="field-label">
          <Icon name="trophy" size={13} /> Sport
        </label>
        <div className="pill-group" role="tablist">
          <button
            className={"pill" + (filters.sport === "Pickleball" ? " active" : "")}
            onClick={() => setSport("Pickleball")}
          >
            <Icon name="paddle" size={15} /> Pickleball
          </button>
          <button
            className={"pill" + (filters.sport === "Tennis" ? " active" : "")}
            onClick={() => setSport("Tennis")}
          >
            <Icon name="tennis" size={15} /> Tennis
          </button>
        </div>
      </div>

      <div className="field">
        <label className="field-label">
          <Icon name="bolt" size={13} /> Skill Level
        </label>
        <NTRPRange
          value={filters.ntrp}
          onChange={(v) => setFilters((f) => ({ ...f, ntrp: v }))}
        />
      </div>

      <div className="field">
        <label className="field-label">
          <Icon name="clock" size={13} /> Preferred Time
        </label>
        <div className="select">
          <select
            value={filters.time}
            onChange={(e) => setFilters((f) => ({ ...f, time: e.target.value }))}
          >
            <option>Any time</option>
            <option>Morning</option>
            <option>Afternoon</option>
            <option>Evening</option>
            <option>Weekend</option>
          </select>
          <span className="select-caret"><Icon name="chevron" size={16} /></span>
        </div>
      </div>

      <button className="btn-find" onClick={onFind}>
        <Icon name="search" size={16} stroke={2.5} />
        Find Partners
      </button>
    </div>
  );
}

function PlayerCard({ player, requested, saved, onRequest, onSave }) {
  return (
    <article className="card">
      <div className="card-top">
        <div className="avatar" style={{ background: player.color, color: player.fg }}>
          {player.initials}
          {player.online && <span className="online" title="Online" />}
        </div>
        <div className="name-wrap">
          <h3 className="name">{player.name}</h3>
          <div className="sub-row">
            <span className="badge skill">NTRP {player.ntrp}</span>
            <span className="badge sport">{player.sport}</span>
          </div>
        </div>
      </div>

      <div className="meta-list">
        <div className="meta-row">
          <Icon name="pin" size={16} />
          <span className="dist">{player.distance} mi</span>
          <span style={{ color: "var(--text-low)" }}>·</span>
          <span>away</span>
        </div>
        <div className="meta-row">
          <Icon name="calendar" size={16} />
          <b>{player.availability}</b>
        </div>
      </div>

      <div className="ai-box">
        <div className="ai-ico"><Icon name="sparkles" size={14} stroke={2.4} /></div>
        <div className="ai-content">
          <div className="ai-label">
            AI Match
            <span className="ai-score">· {player.matchScore}% fit</span>
          </div>
          <p className="ai-text">{player.reason}</p>
        </div>
      </div>

      <div className="card-action">
        <button
          className={"btn-request" + (requested ? " requested" : "")}
          onClick={() => onRequest(player.id)}
        >
          {requested ? (
            <>
              <Icon name="check" size={16} stroke={2.5} /> Request Sent
            </>
          ) : (
            <>
              <Icon name="send" size={15} stroke={2.4} /> Request Game
            </>
          )}
        </button>
        <button
          className={"btn-icon" + (saved ? " active" : "")}
          aria-label="Save"
          onClick={() => onSave(player.id)}
        >
          <Icon name="bookmark" size={16} />
        </button>
      </div>
    </article>
  );
}

function FindPartnerPage() {
  const [filters, setFilters] = useState({
    sport: "Pickleball",
    ntrp: [3.0, 4.0],
    time: "Any time",
  });
  const [requested, setRequested] = useState(new Set());
  const [saved, setSaved] = useState(new Set());
  const [sort, setSort] = useState("match");

  const sortedPlayers = useMemo(() => {
    const arr = [...PLAYERS];
    if (sort === "match") arr.sort((a, b) => b.matchScore - a.matchScore);
    else if (sort === "distance") arr.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    else if (sort === "skill") arr.sort((a, b) => parseFloat(b.ntrp) - parseFloat(a.ntrp));
    return arr;
  }, [sort]);

  const toggle = (set, setter) => (id) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  return (
    <>
      <TopNav active="find" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow"><span className="dot" /> Live · 247 players online</div>
            <h1 className="h1">Find your next <em>rally partner.</em></h1>
            <p className="sub">
              Matched on skill, schedule, and court proximity. Powered by your play history.
            </p>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="n">12</div>
              <div className="l">Matches Played</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="n">3.5</div>
              <div className="l">Your NTRP</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="n">8</div>
              <div className="l">Saved</div>
            </div>
          </div>
        </header>

        <FilterBar
          filters={filters}
          setFilters={setFilters}
          onFind={() => {}}
        />

        <div className="results-head">
          <div className="results-title">
            <span>Top Matches</span>
            <span className="results-count">{sortedPlayers.length} found within 5 mi</span>
          </div>
          <div className="sort-row">
            <span>Sort:</span>
            {[
              ["match", "Best match"],
              ["distance", "Distance"],
              ["skill", "Skill"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={"sort-chip" + (sort === k ? " active" : "")}
                onClick={() => setSort(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid">
          {sortedPlayers.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              requested={requested.has(p.id)}
              saved={saved.has(p.id)}
              onRequest={toggle(requested, setRequested)}
              onSave={toggle(saved, setSaved)}
            />
          ))}
        </div>
      </main>
    </>
  );
}

export default FindPartnerPage;
