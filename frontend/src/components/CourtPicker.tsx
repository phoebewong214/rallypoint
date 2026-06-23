import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../rally-shared";
import type { ApiCourt } from "../api/courts";

/* Searchable single-select for choosing a home/preferred court (one per sport).
   There are hundreds of courts, so the popover has a search box and caps how
   many it renders. `value`/`onChange` use the court slug; null = none. */
export function CourtPicker({
  options, value, onChange, placeholder = "No home court",
}: {
  options: ApiCourt[];
  value: string | null;
  onChange: (slug: string | null) => void;
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

  const selected = options.find((c) => c.id === value) || null;
  const ql = q.trim().toLowerCase();
  const shown = options.filter((c) => !ql || c.name.toLowerCase().includes(ql)).slice(0, 60);

  const pick = (slug: string | null) => { onChange(slug); setOpen(false); setQ(""); };

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
        <span>{selected ? selected.name : placeholder}</span>
        <span className="select-caret"><Icon name="chevron" size={14} /></span>
      </button>

      {open && (
        <div className="court-ms-pop" role="listbox">
          <input
            className="input"
            placeholder="Search courts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="court-ms-list">
            <button type="button" className="court-ms-item court-ms-none" onClick={() => pick(null)}>
              <span className="court-ms-name">{placeholder}</span>
              {value === null && <Icon name="check" size={14} />}
            </button>
            {shown.length === 0 ? (
              <div className="court-ms-empty">No courts match</div>
            ) : (
              shown.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={"court-ms-item" + (c.id === value ? " selected" : "")}
                  onClick={() => pick(c.id)}
                >
                  <span className="court-ms-name">{c.name}</span>
                  {c.id === value && <Icon name="check" size={14} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CourtPicker;
