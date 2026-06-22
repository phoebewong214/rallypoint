import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TopNav, Icon, ratingLabel } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useSessions } from "../hooks/useSessions";
import { useCourts } from "../hooks/useCourts";
import { useSavedPlayers, useToggleSavedPlayer } from "../hooks/useSavedPlayers";
import { Spinner } from "../components/Skeleton";
import type { Sport } from "../types";

const RATINGS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
const AVAIL_BANDS = ["MORN", "AFT", "EVE"];
const AVAIL_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Schedule tab — weekly calendar grid (rows = eight 2-hour slots 6 AM–8 PM).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SCHED_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_SLOTS = ["6 AM", "8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM"];

/* Monday-based start-of-week, normalized to midnight. */
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/* Snap an hour to the nearest of the eight 2-hour slots (6,8,…,20), clamped 0–7. */
function hourToSlot(h: number): number {
  return Math.max(0, Math.min(7, Math.round((h - 6) / 2)));
}

interface EditForm {
  name: string;
  bio: string;
  location: string;
  primarySport: "Tennis" | "Pickleball";
  primaryNtrp: string;
  alsoPlay: boolean;
  secondaryNtrp: string;
}

interface EditModalProps {
  initial: EditForm;
  onClose: () => void;
  onSave: (patch: {
    name: string; bio: string; location: string;
    primarySport: "Tennis" | "Pickleball";
    sportProfiles: { sport: "Tennis" | "Pickleball"; ntrp: string }[];
  }) => Promise<void>;
}

