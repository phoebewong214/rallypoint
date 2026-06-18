import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { TopNav, Icon, ratingLabel } from "../rally-shared";
import { usePlayers } from "../hooks/usePlayers";
import { PlayerCardSkeleton } from "../components/Skeleton";
import { useCreateSession } from "../hooks/useSessions";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";

const C = {
  green:  ["linear-gradient(135deg, #00E07A, #00B864)", "#062414"],
  blue:   ["linear-gradient(135deg, #2EA8FF, #1B7FCC)", "#FFFFFF"],
  pink:   ["linear-gradient(135deg, #FF6B9D, #C93B73)", "#FFFFFF"],
  orange: ["linear-gradient(135deg, #FFB13C, #E07A00)", "#2A1500"],
  purple: ["linear-gradient(135deg, #B07CFF, #7B3FE4)", "#FFFFFF"],
  teal:   ["linear-gradient(135deg, #2EE5D4, #0FB8A8)", "#062420"],
  red:    ["linear-gradient(135deg, #FF6B6B, #D43F3F)", "#FFFFFF"],
  amber:  ["linear-gradient(135deg, #FFD93D, #E0A800)", "#2A2200"],
};

const mk = (id, name, initials, palette, location, distance, online, sports) => {
  const [color, fg] = C[palette];
  const p = { id, name, initials, color, fg, location, distance, online };
  for (const [sport, ntrp, matchScore, availability, reason] of sports) {
    p[sport] = { ntrp, matchScore, availability, reason };
  }
  return p;
};

