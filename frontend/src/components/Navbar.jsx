import React from "react";
import { NavLink, Link } from "react-router-dom";

const LINKS = [
  { to: "/find", label: "Find Partner" },
  { to: "/sessions", label: "Sessions" },
  { to: "/feed", label: "Feed" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar() {
  const baseClass =
    "px-3 py-2 rounded-md text-sm font-medium transition";
  const inactive = "text-gray-700 hover:bg-rally-50 hover:text-rally-700";
  const active = "bg-rally-600 text-white shadow";

  return (
    <nav className="bg-white border-b border-rally-100 shadow-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/find" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-rally-600 text-white flex items-center justify-center font-bold">
            R
          </div>
          <span className="text-xl font-bold text-rally-700">RallyPoint</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `${baseClass} ${isActive ? active : inactive}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <NavLink
          to="/login"
          className="bg-rally-600 hover:bg-rally-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow"
        >
          Login
        </NavLink>
      </div>

      <div className="md:hidden border-t border-rally-100 px-2 py-2 flex gap-1 overflow-x-auto">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `${baseClass} whitespace-nowrap ${isActive ? active : inactive}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
