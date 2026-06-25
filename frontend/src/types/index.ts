/* ============================================================
   RallyPoint — shared domain types
   ============================================================ */

export type Sport = "Tennis" | "Pickleball";
export type SportKey = "tennis" | "pickleball";
export type NTRP = "2.0" | "2.5" | "3.0" | "3.5" | "4.0" | "4.5" | "5.0";

/** A user's profile for one sport (from /me sportProfiles). */
export interface UserSportProfile {
  sport: Sport;
  ntrp: string;
  availability?: string | null;
  homeCourtId?: number | null;
  homeCourt?: string | null; // court slug
  homeCourtName?: string | null;
}

/** One availability cell from /me (day_of_week 0-6, time_band MORN/AFT/EVE, status 0-2). */
export interface AvailabilitySlotDTO {
  dayOfWeek: number;
  timeBand: string;
  status: number;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email?: string;
  emailVerified?: boolean;
  handle?: string;
  ntrp?: NTRP;
  primarySport?: Sport;
  location?: string;
  lat?: number;
  lng?: number;
  bio?: string;
  joined?: string;
  avatarColor?: string;
  avatarFg?: string;
  sportProfiles?: UserSportProfile[];
  availability?: AvailabilitySlotDTO[];
}

export interface SportProfile {
  ntrp: NTRP;
  matchScore: number;
  availability: string;
  reason: string;
}

export interface Player {
  id: number;
  name: string;
  initials: string;
  color?: string;
  fg?: string;
  location: string;
  distance: string;
  online: boolean;
  tennis?: SportProfile;
  pickleball?: SportProfile;
  // Backend-projected fields (the API flattens the active sport's profile).
  sport?: Sport;
  ntrp?: string;
  availability?: string;
  availabilitySlots?: AvailabilitySlotDTO[];
  matchScore?: number;
  matchTier?: "great" | "good" | "fair";
  matchReasons?: string[];
  reason?: string;
  saved?: boolean;
}

export type SessionStatus = "confirmed" | "pending" | "requested" | "completed";
export type SessionBucket = "upcoming" | "requests" | "past";

export interface Session {
  id: number;
  bucket: SessionBucket;
  status: SessionStatus;
  opp: string;
  oppHandle?: string;
  sport: Sport;
  court: string;
  courtMiles?: string;
  day: string;
  month: string;
  weekday: string;
  time: string;
  next?: boolean;
  sentByMe?: boolean;
  note?: string;
}


export type IconName =
  | "search"
  | "pin"
  | "clock"
  | "trophy"
  | "bolt"
  | "sparkles"
  | "chevron"
  | "chevron-r"
  | "send"
  | "bookmark"
  | "check"
  | "calendar"
  | "mail"
  | "lock"
  | "user"
  | "eye"
  | "eye-off"
  | "google"
  | "edit"
  | "plus"
  | "image"
  | "heart"
  | "message"
  | "share"
  | "more"
  | "settings"
  | "users"
  | "flame"
  | "stats"
  | "x"
  | "logout"
  | "bell"
  | "sun"
  | "moon"
  | "menu";

export type NavId = "find" | "matches" | "courts";
