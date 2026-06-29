/* Curated Chicago neighborhoods with approximate centroid coordinates.
 *
 * RallyPoint is Chicago-only, so a player's "location" is a neighborhood from
 * this list rather than free text. The centroid lets a neighborhood choice also
 * set lat/lng, which drives distance-based matching and court proximity — so
 * picking "Lincoln Park" is enough to get good matches near there. */
export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
}

export const CHICAGO_NEIGHBORHOODS: Neighborhood[] = [
  // North Side
  { name: "Rogers Park", lat: 42.010, lng: -87.667 },
  { name: "Edgewater", lat: 41.987, lng: -87.661 },
  { name: "Andersonville", lat: 41.977, lng: -87.669 },
  { name: "Uptown", lat: 41.966, lng: -87.655 },
  { name: "Lincoln Square", lat: 41.975, lng: -87.689 },
  { name: "Ravenswood", lat: 41.969, lng: -87.674 },
  { name: "North Center", lat: 41.951, lng: -87.679 },
  { name: "Lakeview", lat: 41.943, lng: -87.654 },
  { name: "Wrigleyville", lat: 41.949, lng: -87.656 },
  { name: "Lincoln Park", lat: 41.921, lng: -87.653 },
  { name: "Old Town", lat: 41.910, lng: -87.638 },
  { name: "Gold Coast", lat: 41.906, lng: -87.628 },
  { name: "Streeterville", lat: 41.893, lng: -87.620 },
  { name: "River North", lat: 41.892, lng: -87.634 },
  // Northwest Side
  { name: "Logan Square", lat: 41.929, lng: -87.707 },
  { name: "Avondale", lat: 41.939, lng: -87.711 },
  { name: "Irving Park", lat: 41.953, lng: -87.722 },
  { name: "Albany Park", lat: 41.968, lng: -87.724 },
  { name: "Portage Park", lat: 41.954, lng: -87.766 },
  { name: "Jefferson Park", lat: 41.970, lng: -87.762 },
  { name: "Norwood Park", lat: 41.985, lng: -87.806 },
  { name: "Edison Park", lat: 42.007, lng: -87.814 },
  // West / Near West
  { name: "Wicker Park", lat: 41.908, lng: -87.677 },
  { name: "Bucktown", lat: 41.921, lng: -87.679 },
  { name: "Ukrainian Village", lat: 41.899, lng: -87.686 },
  { name: "Humboldt Park", lat: 41.901, lng: -87.701 },
  { name: "West Town", lat: 41.896, lng: -87.666 },
  { name: "West Loop", lat: 41.882, lng: -87.649 },
  { name: "Near West Side", lat: 41.872, lng: -87.667 },
  { name: "Pilsen", lat: 41.857, lng: -87.656 },
  { name: "Little Village", lat: 41.844, lng: -87.701 },
  { name: "Garfield Park", lat: 41.886, lng: -87.728 },
  { name: "Austin", lat: 41.892, lng: -87.764 },
  // Central
  { name: "The Loop", lat: 41.880, lng: -87.629 },
  { name: "South Loop", lat: 41.867, lng: -87.624 },
  // South Side
  { name: "Bridgeport", lat: 41.838, lng: -87.650 },
  { name: "Back of the Yards", lat: 41.809, lng: -87.666 },
  { name: "Bronzeville", lat: 41.812, lng: -87.617 },
  { name: "Kenwood", lat: 41.809, lng: -87.595 },
  { name: "Hyde Park", lat: 41.794, lng: -87.590 },
  { name: "Woodlawn", lat: 41.780, lng: -87.596 },
  { name: "South Shore", lat: 41.760, lng: -87.575 },
  { name: "Englewood", lat: 41.779, lng: -87.644 },
  { name: "Chatham", lat: 41.741, lng: -87.612 },
  { name: "Beverly", lat: 41.717, lng: -87.668 },
  { name: "Mount Greenwood", lat: 41.695, lng: -87.708 },
  { name: "Pullman", lat: 41.689, lng: -87.609 },
  { name: "Hegewisch", lat: 41.655, lng: -87.546 },
  // Southwest Side
  { name: "Garfield Ridge", lat: 41.797, lng: -87.769 },
  { name: "Archer Heights", lat: 41.811, lng: -87.726 },
  { name: "Clearing", lat: 41.781, lng: -87.770 },
];

/** Nearest neighborhood to a coordinate (for "use my location"). */
export function nearestNeighborhood(lat: number, lng: number): Neighborhood {
  let best = CHICAGO_NEIGHBORHOODS[0];
  let bestD = Infinity;
  for (const n of CHICAGO_NEIGHBORHOODS) {
    const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2; // squared euclidean — fine for nearest
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function findNeighborhood(name?: string | null): Neighborhood | undefined {
  if (!name) return undefined;
  return CHICAGO_NEIGHBORHOODS.find((n) => n.name === name);
}
