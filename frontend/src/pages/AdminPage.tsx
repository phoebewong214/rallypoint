import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TopNav } from "../rally-shared";
import { useToast } from "../contexts/ToastContext";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Skeleton";
import { adminApi } from "../api/admin";
import type { AdminStats, AdminUser, AdminUserPatch } from "../api/admin";
import { ApiError } from "../api/client";

const RATINGS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
const PER_PAGE = 25;

/* ---- Dashboard stat cards ---- */
const StatCard: React.FC<{ label: string; value: number | string; hint?: string }> = ({ label, value, hint }) => (
  <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
    <div className="field-label" style={{ letterSpacing: "0.1em" }}>{label}</div>
    {hint && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{hint}</div>}
  </div>
);

/* ---- Edit-user modal ---- */
interface EditState {
  name: string;
  email: string;
  handle: string;
  emailVerified: boolean;
  location: string;
  primarySport: "Tennis" | "Pickleball";
  primaryNtrp: string;
  bio: string;
}

function fromUser(u: AdminUser): EditState {
  const primarySport = (u.primarySport as "Tennis" | "Pickleball") || "Pickleball";
  const prof = (u.sportProfiles || []).find((p) => p.sport === primarySport);
  return {
    name: u.name || "",
    email: u.email || "",
    handle: u.handle || "",
    emailVerified: !!u.emailVerified,
    location: u.location || "",
    primarySport,
    primaryNtrp: prof?.ntrp || "3.5",
    bio: u.bio || "",
  };
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<EditState>(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof EditState) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e?.target?.type === "checkbox" ? e.target.checked : (e?.target?.value ?? e) }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Rebuild the full sportProfiles set so we never drop the user's other
      // sport: keep every existing profile, update the primary's NTRP, and make
      // sure a profile exists for the (possibly changed) primary sport.
      const existing = user.sportProfiles || [];
      const profiles = existing.map((p) => ({
        sport: p.sport,
        ntrp: p.sport === form.primarySport ? form.primaryNtrp : p.ntrp,
        homeCourt: p.homeCourt ?? undefined,
        availabilitySummary: p.availability ?? undefined,
      }));
      if (!profiles.some((p) => p.sport === form.primarySport)) {
        profiles.push({ sport: form.primarySport, ntrp: form.primaryNtrp, homeCourt: undefined, availabilitySummary: undefined });
      }

      const patch: AdminUserPatch = {
        name: form.name.trim(),
        email: form.email.trim(),
        handle: form.handle.trim(),
        emailVerified: form.emailVerified,
        location: form.location.trim(),
        primarySport: form.primarySport,
        bio: form.bio,
        sportProfiles: profiles,
      };
      const { user: updated } = await adminApi.updateUser(user.id, patch);
      show("User updated", "success");
      onSaved(updated);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save changes";
      show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal ariaLabel={`Edit ${user.name}`} onClose={onClose} onSubmit={handleSave} maxWidth={460}>
      <h3 style={{ margin: 0 }}>Edit user</h3>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: -8 }}>
        ID {user.id} · joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
      </div>

      <div className="field">
        <label className="field-label">Name</label>
        <input className="input" value={form.name} onChange={set("name")} />
      </div>

      <div className="field">
        <label className="field-label">Email</label>
        <input className="input" type="email" value={form.email} onChange={set("email")} />
      </div>

      <div className="field">
        <label className="field-label">Handle</label>
        <input className="input" value={form.handle} onChange={set("handle")} placeholder="@handle" />
      </div>

      <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={form.emailVerified} onChange={set("emailVerified")} />
        <span>Email verified</span>
      </label>

      <div className="field">
        <label className="field-label">Location</label>
        <input className="input" value={form.location} onChange={set("location")} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Primary sport</label>
          <select className="input" value={form.primarySport} onChange={set("primarySport")}>
            <option value="Pickleball">Pickleball</option>
            <option value="Tennis">Tennis</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Rating (NTRP/DUPR)</label>
          <select className="input" value={form.primaryNtrp} onChange={set("primaryNtrp")}>
            {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Bio</label>
        <textarea className="input textarea" rows={3} value={form.bio} onChange={set("bio")} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </Modal>
  );
}

/* ---- Page ---- */
const AdminPage: React.FC = () => {
  const { show } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  // Debounce the search box so each keystroke doesn't fire a request.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadStats = useCallback(() => {
    adminApi.stats().then(setStats).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    adminApi
      .listUsers({ q: debouncedQ, page, perPage: PER_PAGE })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
        setPages(res.pages);
      })
      .catch((err) => show(err instanceof ApiError ? err.message : "Failed to load users", "error"))
      .finally(() => setLoading(false));
  }, [debouncedQ, page, show]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onSaved = (updated: AdminUser) => {
    setUsers((arr) => arr.map((u) => (u.id === updated.id ? updated : u)));
    setEditing(null);
    loadStats(); // verified-count etc. may have changed
  };

  const statCards = useMemo(() => {
    if (!stats) return null;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 32 }}>
        <StatCard label="Users" value={stats.users.total} hint={`${stats.users.real} real · ${stats.users.demo} demo`} />
        <StatCard label="Verified" value={stats.users.verified} hint={`${stats.users.total - stats.users.verified} unverified`} />
        <StatCard label="New (7d)" value={stats.users.new7d} hint={`${stats.users.new30d} in 30d`} />
        <StatCard label="Admins" value={stats.users.admins} />
        <StatCard label="Invites" value={stats.invites} />
        <StatCard label="Appointments" value={stats.appointments} />
        <StatCard label="Courts" value={stats.courts} />
      </div>
    );
  }, [stats]);

  return (
    <>
      <TopNav active="admin" />
      <main className="page">
        <div className="eyebrow"><span className="dot" />ADMIN</div>
        <h1 style={{ marginTop: 8, marginBottom: 24 }}>Dashboard</h1>

        {statCards}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Users {total > 0 && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({total})</span>}</h2>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search name, email or @handle…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Spinner /></div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>No users found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Sport</th>
                    <th style={th}>Status</th>
                    <th style={th}>Joined</th>
                    <th style={{ ...th, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const prof = (u.sportProfiles || []).find((p) => p.sport === u.primarySport);
                    return (
                      <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{u.handle}</div>
                        </td>
                        <td style={td}>{u.email}</td>
                        <td style={td}>
                          {u.primarySport ? `${u.primarySport}${prof ? ` · ${prof.ntrp}` : ""}` : "—"}
                        </td>
                        <td style={td}>
                          <span style={badge(u.emailVerified ? "ok" : "warn")}>
                            {u.emailVerified ? "Verified" : "Unverified"}
                          </span>
                          {u.isAdmin && <span style={{ ...badge("admin"), marginLeft: 6 }}>Admin</span>}
                        </td>
                        <td style={{ ...td, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : u.joined || "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button className="btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 18 }}>
            <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Page {page} / {pages}</span>
            <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
          </div>
        )}
      </main>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </>
  );
};

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

function badge(kind: "ok" | "warn" | "admin"): React.CSSProperties {
  const map = {
    ok: { color: "var(--green-deep)", border: "1px solid var(--green-deep)" },
    warn: { color: "var(--text-dim)", border: "1px solid var(--border)" },
    admin: { color: "var(--accent, #6366f1)", border: "1px solid var(--accent, #6366f1)" },
  } as const;
  return {
    display: "inline-block", padding: "2px 8px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, ...map[kind],
  };
}

export default AdminPage;