const PLAYERS = [
  mk(1, "Maya Patel", "MP", "green", "Lincoln Park", "0.8", true, [
    ["pickleball", "3.5", 96, "Weekends, mornings",
      "Same DUPR and you both prefer weekend mornings at Lincoln Park courts."],
  ]),
  mk(2, "Jordan Williams", "JW", "blue", "Wicker Park", "2.3", true, [
    ["tennis", "4.0", 91, "Weekday evenings",
      "Competitive rally partner — same level, lives near your home court."],
  ]),
  mk(3, "Sofía Rodríguez", "SR", "pink", "Logan Square", "1.2", false, [
    ["pickleball", "3.0", 88, "Afternoons, weekdays",
      "Good fit for casual play — close to your skill range and flexible afternoons."],
  ]),
  mk(4, "Marcus Chen", "MC", "orange", "Lakeview", "3.7", true, [
    ["tennis", "4.5", 84, "Mornings, weekends",
      "Push your game — slightly higher skill and shares your morning schedule."],
  ]),
  mk(5, "Aisha Johnson", "AJ", "purple", "Bucktown", "0.9", false, [
    ["pickleball", "3.5", 93, "Evenings, weekends",
      "Perfect chemistry — equal skill, walking distance, overlapping evening windows."],
  ]),
  mk(6, "Daniel Kim", "DK", "teal", "West Loop", "1.5", true, [
    ["pickleball", "4.0", 92, "Weeknights, Sat AM",
      "Plays both sports — strong pickleball game with shared evening availability."],
    ["tennis", "3.5", 86, "Weeknights, Sat AM",
      "Solid baseliner — close to your tennis level and free most weeknights."],
  ]),
  mk(7, "Priya Sharma", "PS", "red", "River North", "2.0", true, [
    ["tennis", "3.5", 89, "Weekday lunches",
      "Lunchtime regular at Grant Park — same level, easy to schedule rallies."],
  ]),
  mk(8, "Tyler Brooks", "TB", "amber", "Old Town", "1.1", true, [
    ["pickleball", "4.0", 90, "Evenings, weekends",
      "Aggressive net play — pushes you on smashes and lives a few blocks away."],
  ]),
  mk(9, "Hannah Goldberg", "HG", "green", "Andersonville", "4.2", false, [
    ["tennis", "3.0", 82, "Saturday mornings",
      "Friendly hitter — perfect for warm-up rallies on Saturday mornings."],
  ]),
  mk(10, "Diego Martínez", "DM", "blue", "Pilsen", "2.8", true, [
    ["pickleball", "3.5", 87, "Weeknights",
      "Solid all-court player — same pickleball level and shared weeknight slots."],
    ["tennis", "4.0", 90, "Weeknights",
      "Strong forehand and shared weeknight availability — great tennis push."],
  ]),
  mk(11, "Mei Lin", "ML", "pink", "Chinatown", "3.4", true, [
    ["pickleball", "4.5", 85, "Weekend afternoons",
      "Tournament-level dink game — best for sharpening your soft game."],
  ]),
  mk(12, "Olivia Carter", "OC", "orange", "Streeterville", "1.7", false, [
    ["tennis", "4.0", 88, "Mornings, weekends",
      "Consistent baseline — same level and prefers your home court on weekends."],
  ]),
  mk(13, "Andre Thompson", "AT", "purple", "Hyde Park", "5.6", true, [
    ["pickleball", "3.0", 79, "Sundays",
      "Sunday regular at Promontory Point — relaxed games at your level."],
  ]),
  mk(14, "Yuki Tanaka", "YT", "teal", "Lakeview", "3.5", true, [
    ["pickleball", "3.5", 86, "Weekday evenings",
      "Steady third-shot drops — same pickleball DUPR and evenings open."],
    ["tennis", "3.5", 85, "Weekday evenings",
      "Versatile partner across both sports — shared evening windows."],
  ]),
  mk(15, "Rachel Adams", "RA", "red", "Wicker Park", "2.1", false, [
    ["pickleball", "4.0", 88, "Sat & Sun mornings",
      "Disciplined dinker — same level and walkable to your usual courts."],
    ["tennis", "3.5", 83, "Sat & Sun mornings",
      "Lighter tennis player — fun warm-up rallies on weekend mornings."],
  ]),
  mk(16, "Mohammed Ali", "MA", "amber", "Edgewater", "5.1", true, [
    ["tennis", "4.5", 81, "Weekends",
      "Hard-hitting baseliner — best when you want a real workout on weekends."],
  ]),
  mk(17, "Emma O'Brien", "EO", "green", "Lincoln Square", "4.4", true, [
    ["pickleball", "3.5", 87, "Mornings",
      "Reliable morning partner — same DUPR, prefers Welles Park courts."],
  ]),
  mk(18, "Carlos Vega", "CV", "blue", "Pilsen", "2.9", false, [
    ["tennis", "3.0", 80, "Sunday afternoons",
      "Easy-going hitter — great for casual Sunday rallies near Harrison Park."],
  ]),
  mk(19, "Naomi Park", "NP", "pink", "Gold Coast", "1.3", true, [
    ["pickleball", "4.0", 91, "Weeknights",
      "Quick hands at the kitchen — same level, very close to your home court."],
  ]),
  mk(20, "Liam Walsh", "LW", "orange", "Roscoe Village", "3.0", true, [
    ["tennis", "4.0", 88, "Weekday evenings",
      "Steady serve-and-volley — perfect midweek tennis match."],
  ]),
  mk(21, "Zara Hussain", "ZH", "purple", "Uptown", "4.7", true, [
    ["pickleball", "3.0", 84, "Weekends",
      "Plays both sports at 3.0 — great low-pressure weekend hits."],
    ["tennis", "3.0", 83, "Weekends",
      "Same tennis level — friendly weekend rallies at Margate Park."],
  ]),
  mk(22, "Brandon Lee", "BL", "teal", "Gold Coast", "1.4", false, [
    ["tennis", "5.0", 78, "Early mornings",
      "Former college player — challenging match if you want to level up."],
  ]),
  mk(23, "Isabella Romano", "IR", "red", "Bridgeport", "4.0", true, [
    ["pickleball", "3.5", 86, "Sundays, weeknights",
      "Patient rallier — same level and a regular at McGuane Park."],
  ]),
  mk(24, "Kwame Okafor", "KO", "amber", "Bronzeville", "4.8", false, [
    ["tennis", "4.5", 82, "Saturday mornings",
      "Strong topspin game — great Saturday morning workout."],
  ]),
  mk(25, "Lena Müller", "LM", "green", "Ukrainian Village", "2.2", true, [
    ["pickleball", "4.0", 90, "Weeknights, Sun PM",
      "Tournament regular — sharp dink-and-drive game at your level."],
    ["tennis", "4.5", 87, "Weeknights, Sun PM",
      "Bigger tennis game — push your serve and return under pressure."],
  ]),
  mk(26, "Trevor Davies", "TD", "blue", "Wrigleyville", "3.3", true, [
    ["pickleball", "3.0", 81, "Evenings",
      "Newer to pickleball — fun, no-stakes evening games at your level."],
    ["tennis", "3.5", 85, "Evenings",
      "Tennis is his main sport — consistent rallies on weeknights."],
  ]),
  mk(27, "Anika Reddy", "AR", "pink", "West Loop", "1.6", true, [
    ["pickleball", "4.5", 84, "Weekday lunches",
      "Tournament-level player — perfect if you want to sharpen your game."],
  ]),
  mk(28, "Jonas Berg", "JB", "orange", "Avondale", "3.8", false, [
    ["pickleball", "3.0", 80, "Weekends",
      "Casual weekend player — both of you are 3.0 and like Avondale Park."],
    ["tennis", "3.0", 79, "Weekends",
      "Same tennis level — enjoyable, relaxed weekend matches."],
  ]),
  mk(29, "Camila Silva", "CS", "purple", "Humboldt Park", "2.6", true, [
    ["pickleball", "2.5", 76, "Weekends",
      "Just starting pickleball — great for relaxed practice on weekends."],
    ["tennis", "3.0", 82, "Weekends",
      "Slightly below your tennis level — good for warm-up rallies."],
  ]),
  mk(30, "Ethan Bennett", "EB", "teal", "Lakeview", "3.5", true, [
    ["tennis", "4.0", 89, "Weeknights",
      "Reliable weeknight partner — same level, free at your usual times."],
  ]),
  mk(31, "Layla Hassan", "LH", "red", "Albany Park", "5.0", false, [
    ["pickleball", "3.5", 83, "Saturdays",
      "Saturday-only player — same DUPR, dependable weekend rallies."],
  ]),
  mk(32, "Vincent Nguyen", "VN", "amber", "Edgewater", "5.2", true, [
    ["tennis", "4.0", 85, "Sunday mornings",
      "Consistent Sunday partner — same level, sticks to a steady schedule."],
  ]),
  mk(33, "Grace Whitfield", "GW", "green", "Lincoln Park", "0.7", true, [
    ["pickleball", "3.5", 94, "Weeknights, Sat AM",
      "Closest match — walking distance, same level, very flexible schedule."],
    ["tennis", "4.0", 89, "Weeknights, Sat AM",
      "Strong tennis serve and shared evening availability."],
  ]),
  mk(34, "Hiroshi Yamada", "HY", "blue", "Old Town", "1.2", false, [
    ["tennis", "5.0", 80, "Early mornings",
      "Former collegiate player — best for serious match practice."],
  ]),
  mk(35, "Esme DuBois", "ED", "pink", "Wicker Park", "2.4", true, [
    ["pickleball", "3.0", 83, "Evenings, weekends",
      "Newer player at your level — friendly games at Wicker Park courts."],
  ]),
  mk(36, "Connor Murphy", "CM", "orange", "Beverly", "7.8", false, [
    ["tennis", "3.5", 76, "Sunday afternoons",
      "Southside regular — willing to drive in for a good Sunday match."],
  ]),
  mk(37, "Aaliyah Banks", "AB", "purple", "Kenwood", "5.4", true, [
    ["pickleball", "4.0", 84, "Saturday mornings",
      "Solid south-side partner — same DUPR and consistent weekend slots."],
  ]),
  mk(38, "Rafael Cruz", "RC", "teal", "Logan Square", "1.3", true, [
    ["pickleball", "4.5", 89, "Weeknights",
      "Top-tier dink game — sharpens your soft shots, very close by."],
    ["tennis", "4.5", 88, "Weeknights",
      "High-level tennis match — pushes you on serve and return."],
  ]),
  mk(39, "Tessa Lindberg", "TL", "red", "North Center", "3.6", false, [
    ["tennis", "3.0", 78, "Weekends",
      "Casual weekend hitter — relaxed pace, perfect for warm-ups."],
  ]),
  mk(40, "Omar Khalid", "OK", "amber", "Rogers Park", "6.0", true, [
    ["pickleball", "3.0", 79, "Sundays",
      "Far north partner — same DUPR, dedicated Sunday player."],
    ["tennis", "3.5", 82, "Sundays",
      "Versatile partner — also plays tennis at a similar level."],
  ]),
];

