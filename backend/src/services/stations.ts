import { FUEL_TYPES } from '../config.js';
import { query } from '../db.js';
import type { FuelTypeRow, ReportRow, StationRow, StationWithFuel } from '../types.js';
import {
  aggregateFuelReports,
  groupReportsByFuelType,
} from './aggregation.js';

function parseBbox(bbox: string): [number, number, number, number] | null {
  const parts = bbox.split(',').map((v) => Number(v.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng >= maxLng || minLat >= maxLat) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function parseFuelTypes(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null;
  const codes = raw.split(',').map((c) => c.trim()).filter(Boolean);
  const valid = new Set(FUEL_TYPES.map((f) => f.code));
  if (codes.some((c) => !valid.has(c as (typeof FUEL_TYPES)[number]['code']))) {
    return null;
  }
  return codes;
}

async function loadFuelTypes(): Promise<FuelTypeRow[]> {
  const { rows } = await query<FuelTypeRow>(
    'SELECT id, code, name FROM fuel_types ORDER BY id'
  );
  return rows;
}

async function loadReportsForStations(
  stationIds: number[],
  fuelTypeIds?: number[]
): Promise<Map<number, ReportRow[]>> {
  if (stationIds.length === 0) return new Map();

  const params: unknown[] = [stationIds];
  let fuelFilter = '';
  if (fuelTypeIds && fuelTypeIds.length > 0) {
    fuelFilter = 'AND r.fuel_type_id = ANY($2::int[])';
    params.push(fuelTypeIds);
  }

  const { rows } = await query<ReportRow>(
    `SELECT r.id, r.station_id, r.fuel_type_id, ft.code AS fuel_code, ft.name AS fuel_name,
            r.status, r.price::text, r.queue_status, r.limit_liters, r.comment,
            r.weight::text, r.created_at
     FROM reports r
     JOIN fuel_types ft ON ft.id = r.fuel_type_id
     WHERE r.station_id = ANY($1::int[])
       AND r.created_at > NOW() - INTERVAL '7 days'
       ${fuelFilter}
     ORDER BY r.created_at DESC`,
    params
  );

  const byStation = new Map<number, ReportRow[]>();
  for (const row of rows) {
    const list = byStation.get(row.station_id) ?? [];
    list.push(row);
    byStation.set(row.station_id, list);
  }
  return byStation;
}

function buildFuelStatus(
  stationReports: ReportRow[],
  fuelTypes: FuelTypeRow[],
  filterCodes: string[] | null
): StationWithFuel['fuel_status'] {
  const groups = groupReportsByFuelType(stationReports);
  const selected = filterCodes
    ? fuelTypes.filter((ft) => filterCodes.includes(ft.code))
    : fuelTypes;

  return selected.map((ft) => {
    const group = groups.get(ft.code);
    return aggregateFuelReports(ft.code, ft.name, group?.reports ?? []);
  });
}

function stationMatchesHideWithoutFuel(
  fuelStatus: StationWithFuel['fuel_status'],
  filterCodes: string[] | null
): boolean {
  if (!filterCodes || filterCodes.length === 0) return true;
  const relevant = fuelStatus.filter((f) => filterCodes.includes(f.fuel_type));
  return relevant.some((f) => f.report_count > 0);
}

function stationMatchesHideUnavailable(
  fuelStatus: StationWithFuel['fuel_status'],
  filterCodes: string[] | null,
  hideUnavailable: boolean
): boolean {
  if (!hideUnavailable) return true;
  const relevant = filterCodes
    ? fuelStatus.filter((f) => filterCodes.includes(f.fuel_type))
    : fuelStatus;
  if (relevant.length === 0) return true;
  return relevant.some((f) => f.status === 'available');
}

export async function listStationsInBbox(options: {
  bbox: string;
  fuelTypes?: string;
  hideUnavailable?: boolean;
  hideWithoutFuel?: boolean;
}): Promise<StationWithFuel[]> {
  const parsed = parseBbox(options.bbox);
  if (!parsed) {
    throw new Error('INVALID_BBOX');
  }

  const filterCodes = parseFuelTypes(options.fuelTypes);
  if (options.fuelTypes && filterCodes === null) {
    throw new Error('INVALID_FUEL_TYPES');
  }

  const [minLng, minLat, maxLng, maxLat] = parsed;
  const { rows: stations } = await query<StationRow>(
    `SELECT id, name, brand, lat, lng, region
     FROM stations
     WHERE lat BETWEEN $2 AND $4
       AND lng BETWEEN $1 AND $3
     ORDER BY id
     LIMIT 5000`,
    [minLng, minLat, maxLng, maxLat]
  );

  const fuelTypes = await loadFuelTypes();
  const fuelTypeIds = filterCodes
    ? fuelTypes.filter((ft) => filterCodes.includes(ft.code)).map((ft) => ft.id)
    : undefined;

  const reportsByStation = await loadReportsForStations(
    stations.map((s) => s.id),
    fuelTypeIds
  );

  const hideUnavailable = options.hideUnavailable === true;
  const hideWithoutFuel = options.hideWithoutFuel === true;

  return stations
    .map((station) => {
      const fuel_status = buildFuelStatus(
        reportsByStation.get(station.id) ?? [],
        fuelTypes,
        filterCodes
      );
      return { ...station, fuel_status };
    })
    .filter((station) => {
      if (hideWithoutFuel && !stationMatchesHideWithoutFuel(station.fuel_status, filterCodes)) {
        return false;
      }
      return stationMatchesHideUnavailable(station.fuel_status, filterCodes, hideUnavailable);
    });
}

export async function findNearbyStations(options: {
  lat: number;
  lng: number;
  radius: number;
  fuelTypes?: string;
  hideUnavailable?: boolean;
}): Promise<StationWithFuel[]> {
  if (!Number.isFinite(options.lat) || !Number.isFinite(options.lng)) {
    throw new Error('INVALID_COORDS');
  }
  if (!Number.isFinite(options.radius) || options.radius <= 0 || options.radius > 100000) {
    throw new Error('INVALID_RADIUS');
  }

  const filterCodes = parseFuelTypes(options.fuelTypes);
  if (options.fuelTypes && filterCodes === null) {
    throw new Error('INVALID_FUEL_TYPES');
  }

  const { rows: stations } = await query<StationRow>(
    `SELECT id, name, brand, lat, lng, region,
            ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_m
     FROM stations
     WHERE ST_DWithin(
       location,
       ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
       $3
     )
     ORDER BY distance_m
     LIMIT 100`,
    [options.lat, options.lng, options.radius]
  );

  const fuelTypes = await loadFuelTypes();
  const fuelTypeIds = filterCodes
    ? fuelTypes.filter((ft) => filterCodes.includes(ft.code)).map((ft) => ft.id)
    : undefined;

  const reportsByStation = await loadReportsForStations(
    stations.map((s) => s.id),
    fuelTypeIds
  );

  const hideUnavailable = options.hideUnavailable === true;

  return stations
    .map((station) => {
      const fuel_status = buildFuelStatus(
        reportsByStation.get(station.id) ?? [],
        fuelTypes,
        filterCodes
      );
      return {
        ...station,
        distance_m: station.distance_m ? Math.round(station.distance_m) : undefined,
        fuel_status,
      };
    })
    .filter((station) =>
      stationMatchesHideUnavailable(station.fuel_status, filterCodes, hideUnavailable)
    );
}

export async function getStationById(id: number) {
  const { rows } = await query<StationRow>(
    'SELECT id, name, brand, lat, lng, region FROM stations WHERE id = $1',
    [id]
  );
  if (rows.length === 0) return null;

  const fuelTypes = await loadFuelTypes();
  const reportsByStation = await loadReportsForStations([id]);
  const stationReports = reportsByStation.get(id) ?? [];
  const fuel_status = buildFuelStatus(stationReports, fuelTypes, null);

  const { rows: history } = await query<ReportRow>(
    `SELECT r.id, r.station_id, r.fuel_type_id, ft.code AS fuel_code, ft.name AS fuel_name,
            r.status, r.price::text, r.queue_status, r.limit_liters, r.comment,
            r.weight::text, r.created_at
     FROM reports r
     JOIN fuel_types ft ON ft.id = r.fuel_type_id
     WHERE r.station_id = $1
     ORDER BY r.created_at DESC
     LIMIT 100`,
    [id]
  );

  return {
    station: rows[0],
    fuel_status,
    reports: history,
  };
}

export async function searchStationsByName(q: string, limit = 20): Promise<StationRow[]> {
  const { rows } = await query<StationRow>(
    `SELECT id, name, brand, lat, lng, region
     FROM stations
     WHERE name ILIKE $1 OR brand ILIKE $1
     ORDER BY name
     LIMIT $2`,
    [`%${q}%`, limit]
  );
  return rows;
}
