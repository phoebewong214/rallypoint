import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { TopNav, Icon } from "../rally-shared";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Skeleton } from "../components/Skeleton";
import { AppointmentModal } from "../components/AppointmentModal";
import {
  useCourtDetail, useCreateAppointment, useJoinAppointment,
  useLeaveAppointment, useCancelAppointment, useCheckIn, useCheckOut,
} from "../hooks/useCourtDetail";
import { useToggleCourtFavorite } from "../hooks/useCourts";
import type { Appointment } from "../api/appointments";

function whenLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Avatars({ players }: { players: { initials: string; color: string | null }[] }) {
  return (
    <span className="avatar-stack">
      {players.map((p, i) => (
        <span key={i} className="avatar-chip" style={{ background: p.color || "var(--bg-3)", marginLeft: i ? -8 : 0 }}>{p.initials}</span>
      ))}
    </span>
  );
}

function ApptCard({ a, onJoin, onLeave, onCancel, busy }: {
  a: Appointment;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  onCancel: (id: number) => void;
  busy: boolean;
}) {
  return (
    <article className="appt-card">
      <div className="appt-main">
        <div className="appt-when">
          <Icon name="calendar" size={14} /> {whenLabel(a.scheduledAt)}
          <span className="appt-sport">{a.sport}</span>
        </div>
        <div className="appt-meta">
          <Avatars players={a.players} />
          <span className="appt-count">
            {a.confirmedCount}/{a.maxPlayers} in
            {a.waitlistCount > 0 && <span className="appt-wait"> · {a.waitlistCount} waiting</span>}
          </span>
        </div>
        {a.host && <div className="appt-host">Hosted by {a.host}{a.note ? ` · "${a.note}"` : ""}</div>}
      </div>
      <div className="appt-action">
        {a.isHost ? (
          <button className="btn-sm danger" type="button" disabled={busy} onClick={() => onCancel(a.id)}>Cancel</button>
        ) : a.joined ? (
          <button className="btn-sm ghost" type="button" disabled={busy} onClick={() => onLeave(a.id)}>Leave</button>
        ) : a.waitlisted ? (
          <div style={{ textAlign: "right" }}>
            <div className="appt-queue">Waitlisted · #{a.queuePosition}</div>
            <button className="btn-sm ghost" type="button" disabled={busy} onClick={() => onLeave(a.id)}>Leave queue</button>
          </div>
        ) : a.spotsLeft > 0 ? (
          <button className="btn-sm primary" type="button" disabled={busy} onClick={() => onJoin(a.id)}>
            <Icon name="check" size={14} stroke={2.5} /> Join
          </button>
        ) : (
          <button className="btn-sm ghost" type="button" disabled={busy} onClick={() => onJoin(a.id)}>Join waitlist</button>
        )}
      </div>
    </article>
  );
}

function CourtDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { show } = useToast();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useCourtDetail(slug);
  const court = data?.court;

  const create = useCreateAppointment(slug!);
  const join = useJoinAppointment(slug!);
  const leave = useLeaveAppointment(slug!);
  const cancel = useCancelAppointment(slug!);
  const checkIn = useCheckIn(slug!);
  const checkOut = useCheckOut(slug!);
  const toggleFav = useToggleCourtFavorite();
  const [showModal, setShowModal] = useState(false);

  const busy = join.isPending || leave.isPending || cancel.isPending;

  const onCheckInToggle = () => {
    if (court?.checkedIn) {
      checkOut.mutate(undefined, { onSuccess: () => show("Checked out", "success") });
      return;
    }
    const coords = typeof user?.lat === "number" && typeof user?.lng === "number"
      ? { lat: user.lat, lng: user.lng } : undefined;
    checkIn.mutate(coords, {
      onSuccess: () => show("Checked in — others can see the court's busy 🎾", "success"),
      onError: (e: any) => show(e?.message || "Couldn't check in", "error"),
    });
  };

  const directions = () => {
    if (!court) return;
    const q = encodeURIComponent(`${court.name} ${court.addr ?? ""}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener");
  };

  const busyText = (n: number) => (n >= 4 ? "Busy now" : n >= 1 ? "Some activity" : "Quiet right now");

  return (
    <>
      <TopNav active="courts" />
      <main className="page">
        <Link to="/courts" className="back-link"><Icon name="chevron" size={16} /> All courts</Link>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
            <Skeleton width="50%" height={30} />
            <Skeleton width="80%" height={16} />
            <Skeleton width="100%" height={120} radius={14} />
          </div>
        ) : isError || !court ? (
          <div className="empty">
            <div className="ico-wrap"><Icon name="bolt" size={22} /></div>
            <h3 className="empty-title">Couldn't load this court</h3>
            <button className="btn-primary" type="button" onClick={() => refetch()}>
              <Icon name="bolt" size={15} stroke={2.4} /> Retry
            </button>
          </div>
        ) : (
          <>
            <header className="page-head">
              <div>
                <div className={"eyebrow"}>
                  <span className="dot" style={{ background: court.hereNow >= 1 ? "var(--green)" : "var(--text-low)" }} />
                  {busyText(court.hereNow)}{court.hereNow > 0 ? ` · ${court.hereNow} here now` : ""}
                </div>
                <h1 className="h1" style={{ marginBottom: 6 }}>{court.name}</h1>
                {court.addr && <p className="sub"><Icon name="pin" size={13} /> {court.addr}{court.distance != null ? ` · ${court.distance} mi away` : ""}</p>}
              </div>
              <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
                <button className={"btn-ghost" + (court.fav ? " active" : "")} type="button"
                  aria-pressed={court.fav}
                  onClick={() => toggleFav.mutate({ slug: court.id, fav: !court.fav })}>
                  <Icon name="bookmark" size={15} /> {court.fav ? "Saved" : "Save"}
                </button>
                <button className="btn-ghost" type="button" onClick={directions}><Icon name="pin" size={15} /> Directions</button>
              </div>
            </header>

            <div className="court-feats" style={{ marginBottom: 18 }}>
              {court.sports.map((s) => <span key={s} className="feat">{s}</span>)}
              {court.courtCount ? <span className="feat"><Icon name="stats" size={11} /> {court.courtCount} courts</span> : null}
              {court.surface ? <span className="feat">{court.surface}</span> : null}
              {court.lights && <span className="feat"><Icon name="bolt" size={11} /> Lit</span>}
            </div>

            {/* Check in */}
            <div className="checkin-bar">
              <div>
                <strong>{busyText(court.hereNow)}</strong>
                <div className="checkin-sub">{court.hereNow} {court.hereNow === 1 ? "person is" : "people are"} checked in here right now</div>
              </div>
              <button
                className={court.checkedIn ? "btn-sm ghost" : "btn-sm primary"}
                type="button"
                disabled={checkIn.isPending || checkOut.isPending}
                onClick={onCheckInToggle}
              >
                {court.checkedIn ? "✓ Checked in — tap to leave" : "I'm here now"}
              </button>
            </div>

            {/* Open games */}
            <div className="section-head" style={{ marginTop: 22 }}>
              <h2 className="section-title">Open games <span className="count">{court.appointments.length}</span></h2>
              <button className="btn-primary" type="button" onClick={() => setShowModal(true)}>
                <Icon name="plus" size={16} stroke={2.5} /> Make an appointment
              </button>
            </div>

            {court.appointments.length === 0 ? (
              <div className="empty" style={{ padding: "36px 24px" }}>
                <div className="ico-wrap"><Icon name="calendar" size={22} /></div>
                <h3 className="empty-title">No open games yet</h3>
                <p className="empty-sub">Post one and players nearby can join — first one breaks the ice.</p>
              </div>
            ) : (
              <div className="appt-list">
                {court.appointments.map((a) => (
                  <ApptCard key={a.id} a={a} busy={busy}
                    onJoin={(id) => join.mutate(id, { onSuccess: (r) => show(r.appointment.waitlisted ? `Added to the waitlist · #${r.appointment.queuePosition}` : "You're in 🎾", "success") })}
                    onLeave={(id) => leave.mutate(id, { onSuccess: () => show("Left the game", "success") })}
                    onCancel={(id) => cancel.mutate(id, { onSuccess: () => show("Game cancelled", "success") })}
                  />
                ))}
              </div>
            )}

            {/* Who plays here */}
            {court.regularsCount > 0 && (
              <div style={{ marginTop: 26 }}>
                <div className="section-head"><h2 className="section-title">Who plays here <span className="count">{court.regularsCount}</span></h2></div>
                <Link to={`/find?court=${encodeURIComponent(court.id)}&courtName=${encodeURIComponent(court.name)}`} className="court-social" style={{ marginTop: 4 }}>
                  <Avatars players={court.regulars} />
                  <span>{court.regularsCount} {court.regularsCount === 1 ? "player calls" : "players call"} this home — find a partner</span>
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {showModal && court && (
        <AppointmentModal
          courtName={court.name}
          sports={court.sports}
          defaultSport={court.primary === "tennis" ? "Tennis" : "Pickleball"}
          busy={create.isPending}
          onSubmit={(body) => create.mutate(body, {
            onSuccess: () => { setShowModal(false); show("Open game posted 🎾", "success"); },
            onError: (e: any) => show(e?.message || "Couldn't post", "error"),
          })}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default CourtDetailPage;
