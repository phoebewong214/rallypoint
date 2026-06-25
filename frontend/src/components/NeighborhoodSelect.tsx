import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../rally-shared";
import { CHICAGO_NEIGHBORHOODS, type Neighborhood } from "../data/chicagoNeighborhoods";

/* Searchable single-select for a Chicago neighborhood. Returns the full
   Neighborhood (with centroid) so the caller can set location + lat/lng at once.
   Reuses the .court-ms popover styles. */
const SORTED = [...CHICAGO_NEIGHBORHOODS].sort((a, b) => a.name.localeCompare(b.name));

export function NeighborhoodSelect({
  value,
  onChange,
  placeholder = "Pick your neighborhood",
}: {
  value: string | null;
  onChange: (n: Neighborhood | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ql = q.trim().toLowerCase();
  const shown = SORTED.filter((n) => !ql || n.name.toLowerCase().includes(ql));
  const pick = (n: Neighborhood | null) => { onChange(n); setOpen(false); setQ(""); };

  return (
    <div className="court-ms" ref={ref}>
      <button type="button" className="court-ms-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <Icon name="pin" size={13} />
        <span>{value || placeholder}</span>
        <span className="select-caret"><Icon name="chevron" size={14} /></span>
      </button>

      {open && (
        <div className="court-ms-pop" role="listbox">
          <input className="input" placeholder="Search neighborhoods…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="court-ms-list">
            {value && (
              <button type="button" className="court-ms-item court-ms-none" onClick={() => pick(null)}>
                <span className="court-ms-name">Clear</span>
              </button>
            )}
            {shown.length === 0 ? (
              <div className="court-ms-empty">No neighborhoods match</div>
            ) : (
              shown.map((n) => (
                <button
                  key={n.name}
                  type="button"
                  className={"court-ms-item" + (n.name === value ? " selected" : "")}
                  onClick={() => pick(n)}
                >
                  <span className="court-ms-name">{n.name}</span>
                  {n.name === value && <Icon name="check" size={14} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NeighborhoodSelect;
