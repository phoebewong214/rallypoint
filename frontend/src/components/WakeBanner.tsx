import React, { useEffect, useState } from "react";
import { Spinner } from "./Skeleton";
import { token } from "../theme/tokens";

/* Non-blocking banner shown while an API request is unusually slow — almost
   always Render's free tier waking from sleep (~50s on the first request after
   idle). Without it a long request looks broken; with it the user knows to wait
   instead of assuming it failed. Driven by the api client's 'api:slow' event. */
export function WakeBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const onSlow = (e: Event) => setSlow(!!(e as CustomEvent).detail);
    window.addEventListener("api:slow", onSlow as EventListener);
    return () => window.removeEventListener("api:slow", onSlow as EventListener);
  }, []);

  if (!slow) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 2000,
        display: "inline-flex", alignItems: "center", gap: 10, maxWidth: "92vw",
        background: token.card, color: token.text, border: `1px solid ${token.border}`,
        borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <Spinner /> Waking up the server — this can take up to a minute on the free tier…
    </div>
  );
}

export default WakeBanner;