function NTRPRange({ value, onChange, label }: { value: [number, number]; onChange: (v: [number, number]) => void; label: string }) {
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
        <span className="slider-value">{label} {value[0].toFixed(1)}</span>
        <span className="slider-meta">{((value[1] - value[0]) / STEP) + 1} levels</span>
        <span className="slider-value">{label} {value[1].toFixed(1)}</span>
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
            Pickleball
          </button>
          <button
            className={"pill" + (filters.sport === "Tennis" ? " active" : "")}
            onClick={() => setSport("Tennis")}
          >
            Tennis
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
          label={ratingLabel(filters.sport)}
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
            <span className="badge skill">{ratingLabel(player.sport)} {player.ntrp}</span>
            <span className="badge sport">{player.sport}</span>
            {player.altSport && (
              <span className="badge sport" title={`Also plays ${player.altSport.sport}`}>
                + {player.altSport.sport} {ratingLabel(player.altSport.sport)} {player.altSport.ntrp}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="meta-list">
        <div className="meta-row">
          <Icon name="pin" size={16} />
          {player.distance && player.distance !== "—" ? (
            <>
              <span className="dist">{player.distance} mi</span>
              {player.location && (
                <>
                  <span style={{ color: "var(--text-low)" }}>·</span>
                  <span>{player.location}</span>
                </>
              )}
            </>
          ) : (
            <span>{player.location || "Distance unknown"}</span>
          )}
        </div>
        <div className="meta-row">
          <Icon name="calendar" size={16} />
          <b>{player.availability}</b>
        </div>
      </div>

      <div
        className="ai-box"
        title="Score = rating closeness + same primary sport + proximity (≤2 mi) + availability overlap"
      >
        <div className="ai-ico"><Icon name="sparkles" size={14} stroke={2.4} /></div>
        <div className="ai-content">
          <div className="ai-label">
            AI Match
            <span className="ai-score" tabIndex={0}>
              · {player.matchScore}% fit
            </span>
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
  const { show } = useToast();
  const { user: authUser } = useAuth();
  const createSession = useCreateSession();
  const [filters, setFilters] = useState({
    sport: "Pickleball",
    ntrp: [3.0, 4.0],
    time: "Any time",
  });
  const myRatingLabel = ratingLabel(authUser?.primarySport ?? filters.sport);
  const myRating = authUser?.ntrp ?? "3.5";
  const [requested, setRequested] = useState(new Set());
  const [saved, setSaved] = useState(new Set());
  const [sort, setSort] = useState("match");

  /* ---- Real backend matches via /api/players ----
     Falls back to the local demo data below when the backend
     is unreachable or returns no rows (e.g. you haven't seeded yet). */
  const {
    data: apiData,
    isLoading: apiLoading,
    isError: apiError,
  } = usePlayers({
    sport: filters.sport,
    ntrpMin: filters.ntrp[0],
    ntrpMax: filters.ntrp[1],
  });
  const liveMatches = apiData?.players?.length ? apiData.players : null;
  const dataSource: "live" | "demo" = liveMatches ? "live" : "demo";

  const visiblePlayers = useMemo(() => {
    /* Live (API) branch — backend already filtered + scored. */
    if (liveMatches) {
      const projected = liveMatches.map((p) => {
        const activeKey = filters.sport === "Pickleball" ? "pickleball" : "tennis";
        const otherKey = activeKey === "pickleball" ? "tennis" : "pickleball";
        const otherSportLabel = activeKey === "pickleball" ? "Tennis" : "Pickleball";
        const altProf = (p as any)[otherKey];
        return {
          id: p.id,
          name: p.name,
          initials: p.initials,
          color: p.color,
          fg: p.fg,
          online: p.online,
          location: p.location,
          distance: p.distance,
          sport: filters.sport,
          ntrp: p.ntrp,
          availability: p.availability,
          matchScore: p.matchScore,
          reason: p.reason,
          altSport: altProf ? { sport: otherSportLabel, ntrp: altProf.ntrp } : null,
        };
      });
      if (sort === "distance") projected.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
      else if (sort === "skill") projected.sort((a, b) => parseFloat(b.ntrp) - parseFloat(a.ntrp));
      else projected.sort((a, b) => b.matchScore - a.matchScore);
      return projected;
    }

    /* Demo branch — rich local seed data for when backend isn't running. */
    const activeKey = filters.sport === "Pickleball" ? "pickleball" : "tennis";
    const otherKey = activeKey === "pickleball" ? "tennis" : "pickleball";
    const otherSportLabel = activeKey === "pickleball" ? "Tennis" : "Pickleball";

    const projected = PLAYERS
      .filter((p) => p[activeKey])
      .map((p) => {
        const prof = p[activeKey];
        const alt = p[otherKey]
          ? { sport: otherSportLabel, ntrp: p[otherKey].ntrp }
          : null;
        return {
          id: p.id,
          name: p.name,
          initials: p.initials,
          color: p.color,
          fg: p.fg,
          online: p.online,
          location: p.location,
          distance: p.distance,
          sport: filters.sport,
          ntrp: prof.ntrp,
          availability: prof.availability,
          matchScore: prof.matchScore,
          reason: prof.reason,
          altSport: alt,
        };
      })
      .filter((p) => {
        const n = parseFloat(p.ntrp);
        return n >= filters.ntrp[0] && n <= filters.ntrp[1];
      });

    if (sort === "match") projected.sort((a, b) => b.matchScore - a.matchScore);
    else if (sort === "distance") projected.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    else if (sort === "skill") projected.sort((a, b) => parseFloat(b.ntrp) - parseFloat(a.ntrp));
    return projected;
  }, [liveMatches, filters.sport, filters.ntrp, sort]);

  const toggle = (set, setter) => (id) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  /* Send a real game request to the backend if we're on live data.
     Falls back to local "requested" state for the demo dataset. */
  const handleRequest = (id: number) => {
    // Default proposed time: tomorrow 6 PM local
    const dt = new Date();
    dt.setDate(dt.getDate() + 1);
    dt.setHours(18, 0, 0, 0);

    if (dataSource === "live") {
      createSession.mutate(
        { guestId: id, sport: filters.sport as any, scheduledAt: dt.toISOString() },
        {
          onSuccess: () => {
            setRequested((prev) => new Set(prev).add(id));
            show("Request sent — they'll see it in their Sessions tab", "success");
          },
          onError: (err: any) => {
            show(err?.message || "Couldn't send request", "error");
          },
        }
      );
    } else {
      // demo mode — local toggle only
      toggle(requested, setRequested)(id);
      show("Request sent (demo)", "success");
    }
  };

  return (
    <>
      <TopNav active="find" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="dot" />
              {apiLoading
                ? "Loading live matches…"
                : dataSource === "live"
                  ? `Live · backend AI matched ${liveMatches!.length} player${liveMatches!.length === 1 ? "" : "s"}`
                  : `Demo · ${PLAYERS.filter((p) => p.online).length} players online`}
            </div>
            <h1 className="h1">Find your next <em>rally partner.</em></h1>
            <p className="sub">
              Matched on skill, schedule, and court proximity across Chicago. Powered by your play history.
            </p>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="n">12</div>
              <div className="l">Matches Played</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="n">{myRating}</div>
              <div className="l">Your {myRatingLabel}</div>
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
            <span className="results-count">
              {visiblePlayers.length} found {dataSource === "live" ? "via backend" : "in Chicago (demo)"}
              {apiError && " · backend offline, showing demo"}
            </span>
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
          {apiLoading && !liveMatches
            ? Array.from({ length: 6 }).map((_, i) => <PlayerCardSkeleton key={i} />)
            : visiblePlayers.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  requested={requested.has(p.id)}
                  saved={saved.has(p.id)}
                  onRequest={handleRequest}
                  onSave={toggle(saved, setSaved)}
                />
              ))}
        </div>
      </main>
    </>
  );
}

export default FindPartnerPage;
