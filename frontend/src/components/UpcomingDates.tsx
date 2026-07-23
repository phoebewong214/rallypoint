import React from "react";
import { Icon } from "../rally-shared";
import type { AvailabilitySlotDTO, AvailabilityOverrideDTO } from "../types";

/* Projects a player's recurring weekly availability onto the next N concrete
   dates, so "free Thursday evenings" reads as "free Thu, Jul 16" — with
   date-specific overrides ("busy THIS Saturday") layered on top when present.
   Used on Find Partner cards, inside ScheduleModal (where tapping a date fills
   the picker), and as the tap-to-tweak editor on the Profile page. */

export const UPCOMING_BANDS = ["MORN", "AFT", "EVE"];
const BAND_WORD: Record<string, string> = { MORN: "morning", AFT: "afternoon", EVE: "evening" };
const STATUS_TITLE = ["Unavailable", "Maybe", "Available"];

// API dayOfWeek is 0=Mon..6=Sun; JS getDay() is 0=Sun..6=Sat.
const dowOf = (d: Date) => (d.getDay() + 6) % 7;

const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD key — matches the date part of a datetime-local value. */
export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type UpcomingDay = {
  date: Date;
  iso: string; // local YYYY-MM-DD
  bands: Record<string, number>; // band -> effective status 0/1/2
  tweaked: Record<string, boolean>; // band -> true when an override applies
};

const overrideMap = (overrides?: AvailabilityOverrideDTO[]) => {
  const m: Record<string, Record<string, number>> = {};
  (overrides ?? []).forEach((o) => {
    (m[o.date] ??= {})[o.timeBand] = o.status;
  });
  return m;
};

/** Walk `days` real dates from today: weekly grid value, then any override. */
export function projectUpcoming(
  slots: AvailabilitySlotDTO[] | undefined,
  days = 14,
  overrides?: AvailabilityOverrideDTO[],
): UpcomingDay[] {
  const byDow: Record<number, Record<string, number>> = {};
  (slots ?? []).forEach((s) => {
    (byDow[s.dayOfWeek] ??= {})[s.timeBand] = s.status;
  });
  const ovr = overrideMap(overrides);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const iso = localDateKey(date);
    const bands: Record<string, number> = { ...(byDow[dowOf(date)] ?? {}) };
    const tweaked: Record<string, boolean> = {};
    for (const [band, status] of Object.entries(ovr[iso] ?? {})) {
      bands[band] = status;
      tweaked[band] = true;
    }
    return { date, iso, bands, tweaked };
  });
}