function EditProfileModal({ initial, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof EditForm) => (e: any) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }));
  const otherSport: "Tennis" | "Pickleball" = form.primarySport === "Tennis" ? "Pickleball" : "Tennis";

  const handleSave = async () => {
    setSaving(true);
    try {
      const sportProfiles = [{ sport: form.primarySport, ntrp: form.primaryNtrp }];
      if (form.alsoPlay) sportProfiles.push({ sport: otherSport, ntrp: form.secondaryNtrp });
      await onSave({ name: form.name, bio: form.bio, location: form.location, primarySport: form.primarySport, sportProfiles });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Edit profile</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label"><Icon name="user" size={13} /> Name</label>
            <input className="input" value={form.name} onChange={set("name")} />
          </div>
          <div className="field">
            <label className="field-label"><Icon name="pin" size={13} /> Location</label>
            <input className="input" value={form.location} onChange={set("location")} placeholder="Chicago, IL" />
          </div>
          <div className="field">
            <label className="field-label"><Icon name="trophy" size={13} /> Primary Sport</label>
            <div className="pill-group" role="radiogroup">
              <button type="button" className={"pill" + (form.primarySport === "Pickleball" ? " active" : "")} onClick={() => set("primarySport")("Pickleball")}>Pickleball</button>
              <button type="button" className={"pill" + (form.primarySport === "Tennis" ? " active" : "")} onClick={() => set("primarySport")("Tennis")}>Tennis</button>
            </div>
          </div>
          <div className="field">
            <label className="field-label"><Icon name="bolt" size={13} /> {ratingLabel(form.primarySport)} ({form.primarySport})</label>
            <div className="select">
              <select value={form.primaryNtrp} onChange={set("primaryNtrp")}>
                {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="select-caret"><Icon name="chevron" size={16} /></span>
            </div>
          </div>
          <div className="field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.alsoPlay} onChange={(e) => set("alsoPlay")(e.target.checked)} />
              <span>I also play {otherSport}</span>
            </label>
          </div>
          {form.alsoPlay && (
            <div className="field">
              <label className="field-label"><Icon name="sparkles" size={13} /> {ratingLabel(otherSport)} ({otherSport})</label>
              <div className="select">
                <select value={form.secondaryNtrp} onChange={set("secondaryNtrp")}>
                  {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="select-caret"><Icon name="chevron" size={16} /></span>
              </div>
            </div>
          )}
          <div className="field">
            <label className="field-label"><Icon name="edit" size={13} /> Bio</label>
            <textarea className="textarea" value={form.bio} onChange={set("bio")} placeholder="Tell other players a bit about your game…" maxLength={1000} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner /> Saving…</> : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user: authUser, updateProfile } = useAuth();
  const { show } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  // Tabs: ?tab=schedule deep-links to the week view; Overview is the default.
  const [params, setParams] = useSearchParams();
  const tab: "overview" | "schedule" = params.get("tab") === "schedule" ? "schedule" : "overview";
  const setTab = (t: "overview" | "schedule") =>
    setParams(t === "schedule" ? { tab: "schedule" } : {}, { replace: true });
  const [weekOffset, setWeekOffset] = useState(0);

  const sportProfiles = authUser?.sportProfiles ?? [];
  const primarySport = (authUser?.primarySport as Sport | undefined) ?? sportProfiles[0]?.sport;
  const primaryProfile = sportProfiles.find((p) => p.sport === primarySport) ?? sportProfiles[0];
  const otherProfiles = sportProfiles.filter((p) => p.sport !== primaryProfile?.sport);

  // Collaboration record — derived from real sessions, never any score.
  const { data: sessionsData } = useSessions();
  const sessions = sessionsData?.sessions ?? [];
  const statsReady = !!sessionsData;
  const gamesPlayed = sessions.filter((s) => s.bucket === "past" && s.status !== "cancelled").length;
  const partners = new Set(sessions.filter((s) => s.status !== "cancelled").map((s: any) => s.oppId).filter(Boolean)).size;
  const upcoming = sessions.filter((s) => s.bucket === "upcoming").length;
  // Timetable: upcoming soonest-first, then recent past (no scores anywhere).
  const upcomingGames = sessions
    .filter((s) => s.bucket === "upcoming" && s.status !== "cancelled")
    .slice().reverse().slice(0, 6);
  const recentGames = sessions.filter((s) => s.bucket === "past" && s.status !== "cancelled").slice(0, 6);

  // Schedule tab — a real weekly calendar grid, placed by each session's scheduledAt.
  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekEnd = addDays(weekStart, 6);
  const weekDays = useMemo(
    () => SCHED_DAYS.map((label, i) => {
      const d = addDays(weekStart, i);
      return { label, date: d.getDate(), isToday: weekOffset === 0 && sameDate(d, new Date()) };
    }),
    [weekStart, weekOffset],
  );
  const weekRange = weekStart.getMonth() === weekEnd.getMonth()
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}`
    : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
  // Bucket non-cancelled, scheduled sessions into {col,row} cells for the visible week.
  const weekBlocks = useMemo(() => {
    const cells: Record<string, any[]> = {};
    const end = addDays(weekStart, 7);
    sessions.forEach((s: any) => {
      if (!s.scheduledAt || s.status === "cancelled") return;
      const d = new Date(s.scheduledAt);
      if (d < weekStart || d >= end) return;
      const col = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
      const row = hourToSlot(d.getHours());
      (cells[`${col}-${row}`] ??= []).push(s);
    });
    return cells;
  }, [sessions, weekStart]);
  const weekBlockCount = Object.values(weekBlocks).reduce((n, a) => n + a.length, 0);
  // Pending/requested games have no time yet — surface them so they aren't lost.
  const unscheduledCount = sessions.filter((s: any) => !s.scheduledAt && s.status !== "cancelled").length;
  // Tab badge: games scheduled in the real current week.
  const thisWeekCount = useMemo(() => {
    const ws = startOfWeek(new Date());
    const we = addDays(ws, 7);
    return sessions.filter((s: any) => s.scheduledAt && s.status !== "cancelled" && new Date(s.scheduledAt) >= ws && new Date(s.scheduledAt) < we).length;
  }, [sessions]);

  // Preferred times — real, editable weekly grid (AvailabilitySlot).
  const availMap = useMemo(() => {
    const m: Record<string, number> = {};
    (authUser?.availability ?? []).forEach((a) => { m[`${a.timeBand}-${a.dayOfWeek}`] = a.status; });
    return m;
  }, [authUser?.availability]);
  const [editAvail, setEditAvail] = useState(false);
  const [availDraft, setAvailDraft] = useState<Record<string, number>>({});
  const [savingAvail, setSavingAvail] = useState(false);
  const availGrid = editAvail ? availDraft : availMap;
  const startEditAvail = () => { setAvailDraft({ ...availMap }); setEditAvail(true); };
  const cycleCell = (key: string) => setAvailDraft((d) => ({ ...d, [key]: (((d[key] ?? 0) + 1) % 3) }));
  const saveAvail = async () => {
    setSavingAvail(true);
    const availability = AVAIL_BANDS.flatMap((band) =>
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({ dayOfWeek: day, timeBand: band, status: availDraft[`${band}-${day}`] ?? 0 })),
    );
    try {
      await updateProfile({ availability });
      setEditAvail(false);
      show("Availability updated", "success");
    } catch (err: any) {
      show(err?.message || "Couldn't save availability", "error");
    } finally {
      setSavingAvail(false);
    }
  };

  // Favorite courts — real, from CourtFavorite.
  const { data: courtsData } = useCourts({});
  const favCourts = (courtsData?.courts ?? []).filter((c) => c.fav);

  // Saved players — real, from the backend.
  const { data: savedData } = useSavedPlayers();
  const savedPlayers = savedData?.players ?? [];
  const toggleSaved = useToggleSavedPlayer();

  const handleSave = async (patch: Parameters<EditModalProps["onSave"]>[0]) => {
    try {
      await updateProfile(patch);
      setEditOpen(false);
      show("Profile updated", "success");
    } catch (err: any) {
      show(err?.message || "Couldn't save profile", "error");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/profile");
      show("Profile link copied to clipboard", "success");
    } catch {
      show("Couldn't copy link", "error");
    }
  };

  const stat = (v: number) => (statsReady ? v : "—");

  return (
    <>
      <TopNav />
      <main className="page">
        {/* Hero */}
        <section className="profile-hero">
          <div className="cover" />
          <div className="hero-body">
            <div className="hero-avatar-wrap">
              <div className="hero-avatar"
                style={authUser?.avatarColor ? { background: authUser.avatarColor, color: authUser.avatarFg || "#fff" } : undefined}>
                {authUser?.initials ?? "P"}
              </div>
            </div>

            <div className="hero-info">
              <h1 className="hero-name">{authUser?.name ?? "Player"}</h1>
              <div className="hero-meta">
                <span>{authUser?.handle ?? "@player"}</span>
                {authUser?.location && (<><span className="dot" /><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="pin" size={13} /> {authUser.location}</span></>)}
                {authUser?.joined && (<><span className="dot" /><span>Joined {authUser.joined}</span></>)}
              </div>
              <div className="hero-badges">
                {primaryProfile ? (
                  <>
                    <span className="badge skill">{ratingLabel(primaryProfile.sport)} {primaryProfile.ntrp}</span>
                    <span className="badge">{primaryProfile.sport}</span>
                  </>
                ) : primarySport ? (
                  <span className="badge">{primarySport}</span>
                ) : null}
                {otherProfiles.map((p) => (
                  <span key={p.sport} className="badge sport">{p.sport} · {ratingLabel(p.sport)} {p.ntrp}</span>
                ))}
              </div>
            </div>

            <div className="hero-actions">
              <button className="btn-ghost" type="button" onClick={handleShare}><Icon name="share" size={15} /> Share</button>
              <button className="btn-primary" type="button" onClick={() => setEditOpen(true)}><Icon name="edit" size={15} stroke={2.4} /> Edit Profile</button>
            </div>
          </div>
        </section>

        {/* Tabs: Overview (profile) · Schedule (real weekly calendar) */}
        <div className="tab-bar" role="tablist" aria-label="Profile view">
          <button type="button" role="tab" id="overview-tab" aria-selected={tab === "overview"} aria-controls="overview-panel"
            className={"tab" + (tab === "overview" ? " active" : "")} onClick={() => setTab("overview")}>
            <Icon name="user" size={15} /> Overview
          </button>
          <button type="button" role="tab" id="schedule-tab" aria-selected={tab === "schedule"} aria-controls="schedule-panel"
            className={"tab" + (tab === "schedule" ? " active" : "")} onClick={() => setTab("schedule")}>
            <Icon name="calendar" size={15} /> Schedule
            {thisWeekCount > 0 && <span className="tab-count">{thisWeekCount}</span>}
          </button>
        </div>

        {tab === "overview" && (
        <div role="tabpanel" id="overview-panel" aria-labelledby="overview-tab">
        {/* Collaboration record (no scores — RallyPoint only makes the intro) */}
        <section className="stats-row">
          <div className="stat-card accent">
            <span className="label">Games Played</span>
            <span className="value">{stat(gamesPlayed)}</span>
            <span className="sub">arranged via RallyPoint</span>
          </div>
          <div className="stat-card">
            <span className="label">Partners</span>
            <span className="value">{stat(partners)}</span>
            <span className="sub">people you've played</span>
          </div>
          <div className="stat-card">
            <span className="label">Upcoming</span>
            <span className="value">{stat(upcoming)}</span>
            <span className="sub">games on the calendar</span>
          </div>
        </section>

        {/* Body grid */}
        <section className="body-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* About */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico"><Icon name="user" size={15} /></span> About</h2>
                <button className="panel-action" type="button" onClick={() => setEditOpen(true)}><Icon name="edit" size={13} /> Edit</button>
              </div>
              {authUser?.bio
                ? <p className="bio">{authUser.bio}</p>
                : <p className="bio" style={{ color: "var(--text-dim)" }}>No bio yet — tap Edit to tell other players about your game.</p>}
            </div>

            {/* Your games — timetable (upcoming + recent, no scores) */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico green"><Icon name="calendar" size={15} /></span> Your games</h2>
                <Link className="panel-action" to="/sessions">View all <Icon name="chevron-r" size={13} /></Link>
              </div>
              {upcomingGames.length === 0 && recentGames.length === 0 ? (
                <div className="empty" style={{ padding: "28px 20px" }}>
                  <p className="empty-sub" style={{ margin: 0 }}>No games yet. <Link to="/find" style={{ color: "var(--green-deep)", fontWeight: 600 }}>Find a partner →</Link></p>
                </div>
              ) : (
                <>
                  {upcomingGames.length > 0 && (
                    <>
                      <div className="agenda-label">Upcoming</div>
                      <div className="recent-list">
                        {upcomingGames.map((m: any) => (
                          <div key={m.id} className="recent-game">
                            <div style={{ minWidth: 0 }}>
                              <p className="rg-opp">{m.opp ? `with ${m.opp}` : "Game"}</p>
                              <span className="rg-meta">{m.sport}{m.court ? ` · ${m.court}` : ""}{m.time ? ` · ${m.time}` : ""}</span>
                            </div>
                            <div className="rg-date rg-upcoming">{m.weekday}, {m.month} {m.day}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {recentGames.length > 0 && (
                    <>
                      <div className="agenda-label">Recent</div>
                      <div className="recent-list">
                        {recentGames.map((m: any) => (
                          <div key={m.id} className="recent-game">
                            <div style={{ minWidth: 0 }}>
                              <p className="rg-opp">{m.opp ? `with ${m.opp}` : "Game"}</p>
                              <span className="rg-meta">{m.sport}{m.court ? ` · ${m.court}` : ""}</span>
                            </div>
                            <div className="rg-date">{m.weekday}, {m.month} {m.day}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Preferences */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico blue"><Icon name="settings" size={15} /></span> Preferences</h2>
                <button className="panel-action" type="button" onClick={() => setEditOpen(true)}><Icon name="edit" size={13} /> Edit</button>
              </div>
              <div className="info-list">
                <div className="info-row">
                  <span className="ico green"><Icon name="trophy" size={16} /></span>
                  <div><div className="label">Primary Sport</div><div className="value">{primaryProfile?.sport ?? primarySport ?? "—"}</div></div>
                </div>
                {primaryProfile && (
                  <div className="info-row">
                    <span className="ico green"><Icon name="bolt" size={16} /></span>
                    <div><div className="label">Skill Level</div><div className="value value-mono">{ratingLabel(primaryProfile.sport)} {primaryProfile.ntrp}</div></div>
                  </div>
                )}
                {otherProfiles.map((p) => (
                  <div className="info-row" key={p.sport}>
                    <span className="ico"><Icon name="sparkles" size={16} /></span>
                    <div><div className="label">Also plays</div><div className="value">{p.sport} · {ratingLabel(p.sport)} {p.ntrp}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preferred times — editable weekly grid */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico green"><Icon name="clock" size={15} /></span> Preferred times</h2>
                {editAvail ? (
                  <button className="panel-action" type="button" onClick={saveAvail} disabled={savingAvail}>
                    {savingAvail ? "Saving…" : "Save"}
                  </button>
                ) : (
                  <button className="panel-action" type="button" onClick={startEditAvail}><Icon name="edit" size={13} /> Edit</button>
                )}
              </div>
              <div className="avail-wrap" role="grid" aria-label="Weekly availability">
                <div className="avail-label-col" />
                <div className="avail-grid">
                  {AVAIL_DAYS.map((d, i) => <div key={i} className="avail-cell day-label">{d}</div>)}
                </div>
                {AVAIL_BANDS.map((band) => (
                  <React.Fragment key={band}>
                    <div className="avail-label-col">{band}</div>
                    <div className="avail-grid">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const key = `${band}-${day}`;
                        const v = availGrid[key] ?? 0;
                        return (
                          <div
                            key={day}
                            className={"avail-cell " + (v === 2 ? "on" : v === 1 ? "half" : "") + (editAvail ? " editable" : "")}
                            title={v === 2 ? "Available" : v === 1 ? "Maybe" : "Unavailable"}
                            role={editAvail ? "button" : undefined}
                            tabIndex={editAvail ? 0 : undefined}
                            onClick={editAvail ? () => cycleCell(key) : undefined}
                            onKeyDown={editAvail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycleCell(key); } } : undefined}
                          />
                        );
                      })}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: "var(--text-low)", fontWeight: 600 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--green)", borderRadius: 3 }} /> Available</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--green-soft)", border: "1px solid var(--green)", borderRadius: 3 }} /> Maybe</span>
                {editAvail && <span style={{ marginLeft: "auto" }}>Tap cells to cycle</span>}
              </div>
            </div>

            {/* Saved players */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico green"><Icon name="users" size={15} /></span> Saved players</h2>
                <Link className="panel-action" to="/find">Find <Icon name="chevron-r" size={13} /></Link>
              </div>
              {savedPlayers.length === 0 ? (
                <p className="empty-sub" style={{ margin: "4px 0 0" }}>No saved players yet. Tap the bookmark on a partner in <Link to="/find" style={{ color: "var(--green-deep)", fontWeight: 600 }}>Find a partner →</Link></p>
              ) : (
                <div className="saved-player-list">
                  {savedPlayers.map((p) => (
                    <div key={p.id} className="saved-player">
                      <span className="avatar-chip" style={{ background: p.color || "var(--bg-3)" }}>{p.initials}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="sp-name">{p.name}</div>
                        <div className="sp-meta">{p.sports.join(" · ") || p.primarySport}</div>
                      </div>
                      <button
                        className="btn-sm icon-only"
                        type="button"
                        aria-label={`Remove ${p.name} from saved`}
                        onClick={() => toggleSaved.mutate({ id: p.id, saved: false })}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Favorite courts */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico blue"><Icon name="bookmark" size={15} /></span> Favorite courts</h2>
                <Link className="panel-action" to="/courts">Browse <Icon name="chevron-r" size={13} /></Link>
              </div>
              {favCourts.length === 0 ? (
                <p className="empty-sub" style={{ margin: "4px 0 0" }}>No saved courts yet. <Link to="/courts" style={{ color: "var(--green-deep)", fontWeight: 600 }}>Find courts →</Link></p>
              ) : (
                <div className="fav-court-list">
                  {favCourts.map((c) => (
                    <Link key={c.id} to={`/courts/${encodeURIComponent(c.id)}`} className="fav-court">
                      <span className="fav-court-name">{c.name}</span>
                      <span className="fav-court-meta">{c.distance != null ? `${c.distance} mi` : c.sports.join(" · ")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
        </div>
        )}

        {tab === "schedule" && (
          <div className="panel" id="schedule-panel" role="tabpanel" aria-labelledby="schedule-tab">
            <div className="panel-head">
              <h2 className="panel-title"><span className="ico green"><Icon name="calendar" size={15} /></span> Week of {weekRange}</h2>
              <div className="week-nav-controls">
                <button className="week-nav-btn" type="button" title="Previous week" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
                  <Icon name="chevron-r" size={14} style={{ transform: "rotate(180deg)" }} />
                </button>
                <button className="btn-sm ghost" type="button" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0} style={{ opacity: weekOffset === 0 ? 0.5 : 1 }}>Today</button>
                <button className="week-nav-btn" type="button" title="Next week" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
                  <Icon name="chevron-r" size={14} />
                </button>
              </div>
            </div>

            <div className="sched-grid">
              <div className="sched-corner" style={{ gridColumn: 1, gridRow: 1 }} />
              {weekDays.map((d, ci) => (
                <div key={ci} className={"sched-day-head" + (d.isToday ? " today" : "")} style={{ gridColumn: ci + 2, gridRow: 1 }}>
                  <span className="day-name">{d.label}</span>
                  <span className="day-num">{d.date}</span>
                </div>
              ))}
              {TIME_SLOTS.map((slot, ri) => (
                <React.Fragment key={ri}>
                  <div className="sched-time" style={{ gridColumn: 1, gridRow: ri + 2 }}>{slot}</div>
                  {weekDays.map((d, ci) => (
                    <div key={ci} className={"sched-cell" + (d.isToday ? " today-col" : "")} style={{ gridColumn: ci + 2, gridRow: ri + 2 }} />
                  ))}
                </React.Fragment>
              ))}
              {Object.entries(weekBlocks).map(([key, arr]) => {
                const [col, row] = key.split("-").map(Number);
                const s: any = arr[0];
                const extra = arr.length - 1;
                return (
                  <Link key={key} to="/sessions" className={"sched-block " + s.sport.toLowerCase() + (s.next ? " next" : "")} style={{ gridColumn: col + 2, gridRow: row + 2 }}>
                    <div className="sched-block-top">
                      <div className="sched-block-sport">
                        <span className="sb-dot" />{s.sport}
                        {s.oppNtrp && <span className="sb-lvl">{ratingLabel(s.sport)} {s.oppNtrp}</span>}
                      </div>
                      <div className="sched-block-title">{s.opp ? `with ${s.opp}` : "Open game"}{extra > 0 ? ` +${extra} more` : ""}</div>
                    </div>
                    <div className="sched-block-foot">
                      {s.court ? (
                        <span className="sched-block-meta"><Icon name="pin" size={9} /><span className="sb-court">{s.court}</span></span>
                      ) : (
                        <span className="sched-block-meta sb-nocourt">No court set</span>
                      )}
                      <span className="sched-block-time">{s.time}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {sessionsData && weekBlockCount === 0 && (
              <p className="empty-sub" style={{ textAlign: "center", margin: "14px 0 2px" }}>
                No games this week — <Link to="/find" style={{ color: "var(--green-deep)", fontWeight: 600 }}>Find a partner →</Link>
              </p>
            )}

            <div className="sched-legend">
              <span className="lgi"><span className="sw pickleball" /> Pickleball</span>
              <span className="lgi"><span className="sw tennis" /> Tennis</span>
              <Link to="/find" className="lgi" style={{ marginLeft: "auto", color: "var(--green-deep)", fontWeight: 600 }}>
                <Icon name="plus" size={13} /> Find a partner
              </Link>
            </div>

            {unscheduledCount > 0 && (
              <p className="empty-sub" style={{ margin: "12px 0 0" }}>
                {unscheduledCount} unscheduled {unscheduledCount === 1 ? "request" : "requests"} — <Link to="/sessions" style={{ color: "var(--green-deep)", fontWeight: 600 }}>review in My Games →</Link>
              </p>
            )}
          </div>
        )}
      </main>

      {editOpen && (
        <EditProfileModal
          initial={{
            name: authUser?.name ?? "",
            bio: authUser?.bio ?? "",
            location: authUser?.location ?? "",
            primarySport: (primarySport as "Tennis" | "Pickleball") ?? "Pickleball",
            primaryNtrp: primaryProfile?.ntrp ?? "3.5",
            alsoPlay: otherProfiles.length > 0,
            secondaryNtrp: otherProfiles[0]?.ntrp ?? "3.5",
          }}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

export default ProfilePage;
