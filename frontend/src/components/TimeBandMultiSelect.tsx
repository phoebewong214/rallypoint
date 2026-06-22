import React from "react";

/* Multi-select for filtering Find Partner by a player's preferred time bands.
   Only three options, so a compact pill toggle group beats a popover. Mirrors
   the "preferred times" a player sets on their Profile (MORN/AFT/EVE). */
const BANDS: { id: string; label: string }[] = [
  { id: "MORN", label: "Morning" },
  { id: "AFT", label: "Afternoon" },
  { id: "EVE", label: "Evening" },
];

export function TimeBandMultiSelect({
  value, onChange,
}: {
  value: string[];
  onChange: (bands: string[]) => void;
}) {
  const sel = new Set(value);
  const toggle = (id: string) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  return (
    <div className="pill-group" role="group" aria-label="Preferred time">
      {BANDS.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-pressed={sel.has(b.id)}
          className={"pill" + (sel.has(b.id) ? " active" : "")}
          onClick={() => toggle(b.id)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export default TimeBandMultiSelect;
