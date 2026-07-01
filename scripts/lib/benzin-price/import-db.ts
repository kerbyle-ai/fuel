import { createHash } from 'crypto';
import type { BenzinPriceRow, BenzinStationDetail } from './types.js';
import { BENZIN_REGIONS } from './regions.js';

const BENZIN_OSM_ID_OFFSET = 2_000_000_000;

/** Stable negative osm_id for benzin-price stations (fits PostgreSQL BIGINT). */
export function benzinOsmId(benzinStationId: number): number {
  return -(BENZIN_OSM_ID_OFFSET + benzinStationId);
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/№\s*/g, ' ')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface DbStation {
  id: number;
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  osm_id: number | null;
}

export async function findStationByBenzinId(
  benzinStationId: number
): Promise<number | null> {
  const { query } = await import('../db.js');

  const { rows: linked } = await query<{ station_id: number }>(
    'SELECT station_id FROM benzin_station_links WHERE benzin_id = $1 LIMIT 1',
    [benzinStationId]
  );
  if (linked[0]) return linked[0].station_id;

  const osmId = benzinOsmId(benzinStationId);
  const { rows } = await query<{ id: number }>(
    'SELECT id FROM stations WHERE osm_id = $1 LIMIT 1',
    [osmId]
  );
  return rows[0]?.id ?? null;
}

export async function linkBenzinStation(
  benzinStationId: number,
  stationId: number
): Promise<void> {
  const { query } = await import('../db.js');
  await query(
    `INSERT INTO benzin_station_links (benzin_id, station_id)
     VALUES ($1, $2)
     ON CONFLICT (benzin_id) DO UPDATE SET station_id = EXCLUDED.station_id`,
    [benzinStationId, stationId]
  );
}

function extractBrand(name: string): string | null {
  const first = name.split(/\s+/)[0]?.trim();
  if (!first || first.length < 2) return null;
  return normalizeName(first);
}

export async function upsertBenzinStation(detail: BenzinStationDetail): Promise<number> {
  const { query } = await import('../db.js');
  const osmId = benzinOsmId(detail.benzinStationId);

  if (detail.lat === null || detail.lng === null) {
    throw new Error(`Station ${detail.benzinStationId} has no coordinates`);
  }

  const { rows } = await query<{ id: number }>(
    `INSERT INTO stations (name, brand, lat, lng, location, osm_id, region)
     VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5, $6)
     ON CONFLICT (osm_id) DO UPDATE SET
       name = EXCLUDED.name,
       brand = COALESCE(EXCLUDED.brand, stations.brand),
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       location = EXCLUDED.location,
       region = COALESCE(EXCLUDED.region, stations.region)
     RETURNING id`,
    [
      detail.name,
      detail.brand,
      detail.lat,
      detail.lng,
      osmId,
      detail.regionId
        ? (BENZIN_REGIONS.find((r) => r.id === detail.regionId)?.name ?? String(detail.regionId))
        : null,
    ]
  );
  return rows[0].id;
}

export async function matchStationByProximity(
  row: BenzinPriceRow,
  detail: BenzinStationDetail | null,
  radiusMeters = 250
): Promise<number | null> {
  const { query } = await import('../db.js');

  const brand =
    detail?.brand != null ? normalizeName(detail.brand) : extractBrand(row.stationName);
  const brandPattern = brand ? `%${brand}%` : null;

  if (detail?.lat != null && detail?.lng != null) {
    const sqlWithBrand = `SELECT id,
              ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS dist
       FROM stations
       WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY
         CASE WHEN brand ILIKE $4 OR name ILIKE $5 THEN 0 ELSE 1 END,
         dist ASC
       LIMIT 1`;

    const sqlNoBrand = `SELECT id,
              ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS dist
       FROM stations
       WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY dist ASC
       LIMIT 1`;

    const { rows } = brandPattern
      ? await query<{ id: number; dist: number }>(sqlWithBrand, [
          detail.lng,
          detail.lat,
          radiusMeters,
          brandPattern,
          brandPattern,
        ])
      : await query<{ id: number; dist: number }>(sqlNoBrand, [
          detail.lng,
          detail.lat,
          radiusMeters,
        ]);
    if (rows[0]) return rows[0].id;
  }

  if (!row.address && !row.stationName) return null;

  const norm = normalizeName(row.stationName);
  const regionName = BENZIN_REGIONS.find((r) => r.id === row.regionId)?.name ?? '';
  const regionCode = String(row.regionId);
  const namePrefix = row.stationName.split(/\s+/)[0] ?? row.stationName;
  const { rows: candidates } = await query<DbStation>(
    `SELECT id, name, brand, lat, lng, osm_id
     FROM stations
     WHERE region ILIKE $2
        OR region = $4
        OR name ILIKE $3
        OR brand ILIKE $3
     LIMIT 300`,
    [regionName, `%${regionName}%`, `%${namePrefix}%`, regionCode]
  );

  let best: { id: number; score: number } | null = null;
  for (const c of candidates) {
    const cNorm = normalizeName(c.name);
    const cBrand = c.brand ? normalizeName(c.brand) : '';
    let score = 0;
    if (cNorm === norm) score += 10;
    else if (cNorm.includes(norm) || norm.includes(cNorm)) score += 6;
    if (brand && cBrand && (cBrand.includes(brand) || brand.includes(cBrand))) score += 4;
    if (row.address) {
      const addrNorm = normalizeName(row.address);
      if (addrNorm.length > 8 && cNorm.includes(addrNorm.slice(0, 12))) score += 3;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }

  return best?.id ?? null;
}

/** Looks like a normal browser fingerprint (32 hex), stable per external station id. */
function syntheticFingerprint(benzinStationId: number): string {
  return createHash('sha256').update(`fm:${benzinStationId}`).digest('hex').slice(0, 32);
}

export async function importPriceReport(
  stationId: number,
  row: BenzinPriceRow
): Promise<'inserted' | 'skipped'> {
  const { query } = await import('../db.js');

  const { rows: fuelRows } = await query<{ id: number }>(
    'SELECT id FROM fuel_types WHERE code = $1',
    [row.fuelCode]
  );
  if (fuelRows.length === 0) return 'skipped';

  const fuelTypeId = fuelRows[0].id;
  const fingerprint = syntheticFingerprint(row.benzinStationId);

  const { rows: dup } = await query<{ id: number }>(
    `SELECT id FROM reports
     WHERE station_id = $1 AND fuel_type_id = $2
       AND user_fingerprint = $3
       AND created_at > NOW() - INTERVAL '6 hours'
       AND price IS NOT DISTINCT FROM $4
     LIMIT 1`,
    [stationId, fuelTypeId, fingerprint, row.price]
  );
  if (dup.length > 0) return 'skipped';

  await query(
    `INSERT INTO users (fingerprint, reputation_score, reports_count)
     VALUES ($1, 0, 0)
     ON CONFLICT (fingerprint) DO NOTHING`,
    [fingerprint]
  );

  await query(
    `INSERT INTO reports (
       station_id, fuel_type_id, status, price, queue_status,
       comment, user_fingerprint, weight
     ) VALUES ($1, $2, 'available', $3, 'unknown', NULL, $4, 1.0)`,
    [stationId, fuelTypeId, row.price, fingerprint]
  );

  return 'inserted';
}
