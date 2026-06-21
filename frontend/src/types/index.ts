/* ============================================================
   RallyPoint — shared domain types
   ============================================================ */

export type Sport = "Tennis" | "Pickleball";
export type SportKey = "tennis" | "pickleball";
export type NTRP = "2.0" | "2.5" | "3.0" | "3.5" | "4.0" | "4.5" | "5.0";

export interface User {
  id: string;
  name: string;
  initials: string;
  email?: string;
  emailVerified?: boolean;
  handle?: string;
  ntrp?: NTRP;
  primarySport?: Sport;
  secondarySport?: Sport;
  location?: string;
  bio?: string;
  joined?: string;
  avatarColor?: string;
  avatarFg?: string;
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
  matchScore?: number;
  reason?: string;
}

export type SessionStatus = "confirmed" | "pending" | "requested" | "completed";
export type SessionBucket = "upcoming" | "requests" | "past";
export type MatchResult = "W" | "L";

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

export type CourtActivity = "busy" | "open" | "quiet";

export interface Court {
  id: string;
  name: string;
  addr: string;
  sports: Sport[];
  primary: SportKey;
  distance: string;
  walk: string;
  courtCount: number;
  surface: string;
  lights: boolean;
  activity: { state: CourtActivity; pct: number; label: string };
  nextSlot: string;
  fav: boolean;
  pin: { x: number; y: number; state: CourtActivity };
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

export type NavId = "find" | "matches" | "courts" | "schedule";
