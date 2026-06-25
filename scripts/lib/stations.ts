import type { OverpassElement } from './overpass.js';

export interface StationInput {
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  osm_id: number;
  region: string | null;
}

const BRAND_TAG_KEYS = ['brand', 'operator', 'network', 'company'] as const;

const REGION_TAG_KEYS = [
  'addr:state',
  'addr:region',
  'is_in:state',
  'addr:province',
  'addr:county',
] as const;

/** Approximate Moscow city bounds for region fallback */
const MOSCOW_CITY = { minLat: 55.49, maxLat: 55.95, minLng: 37.32, maxLng: 37.97 };
/** Moscow Oblast (wider bbox around Moscow) */
const MOSCOW_OBLAST = { minLat: 54.8, maxLat: 56.9, minLng: 35.1, maxLng: 40.2 };

function elementCoords(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function inBounds(
  lat: number,
  lng: number,
  b: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

export function extractBrand(tags: Record<string, string>): string | null {
  for (const key of BRAND_TAG_KEYS) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function extractRegion(
  tags: Record<string, string>,
  lat: number,
  lng: number
): string | null {
  for (const key of REGION_TAG_KEYS) {
    const value = tags[key]?.trim();
    if (value) return value;
  }

  if (inBounds(lat, lng, MOSCOW_CITY)) return 'Москва';
  if (inBounds(lat, lng, MOSCOW_OBLAST)) return 'Московская область';

  const city = tags['addr:city']?.trim();
  if (city) return city;

  return null;
}

export function extractName(tags: Record<string, string>, brand: string | null): string {
  const name = tags.name?.trim();
  if (name) return name;
  if (brand) return brand;
  const operator = tags.operator?.trim();
  if (operator) return operator;
  return 'АЗС';
}

/** Encode OSM element id as signed bigint-safe integer (fits PostgreSQL BIGINT). */
export function encodeOsmId(type: OverpassElement['type'], id: number): number {
  if (type === 'node') return id;
  if (type === 'way') return -id;
  return -(id + 1_000_000_000);
}

export function parseOverpassElements(elements: OverpassElement[]): StationInput[] {
  const stations: StationInput[] = [];

  for (const el of elements) {
    if (el.type !== 'node' && el.type !== 'way' && el.type !== 'relation') continue;

    const coords = elementCoords(el);
    if (!coords) continue;

    const tags = el.tags ?? {};
    const brand = extractBrand(tags);
    const name = extractName(tags, brand);
    const region = extractRegion(tags, coords.lat, coords.lng);
    const osm_id = encodeOsmId(el.type, el.id);

    stations.push({
      name,
      brand,
      lat: coords.lat,
      lng: coords.lng,
      osm_id,
      region,
    });
  }

  return stations;
}

/** Haversine distance in meters */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Keep one station per ~50m cluster. Prefers entries with brand/name over generic "АЗС".
 */
export function deduplicateStations(
  stations: StationInput[],
  radiusMeters = 50
): StationInput[] {
  const sorted = [...stations].sort((a, b) => a.osm_id - b.osm_id);
  const kept: StationInput[] = [];

  function score(s: StationInput): number {
    let n = 0;
    if (s.brand) n += 2;
    if (s.name !== 'АЗС') n += 1;
    if (s.region) n += 1;
    return n;
  }

  for (const candidate of sorted) {
    let mergeIndex = -1;

    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i];
      if (
        distanceMeters(candidate.lat, candidate.lng, existing.lat, existing.lng) <=
        radiusMeters
      ) {
        mergeIndex = i;
        break;
      }
    }

    if (mergeIndex === -1) {
      kept.push(candidate);
      continue;
    }

    if (score(candidate) > score(kept[mergeIndex])) {
      kept[mergeIndex] = candidate;
    }
  }

  return kept;
}

export async function insertStationsBatch(
  stations: StationInput[],
  options: {
    batchSize?: number;
    clearExisting?: boolean;
    onProgress?: (inserted: number, total: number) => void;
  } = {}
): Promise<number> {
  const { batchSize = 500, clearExisting = false, onProgress } = options;
  const { getPool } = await import('./db.js');
  const pool = getPool();

  if (clearExisting) {
    console.log('Clearing existing stations...');
    await pool.query('TRUNCATE stations RESTART IDENTITY CASCADE');
  }

  let inserted = 0;

  for (let i = 0; i < stations.length; i += batchSize) {
    const batch = stations.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((s, idx) => {
      const base = idx * 6;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, ST_SetSRID(ST_MakePoint($${base + 4}, $${base + 3}), 4326)::geography, $${base + 5}, $${base + 6})`
      );
      values.push(s.name, s.brand, s.lat, s.lng, s.osm_id, s.region);
    });

    const sql = `
      INSERT INTO stations (name, brand, lat, lng, location, osm_id, region)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (osm_id) DO UPDATE SET
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        location = EXCLUDED.location,
        region = COALESCE(EXCLUDED.region, stations.region)
    `;

    const result = await pool.query(sql, values);
    inserted += result.rowCount ?? batch.length;
    onProgress?.(Math.min(i + batch.length, stations.length), stations.length);
  }

  return inserted;
}
