import React from "react";
import { Icon } from "../rally-shared";
import type { AvailabilitySlotDTO } from "../types";

/* Projects a player's recurring weekly availability onto the next N concrete
   dates, so "free Thursday evenings" reads as "free Thu, Jul 16". Display-only:
   the source of truth is still the weekly grid — this is the same data walked
   forward from today. Used on Find Partner cards and inside ScheduleModal
   (where tapping a date fills the picker). */

export const UPCOMING_BANDS = ["MORN", "AFT", "EVE"];
const BAND_WORD: Record<string, string> = { MORN: "morning", AFT: "afternoon", EVE: "evening" };

// API dayOfWeek is 0=Mon..6=Sun; JS getDay() is 0=Sun..6=Sat.
const dowOf = (d: Date) => (d.getDay() + 6) % 7;

const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD key — matches the date part of a datetime-local value. */
export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type UpcomingDay = {
  date: Date;
  iso: string; // local YYYY-MM-DD
  bands: Record<string, number>; // band -> status 0/1/2
};

/** Index slots by day-of-week, then walk `days` real dates starting today. */
export function projectUpcoming(slots: AvailabilitySlotDTO[] | undefined, days = 14): UpcomingDay[] {
  const byDow: Record<number, Record<string, number>> = {};
  (slots ?? []).forEach((s) => {
    (byDow[s.dayOfWeek] ??= {})[s.timeBand] = s.status;
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return { date, iso: localDateKey(date), bands: byDow[dowOf(date)] ?? {} };
  });
}

/** "morning + evening" / "maybe afternoon" summary for one date; null if unmarked. */
export function freeBandsLabel(slots: AvailabilitySlotDTO[] | undefined, dateISO: string): string | null {
  const d = new Date(`${dateISO}T12:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = dowOf(d);
  const free: string[] = [];
  const maybe: string[] = [];
  (slots ?? []).forEach((s) => {
    if (s.dayOfWeek !== dow) return;
    if (s.status === 2) free.push(BAND_WORD[s.timeBand] ?? s.timeBand);
    else if (s.status === 1) maybe.push(BAND_WORD[s.timeBand] ?? s.timeBand);
  });
  if (free.length === 0 && maybe.length === 0) return null;
  const parts = [...free];
  if (maybe.length) parts.push(`maybe ${maybe.join(" + ")}`);
  return parts.join(" + ");
}

/* Horizontal strip of the next `days` dates, three band cells per column.
   Pass onPickDate to make columns tappable (ScheduleModal); omit for the
   read-only Find Partner card view. Hidden when no availability is marked. */
export function UpcomingDatesStrip({
  slots,
  days = 14,
  title = "Usually free · next 2 weeks",
  selectedISO,
  onPickDate,
}: {
  slots?: AvailabilitySlotDTO[];
  days?: number;
  title?: string | null;
  selectedISO?: string | null;
  onPickDate?: (iso: string) => void;
}) {
  if (!(slots ?? []).some((s) => s.status > 0)) return null;
  const upcoming = projectUpcoming(slots, days);
  const clickable = !!onPickDate;
  return (
    <div className="updays">
      {title && (
        <div className="pref-mini-title">
          <Icon name="calendar" size={11} /> {title}
        </div>
      )}
      <div className="updays-scroll">
        <div className="updays-strip">
          {upcoming.map((d, i) => {
            const summary = freeBandsLabel(slots, d.iso);
            const full = d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const tip = summary ? `${full} — usually free: ${summary}` : `${full} — not marked free`;
            const cls =
              "updays-day" +
              (i === 0 ? " today" : "") +
              (selectedISO === d.iso ? " selected" : "");
            const cells = UPCOMING_BANDS.map((band) => {
              const v = d.bands[band] ?? 0;
              return (
                <span
                  key={band}
                  className={"pref-mini-cell" + (v === 2 ? " on" : v === 1 ? " half" : "")}
                />
              );
            });
            const body = (
              <>
                <span className="updays-dow">
                  {d.date.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="updays-date">{d.date.getDate()}</span>
                {cells}
              </>
            );
            return clickable ? (
              <button
                key={d.iso}
                type="button"
                className={cls}
                title={tip}
                aria-label={tip}
                aria-pressed={selectedISO === d.iso}
                onClick={() => onPickDate!(d.iso)}
              >
                {body}
              </button>
            ) : (
              <span key={d.iso} className={cls} title={tip}>
                {body}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default UpcomingDatesStrip;
