import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav, Icon } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth";
import { Spinner } from "../components/Skeleton";

/* Interstitial shown after signup until the user verifies their email.
   ProtectedRoute redirects unverified users here. */
function VerifyPendingPage() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");

  const resend = async () => {
    setBusy(true);
    setNote("");
    try {
      await authApi.resendVerification();
      setResent(true);
    } catch (e: any) {
      setNote(e?.message || "Couldn't resend right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  const checkVerified = async () => {
    setChecking(true);
    setNote("");
    const fresh = await refreshUser();
    setChecking(false);
    if (fresh?.emailVerified) navigate("/find", { replace: true });
    else setNote("Not verified yet — click the link in your email, then try again.");
  };

  return (
    <>
      <TopNav hideUser hideLinks />
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-brand">
              <img src="/logo.png" alt="RallyPoint" className="auth-logo-img" />
              <h1 className="auth-title">Check your <em>inbox.</em></h1>
              <p className="auth-sub">
                We sent a verification link to{" "}
                <strong>{user?.email || "your email"}</strong>. Confirm it to start
                finding partners.
              </p>
            </div>

            <div className="form-grid">
              {resent && (
                <p role="status" aria-live="polite" style={{
                  color: "var(--green)", background: "var(--green-ghost, rgba(48,164,108,0.12))",
                  border: "1px solid rgba(48,164,108,0.32)", borderRadius: 8,
                  padding: "10px 12px", fontSize: 13, fontWeight: 600, margin: 0,
                }}>
                  <Icon name="check" size={13} stroke={3} /> Verification email re-sent.
                </p>
              )}
              {note && (
                <p role="alert" className="meta-hint" style={{ color: "var(--text)" }}>{note}</p>
              )}

              <button className="btn-primary full lg" onClick={checkVerified} disabled={checking}>
                {checking ? (<><Spinner /> Checking…</>) : (<>I've verified — continue <Icon name="chevron-r" size={16} stroke={2.5} /></>)}
              </button>

              <button className="social-btn" onClick={resend} disabled={busy} style={{ opacity: busy ? 0.7 : 1 }}>
                {busy ? "Sending…" : "Resend verification email"}
              </button>

              <span className="meta-hint">
                In local dev, no email is actually sent — the link is printed in the
                backend console (look for <code>[email:dev]</code>).
              </span>
            </div>

            <div className="auth-foot">
              <button onClick={() => { logout(); navigate("/", { replace: true }); }}>
                Use a different account
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default VerifyPendingPage;
