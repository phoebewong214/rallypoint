/* ============================================================
   Skeleton — shimmer placeholder building block.
   Compose into page-specific layouts (e.g. PlayerCardSkeleton).
   ============================================================ */
import React from "react";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  radius = 6,
  className = "",
  style,
}) => (
  <span
    aria-hidden
    className={"skeleton " + className}
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

/* Inline spinner — used in submit buttons during async actions.
   Renders as a 14px circle that spins; inherits currentColor. */
export const Spinner: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <span
    className="spinner-ring"
    role="status"
    aria-label="Loading"
    style={{ width: size, height: size }}
  />
);

/* Player card-shaped skeleton — matches the collapsed FindPartner card:
   header, AI-match strip, action row. */
export const PlayerCardSkeleton: React.FC = () => (
  <div className="skeleton-card" aria-busy="true" aria-label="Loading player">
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <Skeleton width={54} height={54} radius="50%" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton width="65%" height={18} />
        <div style={{ display: "flex", gap: 6 }}>
          <Skeleton width={70} height={22} radius={6} />
          <Skeleton width={90} height={22} radius={6} />
        </div>
      </div>
    </div>
    <Skeleton width="100%" height={40} radius={10} />
    <div style={{ display: "flex", gap: 8 }}>
      <Skeleton width="100%" height={44} radius={8} />
      <Skeleton width={44} height={44} radius={8} />
    </div>
  </div>
);
