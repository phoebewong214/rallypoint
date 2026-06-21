import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../rally-shared";
import type { ApiCourt } from "../api/courts";

/* Searchable multi-select for filtering Find Partner by a player's home court.
   There are hundreds of courts, so the popover has a search box and caps how
   many it renders at once. */
export function CourtMultiSelect({
  options, value, onChange,
}: {
  options: ApiCourt[];
  value: string[];
  onChange: (slugs: string[]) => void;
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

  const sel = new Set(value);
  const ql = q.trim().toLowerCase();
  // Selected first, then the rest; filter by search; cap the rendered list.
  const sorted = [...options].sort((a, b) => Number(sel.has(b.id)) - Number(sel.has(a.id)));
  const shown = sorted.filter((c) => !ql || c.name.toLowerCase().includes(ql)).slice(0, 60);

  const toggle = (slug: string) => {
    const next = new Set(sel);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    onChange([...next]);
  };

  return (
    <div className="court-ms" ref={ref}>
      <button
        type="button"
        className="court-ms-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon name="pin" size={13} />
        <span>{value.length ? `${value.length} court${value.length === 1 ? "" : "s"}` : "Any court"}</span>
        <span className="select-caret"><Icon name="chevron" size={14} /></span>
      </button>

      {open && (
        <div className="court-ms-pop" role="listbox" aria-multiselectable="true">
          <input
            className="input"
            placeholder="Search courts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="court-ms-list">
            {shown.length === 0 ? (
              <div className="court-ms-empty">No courts match</div>
            ) : (
              shown.map((c) => (
                <label key={c.id} className="court-ms-item">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="court-ms-name">{c.name}</span>
                  {typeof c.distance === "number" && <span className="court-ms-dist">{c.distance} mi</span>}
                </label>
              ))
            )}
          </div>
          {value.length > 0 && (
            <button type="button" className="court-ms-clear" onClick={() => onChange([])}>
              Clear {value.length} selected
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CourtMultiSelect;
