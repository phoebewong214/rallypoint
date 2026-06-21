import React, { useState } from "react";
import { Link } from "react-router-dom";
import { TopNav, Icon, ratingLabel } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useSessions } from "../hooks/useSessions";
import { useCourts } from "../hooks/useCourts";
import { Spinner } from "../components/Skeleton";
import type { Sport } from "../types";

interface EditModalProps {
  initial: { name: string; bio: string; location: string; primarySport: "Tennis" | "Pickleball" };
  onClose: () => void;
  onSave: (patch: EditModalProps["initial"]) => Promise<void>;
}

function EditProfileModal({ initial, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
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
  const recentGames = sessions.filter((s) => s.bucket === "past" && s.status !== "cancelled").slice(0, 6);

  // Favorite courts — real, from CourtFavorite.
  const { data: courtsData } = useCourts({});
  const favCourts = (courtsData?.courts ?? []).filter((c) => c.fav);

  const handleSave = async (patch: { name: string; bio: string; location: string; primarySport: "Tennis" | "Pickleball" }) => {
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

            {/* Recent games (no scores) */}
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title"><span className="ico green"><Icon name="calendar" size={15} /></span> Recent games</h2>
                <Link className="panel-action" to="/sessions">View all <Icon name="chevron-r" size={13} /></Link>
              </div>
              {recentGames.length === 0 ? (
                <div className="empty" style={{ padding: "28px 20px" }}>
                  <p className="empty-sub" style={{ margin: 0 }}>No games yet. <Link to="/find" style={{ color: "var(--green-deep)", fontWeight: 600 }}>Find a partner →</Link></p>
                </div>
              ) : (
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
      </main>

      {editOpen && (
        <EditProfileModal
          initial={{
            name: authUser?.name ?? "",
            bio: authUser?.bio ?? "",
            location: authUser?.location ?? "",
            primarySport: (primarySport as "Tennis" | "Pickleball") ?? "Pickleball",
          }}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

export default ProfilePage;
