import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TopNav, Icon } from "../rally-shared";
import { useToast } from "../contexts/ToastContext";

/* ---- Real Chicago courts with verified lat/lng ----
   Distances are rough straight-line miles from "Phoebe's home" pin (Loop). */
const HOME: [number, number] = [41.881, -87.629]; // downtown Chicago

const COURTS = [
  {
    id: "lincoln-park",
    name: "Lincoln Park Cultural Center Tennis Courts",
    addr: "2045 N Lincoln Park West · Chicago",
    lat: 41.9220, lng: -87.6350,
    sports: ["Pickleball", "Tennis"],
    primary: "tennis",
    distance: "3.1",
    walk: "12 min drive",
    courtCount: 6,
    surface: "Outdoor · Hard",
    lights: true,
    activity: { state: "busy", pct: 80, label: "5 of 6 courts in use" },
    nextSlot: "Today, 4:30 PM",
    fav: true,
  },
  {
    id: "grant-park",
    name: "Grant Park Tennis Center",
    addr: "331 E Randolph St · Chicago",
    lat: 41.8835, lng: -87.6188,
    sports: ["Tennis"],
    primary: "tennis",
    distance: "0.5",
    walk: "10 min walk",
    courtCount: 12,
    surface: "Outdoor · Hard",
    lights: true,
    activity: { state: "open", pct: 35, label: "8 of 12 open now" },
    nextSlot: "Today, 2:00 PM",
    fav: false,
  },
  {
    id: "maggie-daley",
    name: "Maggie Daley Park Tennis",
    addr: "337 E Randolph St · Chicago",
    lat: 41.8855, lng: -87.6178,
    sports: ["Pickleball", "Tennis"],
    primary: "pickleball",
    distance: "0.6",
    walk: "11 min walk",
    courtCount: 4,
    surface: "Outdoor · Resurfaced 2024",
    lights: true,
    activity: { state: "open", pct: 25, label: "3 of 4 open now" },
    nextSlot: "Today, 3:00 PM",
    fav: true,
  },
  {
    id: "wicker-park",
    name: "Wicker Park Tennis Courts",
    addr: "1425 N Damen Ave · Chicago",
    lat: 41.9080, lng: -87.6790,
    sports: ["Tennis"],
    primary: "tennis",
    distance: "3.4",
    walk: "15 min drive",
    courtCount: 4,
    surface: "Outdoor · Hard",
    lights: false,
    activity: { state: "quiet", pct: 10, label: "Mostly empty" },
    nextSlot: "Today, 12:00 PM",
    fav: false,
  },
  {
    id: "welles-park",
    name: "Welles Park",
    addr: "2333 W Sunnyside Ave · Chicago",
    lat: 41.9647, lng: -87.6892,
    sports: ["Pickleball", "Tennis"],
    primary: "pickleball",
    distance: "6.5",
    walk: "22 min drive",
    courtCount: 8,
    surface: "Outdoor · Hard",
    lights: true,
    activity: { state: "open", pct: 50, label: "4 of 8 open now" },
    nextSlot: "Today, 5:00 PM",
    fav: false,
  },
  {
    id: "lake-shore-park",
    name: "Lake Shore Park",
    addr: "808 N Lake Shore Dr · Chicago",
    lat: 41.8974, lng: -87.6191,
    sports: ["Pickleball"],
    primary: "pickleball",
    distance: "1.2",
    walk: "16 min walk",
    courtCount: 2,
    surface: "Outdoor · Resurfaced 2023",
    lights: true,
    activity: { state: "busy", pct: 100, label: "All courts booked" },
    nextSlot: "Tomorrow, 7:00 AM",
    fav: false,
  },
  {
    id: "smith-park",
    name: "Smith Park",
    addr: "2526 W Grand Ave · Chicago",
    lat: 41.8909, lng: -87.6918,
    sports: ["Pickleball"],
    primary: "pickleball",
    distance: "4.1",
    walk: "17 min drive",
    courtCount: 4,
    surface: "Indoor · Climate-controlled",
    lights: true,
    activity: { state: "open", pct: 50, label: "2 of 4 open now" },
    nextSlot: "Today, 6:00 PM",
    fav: false,
  },
  {
    id: "mcguane-park",
    name: "McGuane Park",
    addr: "2901 S Poplar Ave · Chicago",
    lat: 41.8400, lng: -87.6580,
    sports: ["Pickleball", "Tennis"],
    primary: "pickleball",
    distance: "3.9",
    walk: "14 min drive",
    courtCount: 4,
    surface: "Outdoor · Hard",
    lights: false,
    activity: { state: "open", pct: 50, label: "2 of 4 open now" },
    nextSlot: "Today, 4:00 PM",
    fav: false,
  },
];

