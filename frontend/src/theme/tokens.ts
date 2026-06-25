/* Type-safe handles for the CSS custom properties defined in rally-shared.css.
 *
 * Reference `token.card` instead of a raw "var(--card)" string. A typo or an
 * undefined token — like the non-existent `var(--bg-1)` that once shipped a
 * fully transparent modal to production — becomes a COMPILE error here, not a
 * silently broken style at runtime. Keep this in sync with the :root block. */
export const token = {
  bg: "var(--bg)",
  bg2: "var(--bg-2)",
  bg3: "var(--bg-3)",
  card: "var(--card)",
  cardHover: "var(--card-hover)",
  border: "var(--border)",
  borderBright: "var(--border-bright)",
  text: "var(--text)",
  textDim: "var(--text-dim)",
  textLow: "var(--text-low)",
  green: "var(--green)",
  greenDeep: "var(--green-deep)",
  greenSoft: "var(--green-soft)",
  greenInk: "var(--green-ink)",
  greenText: "var(--green-text)",
  greenGlow: "var(--green-glow)",
  blue: "var(--blue)",
  blueDeep: "var(--blue-deep)",
  blueGhost: "var(--blue-ghost)",
  blueBorder: "var(--blue-border)",
  amber: "var(--amber)",
  amberGhost: "var(--amber-ghost)",
  rose: "var(--rose)",
  roseGhost: "var(--rose-ghost)",
  mono: "var(--mono)",
  sans: "var(--sans)",
  navBg: "var(--nav-bg)",
  navHeight: "var(--nav-height)",
  radiusBtn: "var(--radius-btn)",
  radiusCard: "var(--radius-card)",
} as const;

export type TokenName = keyof typeof token;
