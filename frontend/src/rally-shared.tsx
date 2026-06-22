/* ============================================================
   RallyPoint — Shared React components (Icons + Avatar + TopNav)
   ============================================================ */
import React, { SVGProps, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { IconName, NavId } from "./types";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import { useSessions } from "./hooks/useSessions";

type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke"> & {
  name: IconName;
  size?: number;
  stroke?: number;
};

/* Tennis uses NTRP; pickleball uses DUPR. Accepts mixed-case sport names. */
export const ratingLabel = (sport?: string | null): "NTRP" | "DUPR" =>
  (sport ?? "").toLowerCase().startsWith("tennis") ? "NTRP" : "DUPR";

export const Icon: React.FC<IconProps> = ({ name, size = 16, stroke = 2, ...p }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...p,
  };
  switch (name) {
    case "search":   return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "pin":      return <svg {...common}><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "clock":    return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "trophy":   return <svg {...common}><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M10 14h4l-1 4h-2l-1-4z"/><path d="M9 21h6"/></svg>;
    case "bolt":     return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    case "sparkles": return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case "chevron":  return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
    case "chevron-r":return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
    case "send":     return <svg {...common}><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>;
    case "bookmark": return <svg {...common}><path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>;
    case "check":    return <svg {...common}><path d="m5 12 5 5 9-11"/></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case "mail":     return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
    case "lock":     return <svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case "user":     return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "eye":      return <svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "eye-off":  return <svg {...common}><path d="M2 2l20 20"/><path d="M6.5 6.5C4 8.5 2 12 2 12s4 7 10 7c2 0 3.7-.6 5.2-1.5"/><path d="M9.9 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.4 4"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/></svg>;
    case "google":   return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.45.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>;
    case "edit":     return <svg {...common}><path d="M11 4H4v16h16v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4z"/></svg>;
    case "plus":     return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "image":    return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>;
    case "heart":    return <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
    case "message":  return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>;
    case "share":    return <svg {...common}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>;
    case "more":     return <svg {...common}><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case "users":    return <svg {...common}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="7" r="3"/><path d="M22 19a5 5 0 0 0-5-5"/></svg>;
    case "flame":    return <svg {...common}><path d="M12 2s4 4 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-7-6-12-6-12z"/></svg>;
    case "stats":    return <svg {...common}><path d="M3 20V10M9 20V4M15 20v-7M21 20v-3"/></svg>;
    case "x":        return <svg {...common}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "logout":   return <svg {...common}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l-5-5 5-5M5 12h14"/></svg>;
    case "bell":     return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    case "sun":      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
    case "moon":     return <svg {...common}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
    case "menu":     return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    default: return null;
  }
};

/* ===== Avatar palette ===== */
type AvatarPalette = { bg: string; fg: string };

const AVATAR_PALETTE: AvatarPalette[] = [
  { bg: "linear-gradient(135deg, #B8FF1A, #8FD600)", fg: "#0A1A00" },
  { bg: "linear-gradient(135deg, #2EA8FF, #1B7FCC)", fg: "#FFFFFF" },
  { bg: "linear-gradient(135deg, #FF6B9D, #C93B73)", fg: "#FFFFFF" },
  { bg: "linear-gradient(135deg, #FFB13C, #E07A00)", fg: "#2A1500" },
  { bg: "linear-gradient(135deg, #B07CFF, #7B3FE4)", fg: "#FFFFFF" },
  { bg: "linear-gradient(135deg, #34D399, #0F9D6E)", fg: "#06281C" },
  { bg: "linear-gradient(135deg, #F87171, #DC2626)", fg: "#FFFFFF" },
];

export const avatarFor = (seed?: string | null): AvatarPalette => {
  const s = (seed || "?").toString();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
};

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  name?: string | null;
  size?: AvatarSize;
  initials?: string;
  color?: string;
  fg?: string;
  online?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = "md",
  initials,
  color,
  fg,
  online,
}) => {
  const inits =
    initials ||
    (name || "?")
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const pal = color && fg ? { bg: color, fg } : avatarFor(name || inits);
  return (
    <div className={"avatar size-" + size} style={{ background: pal.bg, color: pal.fg }}>
      {inits}
      {online && <span className="online" title="Online" />}
    </div>
  );
};

