import React from "react";

/* Weekly preferred-times grid (3 bands × 7 days). Cells cycle
   unavailable → maybe → available on tap. Shared by signup onboarding and the
   Profile page; reuses the .avail-* styles. */
export const AVAIL_BANDS = ["MORN", "AFT", "EVE"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const STATUS_TITLE = ["Unavailable", "Maybe", "Available"];

/** Flatten the cell map into the API's availability list (only set cells). */
export function availMapToList(map: Record<string, number>) {
  const out: { dayOfWeek: number; timeBand: string; status: number }[] = [];
  for (const band of AVAIL_BANDS) {
    for (let day = 0; day < 7; day++) {
      const status = map[`${band}-${day}`] ?? 0;
      if (status > 0) out.push({ dayOfWeek: day, timeBand: band, status });
    }
  }
  return out;
}

export function AvailabilityGrid({
  value,
  onCycle,
}: {
  value: Record<string, number>;
  onCycle?: (key: string) => void; // omit ⇒ read-only
}) {
  const editable = !!onCycle;
  return (
    <div className="avail-wrap" role="grid" aria-label="Weekly availability">
      <div className="avail-label-col" />
      <div className="avail-grid">
        {DAY_LABELS.map((d, i) => <div key={i} className="avail-cell day-label">{d}</div>)}
      </div>
      {AVAIL_BANDS.map((band) => (
        <React.Fragment key={band}>
          <div className="avail-label-col">{band}</div>
          <div className="avail-grid">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const key = `${band}-${day}`;
              const v = value[key] ?? 0;
              return (
                <div
                  key={day}
                  className={"avail-cell " + (v === 2 ? "on" : v === 1 ? "half" : "") + (editable ? " editable" : "")}
                  title={STATUS_TITLE[v]}
                  role={editable ? "button" : undefined}
                  tabIndex={editable ? 0 : undefined}
                  onClick={editable ? () => onCycle!(key) : undefined}
                  onKeyDown={editable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCycle!(key); } } : undefined}
                />
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default AvailabilityGrid;
