import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav, Icon, ratingLabel } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth";
import { Spinner } from "../components/Skeleton";

const NTRP_LEVELS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

type Mode = "signin" | "signup" | "forgot";
type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [forgotSent, setForgotSent] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    password: string;
    sport: "Pickleball" | "Tennis";
    ntrp: string;
    location: string;
    lat: number | null;
    lng: number | null;
  }>({
    name: "",
    email: "",
    password: "",
    sport: "Pickleball",
    ntrp: "3.5",
    location: "",
    lat: null,
    lng: null,
  });
  // Updating a field also clears any error attached to it.
  const set = (k: string) => (e: any) => {
    const value = e?.target?.value ?? e;
    setForm((f) => ({ ...f, [k]: value }));
    setFieldErrors((fe) => {
      if (!fe[k]) return fe;
      const next = { ...fe };
      delete next[k];
      return next;
    });
  };
  const [locating, setLocating] = useState(false);
  const [locStatus, setLocStatus] = useState<"" | "ok" | "denied" | "unsupported" | "error">("");

  // Turn coordinates into a "City, ST" string for the visible Location field.
  // BigDataCloud's reverse-geocode-client endpoint is free and keyless.
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      );
      if (!res.ok) return;
      const d = await res.json();
      const city = d.city || d.locality || d.principalSubdivision || "";
      const region = d.principalSubdivisionCode?.split("-")?.[1] || d.principalSubdivision || "";
      const label = [city, region].filter(Boolean).join(", ");
      if (label) setForm((f) => ({ ...f, location: f.location || label }));
    } catch {
      /* keep coords; user can type the city manually */
    }
  };

  const handleUseMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocStatus("unsupported");
      return;
    }
    if (!window.isSecureContext) {
      // Browsers only expose geolocation over https or localhost.
      setLocStatus("error");
      return;
    }
    setLocating(true);
    setLocStatus("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm((f) => ({ ...f, lat: latitude, lng: longitude }));
        setLocStatus("ok");
        setLocating(false);
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setError("");
    setFieldErrors({});
    setForgotSent(false);
  };

  // Client-side validation — returns a map of field -> message.
  const validate = (): FieldErrors => {
    const fe: FieldErrors = {};
    if (!form.email.trim()) fe.email = "Enter your email.";
    else if (!EMAIL_RE.test(form.email.trim())) fe.email = "Enter a valid email address.";
    if (isForgot) return fe; // password-reset only needs an email
    if (isSignup && !form.name.trim()) fe.name = "Enter your name.";
    if (!form.password) fe.password = "Enter your password.";
    else if (isSignup && form.password.length < 8) fe.password = "Use at least 8 characters.";
    return fe;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe = validate();
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      setError("");
      return;
    }
    setFieldErrors({});
    setError("");
    setSubmitting(true);
    try {
      if (isForgot) {
        await authApi.forgotPassword(form.email.trim());
        setForgotSent(true);
        return;
      }
      if (isSignup) {
        await signup({
          name: form.name,
          email: form.email,
          password: form.password,
          sport: form.sport,
          ntrp: form.ntrp,
          location: form.location || undefined,
          lat: form.lat ?? undefined,
          lng: form.lng ?? undefined,
        });
      } else {
        await login(form.email, form.password);
      }
      navigate("/find", { replace: true });
    } catch (err: any) {
      // Backend 422 returns { error, fields: { field: [msg, ...] } } — surface
      // those inline next to the offending input.
      const fields = err?.body?.fields;
      if (fields && typeof fields === "object") {
        const mapped: FieldErrors = {};
        for (const [k, v] of Object.entries(fields)) {
          mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
        setFieldErrors(mapped);
        setError("Please fix the highlighted fields.");
      } else {
        setError(err?.message || "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Renders the inline error for a field + the aria wiring to attach to its input.
  const fieldErr = (k: string) =>
    fieldErrors[k] ? (
      <span id={`${k}-err`} className="meta-hint" role="alert" style={{ color: "var(--rose)" }}>
        {fieldErrors[k]}
      </span>
    ) : null;
  const ariaFor = (k: string, describedBy?: string) => ({
    "aria-invalid": fieldErrors[k] ? true : undefined,
    "aria-describedby": fieldErrors[k] ? `${k}-err` : describedBy,
  });

  return (
    <>
      <TopNav hideUser hideLinks />

      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-brand">
              <img src="/logo.png" alt="RallyPoint" className="auth-logo-img" />
              <h1 className="auth-title">
                {isForgot ? <>Reset your <em>password.</em></>
                  : isSignup ? <>Join the <em>rally.</em></>
                  : <>Welcome <em>back.</em></>}
              </h1>
              <p className="auth-sub">
                {isForgot
                  ? "We'll email you a link to set a new password."
                  : isSignup
                  ? "Skill-matched. Schedule-aware. AI-powered partner finding."
                  : "Sign in to find your next partner."}
              </p>
            </div>

            {/* Tabs */}
            {!isForgot && (
            <div className="auth-tabs" role="tablist" aria-label="Sign in or sign up">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignup}
                className={"auth-tab" + (!isSignup ? " active" : "")}
                onClick={() => switchMode("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignup}
                className={"auth-tab" + (isSignup ? " active" : "")}
                onClick={() => switchMode("signup")}
              >
                Sign Up
              </button>
            </div>
            )}

            {/* Forgot-password success state */}
            {isForgot && forgotSent ? (
              <div className="form-grid">
                <p role="status" aria-live="polite" style={{
                  color: "var(--green)", background: "var(--green-ghost, rgba(48,164,108,0.12))",
                  border: "1px solid rgba(48,164,108,0.32)", borderRadius: 8,
                  padding: "12px 14px", fontSize: 14, fontWeight: 600, margin: 0,
                }}>
                  <Icon name="check" size={14} stroke={3} /> If an account exists for{" "}
                  <strong>{form.email.trim()}</strong>, we've emailed a link to reset your
                  password. The link expires in 1 hour.
                </p>
                <div className="auth-foot">
                  <button onClick={() => switchMode("signin")}>Back to sign in</button>
                </div>
              </div>
            ) : (
            /* Form */
            <form className="form-grid" onSubmit={handleSubmit} noValidate>
              {isSignup && (
                <div className="field">
                  <label className="field-label" htmlFor="name"><Icon name="user" size={13} /> Full Name</label>
                  <div className="input-with-icon">
                    <span className="leading"><Icon name="user" size={16} /></span>
                    <input
                      id="name"
                      name="name"
                      autoComplete="name"
                      required
                      className="input"
                      placeholder="Alex Rivera"
                      value={form.name}
                      onChange={set("name")}
                      {...ariaFor("name")}
                    />
                  </div>
                  {fieldErr("name")}
                </div>
              )}

              <div className="field">
                <label className="field-label" htmlFor="email"><Icon name="mail" size={13} /> Email</label>
                <div className="input-with-icon">
                  <span className="leading"><Icon name="mail" size={16} /></span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    className="input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={set("email")}
                    {...ariaFor("email")}
                  />
                </div>
                {fieldErr("email")}
              </div>

              {!isForgot && (
              <div className="field">
                <div className="pwd-row">
                  <label className="field-label" htmlFor="password"><Icon name="lock" size={13} /> Password</label>
                  {!isSignup && (
                    <button
                      type="button"
                      className="link"
                      style={{ background: "none", border: "none", padding: 0 }}
                      onClick={() => switchMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="input-with-icon">
                  <span className="leading"><Icon name="lock" size={16} /></span>
                  <input
                    id="password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    required
                    minLength={isSignup ? 8 : undefined}
                    className="input has-trailing"
                    placeholder={isSignup ? "Min. 8 characters" : "Enter password"}
                    value={form.password}
                    onChange={set("password")}
                    {...ariaFor("password", isSignup ? "password-hint" : undefined)}
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
                {fieldErr("password")}
                {isSignup && !fieldErrors.password && (
                  <span id="password-hint" className="meta-hint">Use 8+ chars with letters & numbers.</span>
                )}
              </div>
              )}

              {isSignup && (
                <>
                  <div className="field">
                    <label className="field-label" id="sport-label"><Icon name="trophy" size={13} /> Preferred Sport</label>
                    <div className="pill-group" role="radiogroup" aria-labelledby="sport-label">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={form.sport === "Pickleball"}
                        className={"pill" + (form.sport === "Pickleball" ? " active" : "")}
                        onClick={() => set("sport")("Pickleball")}
                      >
                        Pickleball
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={form.sport === "Tennis"}
                        className={"pill" + (form.sport === "Tennis" ? " active" : "")}
                        onClick={() => set("sport")("Tennis")}
                      >
                        Tennis
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" id="ntrp-label">
                      <Icon name="bolt" size={13} /> Skill Level · {ratingLabel(form.sport)}
                    </label>
                    <div className="ntrp-grid" role="radiogroup" aria-labelledby="ntrp-label">
                      {NTRP_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          role="radio"
                          aria-checked={form.ntrp === lvl}
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

                  <div className="field">
                    <label className="field-label" htmlFor="location"><Icon name="pin" size={13} /> Location</label>
                    <div className="input-with-icon">
                      <span className="leading"><Icon name="pin" size={16} /></span>
                      <input
                        id="location"
                        name="location"
                        autoComplete="address-level2"
                        className="input"
                        placeholder="Berkeley, CA"
                        value={form.location}
                        onChange={set("location")}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <button
                        type="button"
                        className="link"
                        style={{
                          background: "none", border: "none", padding: 0,
                          fontWeight: 700, fontSize: 13, cursor: "pointer",
                          color: "var(--green)",
                        }}
                        onClick={handleUseMyLocation}
                        disabled={locating}
                      >
                        {locating ? "Locating…" : "Use my location"}
                      </button>
                      {locStatus === "ok" && form.lat != null && (
                        <span className="meta-hint" style={{ color: "var(--green)" }}>
                          <Icon name="check" size={12} stroke={3} /> Location captured
                        </span>
                      )}
                      {locStatus === "denied" && (
                        <span className="meta-hint">Permission denied — we'll use the city name.</span>
                      )}
                      {locStatus === "error" && (
                        <span className="meta-hint">Couldn't get location — we'll use the city name.</span>
                      )}
                      {locStatus === "unsupported" && (
                        <span className="meta-hint">Geolocation not supported in this browser.</span>
                      )}
                    </div>
                    <span className="meta-hint">
                      Needed for distance-based partner matching. We never share your exact coordinates.
                    </span>
                  </div>
                </>
              )}

              {error && (
                <p role="alert" aria-live="assertive" style={{
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
                {submitting ? (
                  <>
                    <Spinner />
                    {isForgot ? "Sending…" : isSignup ? "Creating account…" : "Signing in…"}
                  </>
                ) : (
                  <>
                    {isForgot ? "Send reset link" : isSignup ? "Create Account" : "Sign In"}
                    <Icon name="chevron-r" size={16} stroke={2.5} />
                  </>
                )}
              </button>

              {isForgot && (
                <div className="auth-foot" style={{ marginTop: 2 }}>
                  <button type="button" onClick={() => switchMode("signin")}>
                    Back to sign in
                  </button>
                </div>
              )}

              {isSignup && (
                <p className="legal">
                  By signing up you agree to RallyPoint's{" "}
                  <a href="/terms" onClick={(e) => e.preventDefault()}>Terms</a>{" "}
                  and{" "}
                  <a href="/privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                </p>
              )}
            </form>
            )}

            {!isForgot && (
            <div className="auth-foot">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button onClick={() => switchMode("signin")}>Sign In</button>
                </>
              ) : (
                <>
                  New to RallyPoint?{" "}
                  <button onClick={() => switchMode("signup")}>Sign Up</button>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
