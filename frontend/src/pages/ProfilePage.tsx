import React, { useState } from "react";
import { TopNav, Icon, ratingLabel } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Spinner } from "../components/Skeleton";

/* Bio + stats stay as placeholders until /api/users/me is wired up. */
const PROFILE_EXTRAS = {
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
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Edit profile</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label"><Icon name="user" size={13} /> Name</label>
            <input className="input" value={form.name} onChange={set("name")} />
          </div>
          <div className="field">
            <label className="field-label"><Icon name="pin" size={13} /> Location</label>
            <input className="input" value={form.location} onChange={set("location")} placeholder="Berkeley, CA" />
          </div>
          <div className="field">
            <label className="field-label"><Icon name="trophy" size={13} /> Primary Sport</label>
            <div className="pill-group" role="tablist">
              <button
                type="button"
                className={"pill" + (form.primarySport === "Pickleball" ? " active" : "")}
                onClick={() => set("primarySport")("Pickleball")}
              >
                Pickleball
              </button>
              <button
                type="button"
                className={"pill" + (form.primarySport === "Tennis" ? " active" : "")}
                onClick={() => set("primarySport")("Tennis")}
              >
                Tennis
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label"><Icon name="edit" size={13} /> Bio</label>
            <textarea
              className="textarea"
              value={form.bio}
              onChange={set("bio")}
              placeholder="Tell other players a bit about your game…"
              maxLength={1000}
            />
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
  // eslint-disable-next-line no-unused-vars
  const [tab, setTab] = useState("matches");
  const [editOpen, setEditOpen] = useState(false);
  const [localBio, setLocalBio] = useState<string | null>(null);

  /* Merge live auth user with placeholder bio/stats. */
  const USER = {
    name: authUser?.name ?? "Player",
    initials: authUser?.initials ?? "P",
    handle: authUser?.handle ?? "@player",
    ntrp: authUser?.ntrp ?? "3.5",
    primarySport: authUser?.primarySport ?? "Pickleball",
    secondarySport: authUser?.secondarySport ?? "Tennis",
    location: authUser?.location ?? "Berkeley, CA",
    joined: authUser?.joined ?? "Jan 2025",
    ...PROFILE_EXTRAS,
    bio: localBio ?? (authUser as any)?.bio ?? PROFILE_EXTRAS.bio,
  };

  const handleSave = async (patch: { name: string; bio: string; location: string; primarySport: "Tennis" | "Pickleball" }) => {
    try {
      await updateProfile(patch);
      setLocalBio(patch.bio);
      setEditOpen(false);
      show("Profile updated", "success");
    } catch (err: any) {
      show(err?.message || "Couldn't save profile", "error");
    }
  };

  const handleShare = async () => {
    const url = window.location.origin + "/profile";
    try {
      await navigator.clipboard.writeText(url);
      show("Profile link copied to clipboard", "success");
    } catch {
      show("Couldn't copy link", "error");
    }
  };

  return (
    <>
      <TopNav />

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
                <span className="badge skill">{ratingLabel(USER.primarySport)} {USER.ntrp}</span>
                <span className="badge">{USER.primarySport}</span>
                <span className="badge sport">{USER.secondarySport}</span>
                <span className="badge blue"><Icon name="flame" size={11} /> {USER.stats.streak}-win streak</span>
              </div>
            </div>

            <div className="hero-actions">
              <button className="btn-ghost" type="button" onClick={handleShare}>
                <Icon name="share" size={15} /> Share
              </button>
              <button className="btn-primary" type="button" onClick={() => setEditOpen(true)}>
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
                <button className="panel-action" type="button" onClick={() => setEditOpen(true)}>
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
                <button
                  className="panel-action"
                  type="button"
                  onClick={() => { window.location.href = "/sessions"; }}
                >
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
                  <span className="ico green"><Icon name="trophy" size={16} /></span>
                  <div>
                    <div className="label">Primary Sport</div>
                    <div className="value">{USER.primarySport}</div>
                  </div>
                </div>
                <div className="info-row">
                  <span className="ico"><Icon name="sparkles" size={16} /></span>
                  <div>
                    <div className="label">Also plays</div>
                    <div className="value">{USER.secondarySport}</div>
                  </div>
                </div>
                <div className="info-row">
                  <span className="ico green"><Icon name="bolt" size={16} /></span>
                  <div>
                    <div className="label">Skill Level</div>
                    <div className="value value-mono">{ratingLabel(USER.primarySport)} {USER.ntrp}</div>
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
                <button className="panel-action" type="button" onClick={() => setEditOpen(true)}>
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

      {editOpen && (
        <EditProfileModal
          initial={{
            name: USER.name,
            bio: USER.bio,
            location: USER.location,
            primarySport: USER.primarySport as "Tennis" | "Pickleball",
          }}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

export default ProfilePage;
