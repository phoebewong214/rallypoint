import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopNav, Icon } from "../rally-shared";
import { authApi } from "../api/auth";
import { Spinner } from "../components/Skeleton";

/* Landing page for the link in the password-reset email:
   /reset-password?token=<jwt> */
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const validate = (): string => {
    if (password.length < 8) return "Use at least 8 characters.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      return "Use a mix of letters and numbers.";
    if (password !== confirm) return "Passwords don't match.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "This reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <TopNav hideUser hideLinks />
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-brand">
              <img src="/logo.png" alt="RallyPoint" className="auth-logo-img" />
              <h1 className="auth-title">Set a new <em>password.</em></h1>
              <p className="auth-sub">Choose a strong password you don't use elsewhere.</p>
            </div>

            {!token ? (
              <p role="alert" className="form-grid" style={{ color: "var(--rose)", fontWeight: 600 }}>
                This reset link is missing its token. Request a new one from the sign-in page.
              </p>
            ) : done ? (
              <div className="form-grid">
                <p role="status" aria-live="polite" style={{
                  color: "var(--green)", background: "var(--green-ghost, rgba(48,164,108,0.12))",
                  border: "1px solid rgba(48,164,108,0.32)", borderRadius: 8,
                  padding: "12px 14px", fontSize: 14, fontWeight: 600, margin: 0,
                }}>
                  <Icon name="check" size={14} stroke={3} /> Password updated. You've been signed
                  out of all devices — sign in with your new password.
                </p>
                <button className="btn-primary full lg" onClick={() => navigate("/", { replace: true })}>
                  Go to sign in
                  <Icon name="chevron-r" size={16} stroke={2.5} />
                </button>
              </div>
            ) : (
              <form className="form-grid" onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label className="field-label" htmlFor="password"><Icon name="lock" size={13} /> New password</label>
                  <div className="input-with-icon">
                    <span className="leading"><Icon name="lock" size={16} /></span>
                    <input
                      id="password"
                      name="password"
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="input has-trailing"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="input-eye"
                      onClick={() => setShowPwd((s) => !s)}
                      aria-label={showPwd ? "Hide password" : "Show password"}
                      aria-pressed={showPwd}
                    >
                      <Icon name={showPwd ? "eye-off" : "eye"} size={16} />
                    </button>
                  </div>
                  <span className="meta-hint">Use 8+ chars with letters & numbers.</span>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="confirm"><Icon name="lock" size={13} /> Confirm password</label>
                  <div className="input-with-icon">
                    <span className="leading"><Icon name="lock" size={16} /></span>
                    <input
                      id="confirm"
                      name="confirm"
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      className="input"
                      placeholder="Re-enter password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" aria-live="assertive" style={{
                    color: "var(--rose)", background: "var(--rose-ghost)",
                    border: "1px solid rgba(229,72,77,0.32)", borderRadius: 8,
                    padding: "8px 12px", fontSize: 13, fontWeight: 600, margin: 0,
                  }}>
                    {error}
                  </p>
                )}

                <button type="submit" disabled={submitting} className="btn-primary full lg"
                  style={{ marginTop: 6, opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? (<><Spinner /> Updating…</>) : (<>Update password <Icon name="chevron-r" size={16} stroke={2.5} /></>)}
                </button>
              </form>
            )}

            <div className="auth-foot">
              <button onClick={() => navigate("/", { replace: true })}>Back to sign in</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ResetPasswordPage;