/* ===== Top Nav =====
   Pulls the active user from AuthContext, so pages don't need to pass it.
   Pass `active` to highlight a specific nav link; otherwise relies on the
   current route via NavLink. Pass `hideUser` on the login page. */
export interface TopNavProps {
  active?: NavId | null;
  hideUser?: boolean;
  hideLinks?: boolean;
}

interface NavLinkDef {
  id: NavId;
  label: string;
  to: string;
}

const NAV_LINKS: NavLinkDef[] = [
  { id: "find",     label: "Find Partners", to: "/find" },
  { id: "matches",  label: "My Games",      to: "/sessions" },
  { id: "courts",   label: "Courts",        to: "/courts" },
];

export const TopNav: React.FC<TopNavProps> = ({ active, hideUser, hideLinks }) => {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const showUser = !hideUser && !!user;

  // Incoming game requests waiting on a reply — surfaced as a badge on "My Games"
  // so they're noticed from any page (shares the cached /sessions query).
  const { data: sessionsData } = useSessions(!!user);
  const requestCount = (sessionsData?.sessions ?? []).filter((s) => s.bucket === "requests").length;

  // Mobile hamburger menu — collapses nav links + user controls into a drawer.
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes (e.g., user tapped a link).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link className="logo" to={user ? "/find" : "/"} aria-label="RallyPoint home">
          <img src="/logo.png" alt="RallyPoint" className="logo-img" />
        </Link>
        {!hideLinks && (
          <div className="nav-links">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.id}
                to={l.to}
                end
                className={({ isActive }) =>
                  "nav-link" + (active === l.id || isActive ? " active" : "")
                }
              >
                {l.label}
                {l.id === "matches" && requestCount > 0 && (
                  <span className="nav-badge" aria-label={`${requestCount} pending request${requestCount === 1 ? "" : "s"}`}>{requestCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        )}
        <div className="nav-spacer" />

        {/* Desktop controls (hidden on small screens via CSS) */}
        <div className="nav-desktop-controls">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-icon-sq"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          </button>
          {showUser && user ? (
            <>
              <Link className="nav-pill" to="/profile">
                <span>{user.name}</span>
                <div className="nav-avatar">{user.initials}</div>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="btn-icon-sq"
                title="Sign out"
                aria-label="Sign out"
              >
                <Icon name="logout" size={16} />
              </button>
            </>
          ) : (
            <Link className="nav-pill" to="/">
              <span>Sign In</span>
            </Link>
          )}
        </div>

        {/* Mobile: just the avatar + hamburger */}
        <div className="nav-mobile-controls">
          {showUser && user && (
            <Link to="/profile" className="nav-avatar" aria-label="Open profile">
              {user.initials}
            </Link>
          )}
          <button
            type="button"
            className="btn-icon-sq nav-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? "x" : "menu"} size={18} />
          </button>
        </div>
      </div>

      {/* Mobile slide-down drawer */}
      {menuOpen && (
        <>
          <div className="nav-drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="nav-drawer" role="dialog" aria-label="Navigation menu">
            {!hideLinks && (
              <div className="nav-drawer-links">
                {NAV_LINKS.map((l) => (
                  <NavLink
                    key={l.id}
                    to={l.to}
                    end
                    className={({ isActive }) =>
                      "nav-drawer-link" + (active === l.id || isActive ? " active" : "")
                    }
                  >
                    {l.label}
                    {l.id === "matches" && requestCount > 0 && (
                      <span className="nav-badge" aria-label={`${requestCount} pending request${requestCount === 1 ? "" : "s"}`}>{requestCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
            <div className="nav-drawer-foot">
              <button
                type="button"
                onClick={toggleTheme}
                className="btn-ghost full"
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {showUser && user ? (
                <button
                  type="button"
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="btn-ghost full"
                >
                  <Icon name="logout" size={15} />
                  Sign out
                </button>
              ) : (
                <Link to="/" className="btn-primary full" onClick={() => setMenuOpen(false)}>
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};
