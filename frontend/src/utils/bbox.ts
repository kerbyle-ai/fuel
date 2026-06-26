export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Leaflet sometimes emits near-zero bounds before layout settles (Telegram WebApp). */
const DEGENERATE_SPAN = 0.002;

export function isDegenerateBbox(bbox: Bbox): boolean {
  const latSpan = bbox.north - bbox.south;
  const lngSpan = bbox.east - bbox.west;
  return (
    !Number.isFinite(latSpan) ||
    !Number.isFinite(lngSpan) ||
    latSpan <= 0 ||
    lngSpan <= 0 ||
    latSpan < DEGENERATE_SPAN ||
    lngSpan < DEGENERATE_SPAN
  );
}

export function expandDegenerateBbox(bbox: Bbox, fallback: Bbox): Bbox {
  if (!isDegenerateBbox(bbox)) return bbox;

  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  const latHalf = Math.max((bbox.north - bbox.south) / 2, (fallback.north - fallback.south) / 2);
  const lngHalf = Math.max((bbox.east - bbox.west) / 2, (fallback.east - fallback.west) / 2);

  return {
    south: centerLat - latHalf,
    north: centerLat + latHalf,
    west: centerLng - lngHalf,
    east: centerLng + lngHalf,
  };
}
