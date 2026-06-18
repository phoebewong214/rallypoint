import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopNav, Icon } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth";
import { Spinner } from "../components/Skeleton";

/* Landing page for the link in the verification email:
   /verify-email?token=<jwt> */
type Status = "verifying" | "success" | "error";

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { isAuthenticated, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState(
    token ? "" : "This verification link is missing its token."
  );
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // guard against StrictMode double-invoke
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        // If this user is logged in, refresh so emailVerified flips and the
        // ProtectedRoute gate opens.
        refreshUser().catch(() => {});
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err?.message || "This verification link is invalid or has expired.");
      });
  }, [token, refreshUser]);

  return (
    <>
      <TopNav hideUser hideLinks />
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-brand">
              <img src="/logo.png" alt="RallyPoint" className="auth-logo-img" />
              <h1 className="auth-title">Email <em>verification.</em></h1>
            </div>

            <div className="form-grid" role="status" aria-live="polite">
              {status === "verifying" && (
                <p style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                  <Spinner /> Verifying your email…
                </p>
              )}
              {status === "success" && (
                <p style={{
                  color: "var(--green)", background: "var(--green-ghost, rgba(48,164,108,0.12))",
                  border: "1px solid rgba(48,164,108,0.32)", borderRadius: 8,
                  padding: "12px 14px", fontSize: 14, fontWeight: 600, margin: 0,
                }}>
                  <Icon name="check" size={14} stroke={3} /> Your email is verified. You're all set!
                </p>
              )}
              {status === "error" && (
                <p style={{
                  color: "var(--rose)", background: "var(--rose-ghost)",
                  border: "1px solid rgba(229,72,77,0.32)", borderRadius: 8,
                  padding: "12px 14px", fontSize: 14, fontWeight: 600, margin: 0,
                }}>
                  {message}
                </p>
              )}

              {status !== "verifying" && (
                <button className="btn-primary full lg"
                  onClick={() => navigate(isAuthenticated ? "/find" : "/", { replace: true })}>
                  {isAuthenticated ? "Continue to RallyPoint" : "Go to sign in"}
                  <Icon name="chevron-r" size={16} stroke={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default VerifyEmailPage;
