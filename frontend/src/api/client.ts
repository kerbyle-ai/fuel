import type {

  CreateReportPayload,

  FuelCode,

  FuelStatus,

  ReportHistoryItem,

  ReportStatus,

  SearchResult,

  StationDetail,

  StationSummary,

} from './types';

import { getUserFingerprint } from '../utils/fingerprint';



const BASE = '/api';

const FINGERPRINT_HEADER = 'x-user-fingerprint';



interface BackendFuelStatus {

  fuel_type: FuelCode;

  fuel_type_name: string;

  status: ReportStatus;

  price: number | null;

  queue_status: string | null;

  limit_liters: number | null;

  stale: boolean;

  report_count: number;

  last_report_at: string | null;

}



interface BackendStation {

  id: number;

  name: string;

  brand: string | null;

  lat: number;

  lng: number;

  region: string | null;

  fuel_status: BackendFuelStatus[];

}



interface BackendHistoryItem {

  id: number;

  fuel_type: FuelCode;

  fuel_type_name: string;

  status: ReportStatus;

  price: number | null;

  queue_status: string | null;

  limit_liters: number | null;

  comment: string | null;

  created_at: string;

}



function defaultHeaders(): HeadersInit {

  return {

    'Content-Type': 'application/json',

    [FINGERPRINT_HEADER]: getUserFingerprint(),

  };

}



async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...defaultHeaders(), ...init?.headers },
    ...init,
  });



  if (!res.ok) {

    let message = `HTTP ${res.status}`;

    try {

      const body = (await res.json()) as { error?: string; message?: string };

      message = body.error || body.message || message;

    } catch {

      /* ignore */

    }

    throw new Error(message);

  }



  return res.json() as Promise<T>;

}



function mapFuelStatus(f: BackendFuelStatus): FuelStatus {

  return {

    fuel_code: f.fuel_type,

    fuel_name: f.fuel_type_name,

    status: f.status,

    price: f.price,

    queue_status: f.queue_status as FuelStatus['queue_status'],

    limit_liters: f.limit_liters,

    reported_at: f.last_report_at,

    is_stale: f.stale,

  };

}



function deriveMarkerStatus(fuels: FuelStatus[], filterCodes?: FuelCode[]): {

  status: ReportStatus;

  is_stale: boolean;

} {

  const relevant = filterCodes?.length

    ? fuels.filter((f) => filterCodes.includes(f.fuel_code))

    : fuels;



  const reported = relevant.filter((f) => f.reported_at != null);



  if (reported.length === 0) {

    return { status: 'unknown', is_stale: true };

  }



  const hasAvailable = reported.some((f) => f.status === 'available');

  const hasUnavailable = reported.some((f) => f.status === 'unavailable');



  let status: ReportStatus;

  if (hasAvailable) {

    status = 'available';

  } else if (hasUnavailable) {

    status = 'unavailable';

  } else {

    status = 'unknown';

  }



  return {

    status,

    is_stale: reported.every((f) => f.is_stale),

  };

}



function mapStationSummary(s: BackendStation, filterCodes?: FuelCode[]): StationSummary {

  const fuels = s.fuel_status.map(mapFuelStatus);

  const { status, is_stale } = deriveMarkerStatus(fuels, filterCodes);

  return {

    id: s.id,

    name: s.name,

    brand: s.brand,

    lat: s.lat,

    lng: s.lng,

    region: s.region,

    fuels,

    status,

    is_stale,

  };

}



export interface BboxParams {

  south: number;

  west: number;

  north: number;

  east: number;

  fuelTypes?: FuelCode[];

  hideWithoutFuel?: boolean;

}



export async function fetchStationsInBbox(
  params: BboxParams,
  signal?: AbortSignal
): Promise<StationSummary[]> {
  const bbox = [params.west, params.south, params.east, params.north].join(',');

  const qs = new URLSearchParams({ bbox });

  if (params.fuelTypes?.length) {
    qs.set('fuel_types', params.fuelTypes.join(','));
  }
  if (params.hideWithoutFuel) {
    qs.set('hide_without_fuel', 'true');
  }

  const data = await request<{ stations: BackendStation[] }>(`/stations?${qs}`, { signal });

  return data.stations.map((s) => mapStationSummary(s, params.fuelTypes));
}



export async function fetchStation(id: number): Promise<StationDetail> {

  const data = await request<{

    station: Omit<BackendStation, 'fuel_status'>;

    fuel_status: BackendFuelStatus[];

    reports: BackendHistoryItem[];

  }>(`/stations/${id}`);



  const fuels = data.fuel_status.map(mapFuelStatus);

  const history: ReportHistoryItem[] = data.reports.map((r) => ({

    id: r.id,

    fuel_code: r.fuel_type,

    fuel_name: r.fuel_type_name,

    status: r.status,

    price: r.price,

    queue_status: r.queue_status as ReportHistoryItem['queue_status'],

    limit_liters: r.limit_liters,

    comment: r.comment,

    created_at: r.created_at,

  }));



  return {

    ...data.station,

    fuels,

    history,

  };

}



export async function searchStations(q: string): Promise<SearchResult[]> {

  const qs = new URLSearchParams({ q });

  const data = await request<{ stations: SearchResult[] }>(`/stations/search?${qs}`);

  return data.stations;

}



export interface UserStats {
  reports_count: number;
  reputation: number;
  rank: 'Новичок' | 'Активист' | 'Эксперт';
  weight: number;
}

export async function fetchUserStats(): Promise<UserStats> {
  const data = await request<{ stats: UserStats }>('/users/me/stats');
  return data.stats;
}

export async function createReport(

  payload: CreateReportPayload

): Promise<{ id: number; created_at: string }> {

  const data = await request<{ report: { id: number; created_at: string } }>('/reports', {

    method: 'POST',

    body: JSON.stringify({ ...payload, website: '' }),

  });

  return data.report;

}



export async function fetchNearby(

  lat: number,

  lng: number,

  radius = 5000,

  fuelTypes?: FuelCode[]

): Promise<StationSummary[]> {

  const qs = new URLSearchParams({

    lat: String(lat),

    lng: String(lng),

    radius: String(radius),

  });

  if (fuelTypes?.length) qs.set('fuel_types', fuelTypes.join(','));



  const data = await request<{ stations: BackendStation[] }>(`/stations/nearby?${qs}`);

  return data.stations.map((s) => mapStationSummary(s, fuelTypes));

}