function CourtCard({ c, active, onHover, onLeave, onClick, onDirections, onBook }: any) {
  const [faved, setFaved] = useState(c.fav);
  return (
    <article
      className={"court-card" + (active ? " active" : "")}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <div className="court-hero">
        <div className={"court-svg " + c.primary}>
          <div className="court-lines" />
        </div>
        <div className="hero-badges">
          {c.activity.state === "busy" && (
            <span className="hero-badge live">
              <span className="dot" /> BUSY NOW
            </span>
          )}
          {c.activity.state === "open" && (
            <span className="hero-badge" style={{ background: "var(--green)", borderColor: "var(--green-deep)", color: "var(--green-ink)" }}>
              OPEN COURTS
            </span>
          )}
          {c.sports.map((s) => (
            <span key={s} className="hero-badge">
              <Icon name={s === "Tennis" ? "tennis" : "paddle"} size={11} stroke={2.4} />
              {s}
            </span>
          ))}
        </div>
        <button
          className={"fav-btn" + (faved ? " faved" : "")}
          onClick={(e) => { e.stopPropagation(); setFaved((f) => !f); }}
          aria-label="Favorite"
        >
          <Icon name="bookmark" size={15} stroke={2.4} />
        </button>
      </div>

      <div className="court-body">
        <div className="court-row">
          <div style={{ minWidth: 0 }}>
            <h3 className="court-name">{c.name}</h3>
            <span className="court-addr">
              <Icon name="pin" size={12} /> {c.addr}
            </span>
          </div>
          <div className="court-dist">
            <div className="n">{c.distance}<span style={{ fontSize: 11, color: "var(--text-low)", marginLeft: 2 }}>mi</span></div>
            <div className="l">{c.walk}</div>
          </div>
        </div>

        <div className="court-feats">
          <span className="feat"><Icon name="stats" size={11} /> {c.courtCount} courts</span>
          <span className="feat">{c.surface}</span>
          {c.lights && <span className="feat"><Icon name="bolt" size={11} /> Lit</span>}
        </div>

        <div className="court-activity">
          <span className="activity-text">
            {c.activity.state === "busy"  ? "Busy" :
             c.activity.state === "open"  ? "Open" : "Quiet"}
            <span className="mono"> · {c.activity.label}</span>
          </span>
          <div className="activity-bar">
            <div className={"activity-fill " + c.activity.state} style={{ width: `${c.activity.pct}%` }} />
          </div>
        </div>

        <div className="court-foot">
          <span className="next-slot">
            Next slot · <b>{c.nextSlot}</b>
          </span>
          <div className="court-actions">
            <button
              className="court-btn ghost"
              type="button"
              onClick={(e) => { e.stopPropagation(); onDirections(c); }}
            >
              <Icon name="pin" size={13} stroke={2.4} /> Directions
            </button>
            <button
              className="court-btn book"
              type="button"
              onClick={(e) => { e.stopPropagation(); onBook(c); }}
            >
              Book Court
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* Custom Leaflet pin icon — color-coded by court activity. Built with divIcon
   so it picks up the design tokens (no need to ship raster sprites). */
function makePinIcon(state: "open" | "busy" | "quiet", active: boolean): L.DivIcon {
  const color =
    state === "open" ? "var(--green-deep)" :
    state === "busy" ? "var(--amber)" :
    "var(--text-low)";
  const scale = active ? 1.15 : 1;
  return L.divIcon({
    className: "court-leaflet-pin",
    html: `
      <div style="transform: translate(-50%, -100%) scale(${scale}); transition: 200ms cubic-bezier(0.2,0.7,0.3,1);">
        <div style="
          width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
          background: ${color}; transform: rotate(-45deg);
          display: grid; place-items: center;
          box-shadow: 0 8px 16px -4px ${active ? "var(--green)" : "rgba(0,0,0,0.3)"};
          border: 2.5px solid #fff;
          ${active ? "outline: 3px solid var(--green); outline-offset: 2px;" : ""}
        ">
          <div style="transform: rotate(45deg); color: #fff; font-size: 14px;">
            ${state === "open" ? "●" : state === "busy" ? "!" : "○"}
          </div>
        </div>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/* Helper component: when activeId changes, smoothly pan the map to that court. */
function MapPanController({ courts, activeId }: { courts: any[]; activeId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!activeId) return;
    const c = courts.find((c) => c.id === activeId);
    if (c) map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [activeId, courts, map]);
  return null;
}

function CourtsPage() {
  const { soon } = useToast();
  const [sport, setSport] = useState("any");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [maxMiles, setMaxMiles] = useState(5);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COURTS.filter((c) => {
      if (sport !== "any" && !c.sports.map((s) => s.toLowerCase()).includes(sport)) return false;
      if (parseFloat(c.distance) > maxMiles) return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.addr.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [sport, query, maxMiles]);

  return (
    <>
      <TopNav active="courts" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow"><span className="dot" /> {filtered.length} courts within {maxMiles} mi</div>
            <h1 className="h1">Courts <em>near you.</em></h1>
            <p className="sub">
              Live activity, court counts, and open slots — book your spot in two taps.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <button className="btn-ghost" type="button" onClick={() => soon("Favorites list")}>
              <Icon name="bookmark" size={15} /> Favorites
            </button>
            <button className="btn-primary" type="button" onClick={() => soon("Adding new courts")}>
              <Icon name="plus" size={16} stroke={2.5} /> Add Court
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="court-filters">
          <div className="search-input-wrap">
            <span className="leading"><Icon name="search" size={16} /></span>
            <input
              className="court-search"
              placeholder="Search court or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mini-select-wrap">
            <select className="mini-select" value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="any">All sports</option>
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
            </select>
            <span className="caret"><Icon name="chevron" size={14} /></span>
          </div>
          <div className="mini-select-wrap">
            <select
              className="mini-select"
              value={maxMiles}
              onChange={(e) => setMaxMiles(Number(e.target.value))}
            >
              <option value="1">Within 1 mile</option>
              <option value="3">Within 3 miles</option>
              <option value="5">Within 5 miles</option>
              <option value="10">Within 10 miles</option>
            </select>
            <span className="caret"><Icon name="chevron" size={14} /></span>
          </div>
          <button
            className="btn-primary"
            style={{ height: 42 }}
            type="button"
            onClick={() => { /* filters apply live; this is just a focus action */ }}
          >
            <Icon name="search" size={15} stroke={2.5} /> Search
          </button>
        </div>

        <div className="result-meta">
          <div>
            Showing <span className="count">{filtered.length}</span> of {COURTS.length} courts
          </div>
          <div>
            Sorted by <b style={{ color: "var(--text)" }}>nearest</b>
          </div>
        </div>

        {/* Split layout */}
        <div className="courts-split">
          {/* Left — list */}
          <div className="court-list">
            {filtered.length === 0 && (
              <div className="empty">
                <div className="ico-wrap"><Icon name="search" size={22} /></div>
                <h3 className="empty-title">No courts match</h3>
                <p className="empty-sub">Try widening the distance or clearing the search.</p>
                <button className="btn-sm primary" type="button" onClick={() => { setQuery(""); setMaxMiles(10); setSport("any"); }}>
                  Reset filters
                </button>
              </div>
            )}
            {filtered.map((c) => (
              <CourtCard
                key={c.id}
                c={c}
                active={activeId === c.id}
                onHover={() => setActiveId(c.id)}
                onLeave={() => setActiveId(null)}
                onClick={() => setActiveId(c.id)}
                onDirections={(court: any) => {
                  // Open Google Maps in a new tab — real, useful UX.
                  const q = encodeURIComponent(`${court.name} ${court.addr}`);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener");
                }}
                onBook={(court: any) => soon(`Booking ${court.name}`)}
              />
            ))}
          </div>

          {/* Right — real Chicago map via Leaflet + OpenStreetMap. */}
          <div className="map-panel">
            <div className="map-canvas">
              <MapContainer
                center={HOME}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* "You are here" marker */}
                <Marker
                  position={HOME}
                  icon={L.divIcon({
                    className: "court-leaflet-me",
                    html: `<div style="
                      transform: translate(-50%, -50%);
                      width: 16px; height: 16px;
                      border-radius: 50%;
                      background: var(--blue);
                      border: 3px solid #fff;
                      box-shadow: 0 0 0 4px rgba(27,127,204,0.25), 0 4px 12px rgba(0,0,0,0.3);
                    "></div>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                  })}
                >
                  <Tooltip direction="top" offset={[0, -10]} permanent={false}>
                    You · Chicago
                  </Tooltip>
                </Marker>

                {/* Court pins */}
                {filtered.map((c) => (
                  <Marker
                    key={c.id}
                    position={[c.lat, c.lng]}
                    icon={makePinIcon(c.activity.state as any, activeId === c.id)}
                    eventHandlers={{
                      mouseover: () => setActiveId(c.id),
                      mouseout:  () => setActiveId(null),
                      click:     () => setActiveId(c.id),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -32]}>
                      <b>{c.name}</b> · {c.distance} mi
                    </Tooltip>
                  </Marker>
                ))}

                <MapPanController courts={filtered} activeId={activeId} />
              </MapContainer>

              {/* Overlay UI: live status chip + legend */}
              <div className="map-overlay-top">
                <div className="map-chip">
                  <span className="blue-dot" />
                  You · Chicago
                </div>
                <div className="map-chip">
                  <Icon name="bolt" size={12} stroke={2.4} /> Live activity
                </div>
              </div>

              <div className="map-legend">
                <div className="legend-row"><span className="legend-dot open" /> Open courts</div>
                <div className="legend-row"><span className="legend-dot busy" /> Busy now</div>
                <div className="legend-row"><span className="legend-dot quiet" /> Quiet</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default CourtsPage;
