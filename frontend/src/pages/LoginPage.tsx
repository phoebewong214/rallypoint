import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav, Icon } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";

const NTRP_LEVELS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("signup"); // "signin" | "signup"
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    sport: "Pickleball",
    ntrp: "3.5",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }));

  const isSignup = mode === "signup";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || (isSignup && !form.name)) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup({
          name: form.name,
          email: form.email,
          password: form.password,
          sport: form.sport,
          ntrp: form.ntrp,
        });
      } else {
        await login(form.email, form.password);
      }
      navigate("/find", { replace: true });
    } catch (err) {
      setError(err?.message || "Something went wrong. Try again.");
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
              <div className="auth-status">
                <span className="dot" />
                247 players online
              </div>
              <div className="logo-mark">R</div>
              <h1 className="auth-title">
                {isSignup ? <>Join the <em>rally.</em></> : <>Welcome <em>back.</em></>}
              </h1>
              <p className="auth-sub">
                {isSignup
                  ? "Skill-matched. Schedule-aware. AI-powered partner finding."
                  : "Sign in to find your next partner."}
              </p>
            </div>

            {/* Tabs */}
            <div className="auth-tabs" role="tablist">
              <button
                className={"auth-tab" + (!isSignup ? " active" : "")}
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
              <button
                className={"auth-tab" + (isSignup ? " active" : "")}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form className="form-grid" onSubmit={handleSubmit}>
              {isSignup && (
                <div className="field">
                  <label className="field-label"><Icon name="user" size={13} /> Full Name</label>
                  <div className="input-with-icon">
                    <span className="leading"><Icon name="user" size={16} /></span>
                    <input
                      className="input"
                      placeholder="Alex Rivera"
                      value={form.name}
                      onChange={set("name")}
                    />
                  </div>
                </div>
              )}

              <div className="field">
                <label className="field-label"><Icon name="mail" size={13} /> Email</label>
                <div className="input-with-icon">
                  <span className="leading"><Icon name="mail" size={16} /></span>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={set("email")}
                  />
                </div>
              </div>

              <div className="field">
                <div className="pwd-row">
                  <label className="field-label"><Icon name="lock" size={13} /> Password</label>
                  {!isSignup && (
                    <button
                      type="button"
                      className="link"
                      style={{ background: "none", border: "none", padding: 0 }}
                      onClick={() => alert("Password reset coming soon")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="input-with-icon">
                  <span className="leading"><Icon name="lock" size={16} /></span>
                  <input
                    type={showPwd ? "text" : "password"}
                    className="input has-trailing"
                    placeholder={isSignup ? "Min. 8 characters" : "Enter password"}
                    value={form.password}
                    onChange={set("password")}
                  />
                  <button
                    type="button"
                    className="input-eye"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label="Toggle password visibility"
                  >
                    <Icon name={showPwd ? "eye-off" : "eye"} size={16} />
                  </button>
                </div>
                {isSignup && (
                  <span className="meta-hint">Use 8+ chars with letters & numbers.</span>
                )}
              </div>

              {isSignup && (
                <>
                  <div className="field">
                    <label className="field-label"><Icon name="trophy" size={13} /> Preferred Sport</label>
                    <div className="pill-group" role="tablist">
                      <button
                        type="button"
                        className={"pill" + (form.sport === "Pickleball" ? " active" : "")}
                        onClick={() => set("sport")("Pickleball")}
                      >
                        <Icon name="paddle" size={15} /> Pickleball
                      </button>
                      <button
                        type="button"
                        className={"pill" + (form.sport === "Tennis" ? " active" : "")}
                        onClick={() => set("sport")("Tennis")}
                      >
                        <Icon name="tennis" size={15} /> Tennis
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">
                      <Icon name="bolt" size={13} /> Skill Level · NTRP
                    </label>
                    <div className="ntrp-grid">
                      {NTRP_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          className={"ntrp-chip" + (form.ntrp === lvl ? " active" : "")}
                          onClick={() => set("ntrp")(lvl)}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                    <span className="meta-hint">
                      Don't know yours? Pick a starting point — we'll refine it after a few matches.
                    </span>
                  </div>
                </>
              )}

              {error && (
                <p style={{
                  color: "var(--rose)", background: "var(--rose-ghost)",
                  border: "1px solid rgba(229,72,77,0.32)", borderRadius: 8,
                  padding: "8px 12px", fontSize: 13, fontWeight: 600, margin: 0
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary full lg"
                style={{ marginTop: 6, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting
                  ? (isSignup ? "Creating account…" : "Signing in…")
                  : (isSignup ? "Create Account" : "Sign In")}
                {!submitting && <Icon name="chevron-r" size={16} stroke={2.5} />}
              </button>

              {isSignup && (
                <p className="legal">
                  By signing up you agree to RallyPoint's{" "}
                  <a href="/terms" onClick={(e) => e.preventDefault()}>Terms</a>{" "}
                  and{" "}
                  <a href="/privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                </p>
              )}
            </form>

            <div className="divider-or">or continue with</div>

            <button className="social-btn">
              <Icon name="google" size={18} />
              Continue with Google
            </button>

            <div className="auth-foot">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button onClick={() => setMode("signin")}>Sign In</button>
                </>
              ) : (
                <>
                  New to RallyPoint?{" "}
                  <button onClick={() => setMode("signup")}>Sign Up</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