/** "morning + evening" / "maybe afternoon" summary for one date; null if unmarked. */
export function freeBandsLabel(
  slots: AvailabilitySlotDTO[] | undefined,
  dateISO: string,
  overrides?: AvailabilityOverrideDTO[],
): string | null {
  const d = new Date(`${dateISO}T12:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = dowOf(d);
  const bands: Record<string, number> = {};
  (slots ?? []).forEach((s) => { if (s.dayOfWeek === dow) bands[s.timeBand] = s.status; });
  for (const [band, status] of Object.entries(overrideMap(overrides)[dateISO] ?? {})) {
    bands[band] = status;
  }
  const free = UPCOMING_BANDS.filter((b) => bands[b] === 2).map((b) => BAND_WORD[b]);
  const maybe = UPCOMING_BANDS.filter((b) => bands[b] === 1).map((b) => BAND_WORD[b]);
  if (free.length === 0 && maybe.length === 0) return null;
  const parts = [...free];
  if (maybe.length) parts.push(`maybe ${maybe.join(" + ")}`);
  return parts.join(" + ");
}

const hasAnyMarked = (slots?: AvailabilitySlotDTO[], overrides?: AvailabilityOverrideDTO[]) =>
  (slots ?? []).some((s) => s.status > 0) || (overrides ?? []).some((o) => o.status > 0);

function dayTip(d: UpcomingDay, summaryOf: (iso: string) => string | null) {
  const full = d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const summary = summaryOf(d.iso);
  return summary ? `${full} — usually free: ${summary}` : `${full} — not marked free`;
}

/* Horizontal strip of the next `days` dates, three band cells per column.
   Pass onPickDate to make columns tappable (ScheduleModal); omit for the
   read-only Find Partner card view. Hidden when no availability is marked. */
export function UpcomingDatesStrip({
  slots,
  overrides,
  days = 14,
  title = "Usually free · next 2 weeks",
  selectedISO,
  onPickDate,
}: {
  slots?: AvailabilitySlotDTO[];
  overrides?: AvailabilityOverrideDTO[];
  days?: number;
  title?: string | null;
  selectedISO?: string | null;
  onPickDate?: (iso: string) => void;
}) {
  if (!hasAnyMarked(slots, overrides)) return null;
  const upcoming = projectUpcoming(slots, days, overrides);
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
            const tip = dayTip(d, (iso) => freeBandsLabel(slots, iso, overrides));
            const cls =
              "updays-day" +
              (i === 0 ? " today" : "") +
              (selectedISO === d.iso ? " selected" : "");
            const body = (
              <>
                <span className="updays-dow">
                  {d.date.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="updays-date">{d.date.getDate()}</span>
                {UPCOMING_BANDS.map((band) => {
                  const v = d.bands[band] ?? 0;
                  return (
                    <span
                      key={band}
                      className={"pref-mini-cell" + (v === 2 ? " on" : v === 1 ? " half" : "")}
                    />
                  );
                })}
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

/* Profile editor: the same projection, but every cell is tappable. Tapping
   cycles the date's effective status; when it lands back on the weekly
   pattern's value the override is dropped (the dot marker disappears). */
export function UpcomingTweaksEditor({
  slots,
  value,
  onChange,
  days = 14,
}: {
  slots?: AvailabilitySlotDTO[];
  value: AvailabilityOverrideDTO[];
  onChange: (next: AvailabilityOverrideDTO[]) => void;
  days?: number;
}) {
  const upcoming = projectUpcoming(slots, days, value);
  const byDow: Record<number, Record<string, number>> = {};
  (slots ?? []).forEach((s) => {
    (byDow[s.dayOfWeek] ??= {})[s.timeBand] = s.status;
  });
  const cycle = (d: UpcomingDay, band: string) => {
    const template = byDow[dowOf(d.date)]?.[band] ?? 0;
    const next = ((d.bands[band] ?? 0) + 1) % 3;
    const rest = value.filter((o) => !(o.date === d.iso && o.timeBand === band));
    onChange(next === template ? rest : [...rest, { date: d.iso, timeBand: band, status: next }]);
  };
  return (
    <div className="updays-scroll">
      <div className="ovr-strip">
        <div className="ovr-col ovr-labels" aria-hidden="true">
          <span className="updays-dow">&nbsp;</span>
          <span className="updays-date">&nbsp;</span>
          {UPCOMING_BANDS.map((b) => <span key={b} className="ovr-band">{b[0]}</span>)}
        </div>
        {upcoming.map((d, i) => {
          const label = d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return (
            <div key={d.iso} className={"ovr-col" + (i === 0 ? " today" : "")}>
              <span className="updays-dow">
                {d.date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="updays-date">{d.date.getDate()}</span>
              {UPCOMING_BANDS.map((band) => {
                const v = d.bands[band] ?? 0;
                const tweaked = !!d.tweaked[band];
                return (
                  <button
                    key={band}
                    type="button"
                    className={"ovr-cell" + (v === 2 ? " on" : v === 1 ? " half" : "") + (tweaked ? " tweaked" : "")}
                    title={`${label} ${BAND_WORD[band]}: ${STATUS_TITLE[v]}${tweaked ? " (tweaked for this date)" : ""}`}
                    aria-label={`${label} ${BAND_WORD[band]}: ${STATUS_TITLE[v]}`}
                    onClick={() => cycle(d, band)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UpcomingDatesStrip;
