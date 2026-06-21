import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TopNav, Icon } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { useCourts, useToggleCourtFavorite } from "../hooks/useCourts";
import type { ApiCourt } from "../api/courts";
import { Skeleton } from "../components/Skeleton";

/* Map tiles. Defaults to OpenStreetMap; override with VITE_MAP_TILE_URL to point
   at a keyed commercial provider in production. */
const TILE_URL =
  (import.meta as any).env?.VITE_MAP_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Fallback map center (downtown Chicago) only used until we can fit to real
// markers — never shown as "you are here".
const FALLBACK_CENTER: [number, number] = [41.8819, -87.6278];

/* Brand pin icons, built once (not per render) — color is constant; only the
   active state changes scale + ring. */
function buildPin(active: boolean): L.DivIcon {
  const scale = active ? 1.15 : 1;
  return L.divIcon({
    className: "court-leaflet-pin",
    html: `
      <div style="transform: translate(-50%, -100%) scale(${scale}); transition: 200ms cubic-bezier(0.2,0.7,0.3,1);">
        <div style="
          width: 30px; height: 30px; border-radius: 50% 50% 50% 0;
          background: var(--green-deep); transform: rotate(-45deg);
          display: grid; place-items: center;
          box-shadow: 0 8px 16px -4px ${active ? "var(--green)" : "rgba(0,0,0,0.3)"};
          border: 2.5px solid #fff;
          ${active ? "outline: 3px solid var(--green); outline-offset: 2px;" : ""}
        ">
          <div style="transform: rotate(45deg); color: var(--green-ink); font-size: 13px; font-weight: 800;">●</div>
        </div>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
const PIN = buildPin(false);
const PIN_ACTIVE = buildPin(true);
const ME_ICON = L.divIcon({
  className: "court-leaflet-me",
  html: `<div style="transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 50%; background: var(--blue); border: 3px solid #fff; box-shadow: 0 0 0 4px rgba(27,127,204,0.25), 0 4px 12px rgba(0,0,0,0.3);"></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const sportToParam = (primary: string) => (primary === "tennis" ? "Tennis" : "Pickleball");

function CourtCard({
  c, active, onActivate, onToggleFav, favBusy,
}: {
  c: ApiCourt;
  active: boolean;
  onActivate: (id: string) => void;
  onToggleFav: (c: ApiCourt) => void;
  favBusy: boolean;
}) {
  const directions = () => {
    const q = encodeURIComponent(`${c.name} ${c.addr}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener");
  };
  const findHref = `/find?sport=${sportToParam(c.primary)}&court=${encodeURIComponent(c.id)}&courtName=${encodeURIComponent(c.name)}`;
  return (
    <article
      className={"court-card" + (active ? " active" : "")}
      onClick={() => onActivate(c.id)}
      onFocusCapture={() => onActivate(c.id)}
    >
      <div className="court-hero">
        <div
          className="court-hero-image"
          style={{ backgroundImage: `url(/courts/${c.id}.jpg)` }}
          role="img"
          aria-label={c.name}
        />
        <div className="hero-badges">
          {c.sports.map((s) => (
            <span key={s} className="hero-badge">{s}</span>
          ))}
        </div>
        <button
          className={"fav-btn" + (c.fav ? " faved" : "")}
          onClick={(e) => { e.stopPropagation(); onToggleFav(c); }}
          disabled={favBusy}
          aria-pressed={c.fav}
          aria-label={c.fav ? "Saved — tap to remove" : "Save court"}
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
          {c.distance != null && (
            <div className="court-dist">
              <div className="n">{c.distance}<span style={{ fontSize: 11, color: "var(--text-low)", marginLeft: 2 }}>mi</span></div>
              <div className="l">away</div>
            </div>
          )}
        </div>

        <div className="court-feats">
          {c.courtCount ? <span className="feat"><Icon name="stats" size={11} /> {c.courtCount} courts</span> : null}
          {c.surface ? <span className="feat">{c.surface}</span> : null}
          {c.lights && <span className="feat"><Icon name="bolt" size={11} /> Lit</span>}
        </div>

        {(c.regularsCount > 0 || c.upcomingCount > 0) && (
          <Link to={findHref} onClick={(e) => e.stopPropagation()} className="court-social">
            {c.regularsCount > 0 && (
              <span className="court-regulars">
                <span className="avatar-stack">
                  {c.regulars.map((r, i) => (
                    <span
                      key={i}
                      className="avatar-chip"
                      style={{ background: r.color || "var(--bg-3)", marginLeft: i ? -8 : 0 }}
                    >
                      {r.initials}
                    </span>
                  ))}
                </span>
                {c.regularsCount} {c.regularsCount === 1 ? "player calls" : "players call"} this home
              </span>
            )}
            {c.upcomingCount > 0 && (
              <span className="court-upcoming">
                {c.regularsCount > 0 ? "· " : ""}{c.upcomingCount} game{c.upcomingCount === 1 ? "" : "s"} coming up
              </span>
            )}
          </Link>
        )}

        <div className="court-foot">
          <div className="court-actions" style={{ marginLeft: "auto" }}>
            <button className="court-btn ghost" type="button" onClick={(e) => { e.stopPropagation(); directions(); }}>
              <Icon name="pin" size={13} stroke={2.4} /> Directions
            </button>
            <Link
              className="court-btn book"
              to={findHref}
              onClick={(e) => e.stopPropagation()}
              style={{ textDecoration: "none" }}
            >
              <Icon name="search" size={13} stroke={2.4} /> Find partners
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/* Pan to a court when it becomes active (click/focus driven — not hover — so the
   map doesn't jitter as the mouse moves down the list). */
function MapPanController({ courts, activeId }: { courts: ApiCourt[]; activeId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!activeId) return;
    const c = courts.find((c) => c.id === activeId);
    if (c) map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [activeId, courts, map]);
  return null;
}

/* Fit the map to all markers once, the first time courts arrive — handles users
   with no saved coordinates (we show the whole court set instead of a wrong
   "near you" center). */
function FitToCourts({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    map.fitBounds(points, { padding: [44, 44], maxZoom: 14 });
  }, [points, map]);
  return null;
}

/* Leaflet renders blank if its container resizes after init (common in flex
   layouts). Nudge it on mount + on resize. */
function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 0);
    const ro = new ResizeObserver(fix);
    ro.observe(map.getContainer());
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [map]);
  return null;
}

function CourtsPage() {
  const { user } = useAuth();
  const home: [number, number] | null =
    typeof user?.lat === "number" && typeof user?.lng === "number"
      ? [user.lat, user.lng]
      : null;

  const [sport, setSport] = useState<"any" | "tennis" | "pickleball">("any");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [maxMiles, setMaxMiles] = useState(5);
  const [favesOnly, setFavesOnly] = useState(false);

  const { data, isLoading, isError, refetch } = useCourts(
    sport !== "any" ? { sport: sport === "tennis" ? "Tennis" : "Pickleball" } : {},
  );
  const toggleFav = useToggleCourtFavorite();

  const courts: ApiCourt[] = data?.courts ?? [];
  const hasDistances = courts.some((c) => c.distance != null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courts.filter((c) => {
      if (favesOnly && !c.fav) return false;
      if (hasDistances && c.distance != null && c.distance > maxMiles) return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.addr.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [courts, query, maxMiles, favesOnly, hasDistances]);

  const points = useMemo<[number, number][]>(() => {
    const pts = filtered.map((c) => [c.lat, c.lng] as [number, number]);
    if (home) pts.push(home);
    return pts;
  }, [filtered, home]);

  return (
    <>
      <TopNav active="courts" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="dot" />
              {isLoading
                ? "Loading courts…"
                : isError
                  ? "Couldn't reach the server"
                  : `${filtered.length} court${filtered.length === 1 ? "" : "s"}${hasDistances ? ` within ${maxMiles} mi` : ""}`}
            </div>
            <h1 className="h1">Courts <em>near you.</em></h1>
            <p className="sub">
              Find a place to play{home ? " near you" : ""}, then line up a partner.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <button
              className={"btn-ghost" + (favesOnly ? " active" : "")}
              type="button"
              aria-pressed={favesOnly}
              onClick={() => setFavesOnly((v) => !v)}
            >
              <Icon name="bookmark" size={15} /> {favesOnly ? "All courts" : "Favorites"}
            </button>
            <Link to="/find" className="btn-primary" style={{ textDecoration: "none" }}>
              <Icon name="search" size={16} stroke={2.5} /> Find a partner
            </Link>
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
              aria-label="Search courts"
            />
          </div>
          <div className="mini-select-wrap">
            <select className="mini-select" value={sport} onChange={(e) => setSport(e.target.value as any)} aria-label="Filter by sport">
              <option value="any">All sports</option>
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
            </select>
            <span className="caret"><Icon name="chevron" size={14} /></span>
          </div>
          {hasDistances && (
            <div className="mini-select-wrap">
              <select className="mini-select" value={maxMiles} onChange={(e) => setMaxMiles(Number(e.target.value))} aria-label="Filter by distance">
                <option value="1">Within 1 mile</option>
                <option value="3">Within 3 miles</option>
                <option value="5">Within 5 miles</option>
                <option value="10">Within 10 miles</option>
                <option value="50">Any distance</option>
              </select>
              <span className="caret"><Icon name="chevron" size={14} /></span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="courts-split">
            <div className="court-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <article className="court-card" key={i} aria-busy="true">
                  <Skeleton width="100%" height={150} radius={0} />
                  <div className="court-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Skeleton width="70%" height={18} />
                    <Skeleton width="50%" height={13} />
                    <Skeleton width="90%" height={13} />
                  </div>
                </article>
              ))}
            </div>
            <div className="map-panel"><Skeleton width="100%" height="100%" radius={0} /></div>
          </div>
        ) : isError ? (
          <div className="empty">
            <div className="ico-wrap"><Icon name="bolt" size={22} /></div>
            <h3 className="empty-title">Couldn't load courts</h3>
            <p className="empty-sub">Something went wrong reaching the server. Check your connection and try again.</p>
            <button className="btn-primary" type="button" onClick={() => refetch()}>
              <Icon name="bolt" size={15} stroke={2.4} /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="result-meta">
              <div>
                Showing <span className="count">{filtered.length}</span> of {courts.length} courts
              </div>
              {hasDistances && (
                <div>Sorted by <b style={{ color: "var(--text)" }}>nearest</b></div>
              )}
            </div>

            <div className="courts-split">
              {/* Left — list */}
              <div className="court-list">
                {filtered.length === 0 ? (
                  <div className="empty">
                    <div className="ico-wrap"><Icon name="search" size={22} /></div>
                    <h3 className="empty-title">{favesOnly ? "No saved courts yet" : "No courts match"}</h3>
                    <p className="empty-sub">
                      {favesOnly
                        ? "Tap the bookmark on a court to save it here."
                        : "Try widening the distance or clearing the search."}
                    </p>
                    <button
                      className="btn-sm primary"
                      type="button"
                      onClick={() => { setQuery(""); setMaxMiles(50); setSport("any"); setFavesOnly(false); }}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  filtered.map((c) => (
                    <CourtCard
                      key={c.id}
                      c={c}
                      active={activeId === c.id}
                      onActivate={setActiveId}
                      onToggleFav={(court) => toggleFav.mutate({ slug: court.id, fav: !court.fav })}
                      favBusy={toggleFav.isPending && toggleFav.variables?.slug === c.id}
                    />
                  ))
                )}
              </div>

              {/* Right — real map via Leaflet. */}
              <div className="map-panel">
                <div className="map-canvas">
                  <MapContainer
                    center={home ?? FALLBACK_CENTER}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom
                  >
                    <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
                    <MapResizeFix />
                    <FitToCourts points={points} />

                    {home && (
                      <Marker position={home} icon={ME_ICON}>
                        <Tooltip direction="top" offset={[0, -10]}>
                          {user?.location ? `You · ${user.location}` : "You are here"}
                        </Tooltip>
                      </Marker>
                    )}

                    {filtered.map((c) => (
                      <Marker
                        key={c.id}
                        position={[c.lat, c.lng]}
                        icon={activeId === c.id ? PIN_ACTIVE : PIN}
                        eventHandlers={{ click: () => setActiveId(c.id) }}
                      >
                        <Tooltip direction="top" offset={[0, -32]}>
                          <b>{c.name}</b>{c.distance != null ? ` · ${c.distance} mi` : ""}
                        </Tooltip>
                      </Marker>
                    ))}

                    <MapPanController courts={filtered} activeId={activeId} />
                  </MapContainer>

                  {home && (
                    <div className="map-overlay-top">
                      <div className="map-chip">
                        <span className="blue-dot" />
                        {user?.location ? `You · ${user.location}` : "You are here"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default CourtsPage;
