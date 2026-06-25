export type FuelCode = 'ai92' | 'ai95' | 'ai98' | 'dt' | 'gas';
export type ReportStatus = 'available' | 'unavailable' | 'unknown';
export type QueueStatus = 'none' | 'short' | 'long' | 'unknown';

export interface FuelStatus {
  fuel_code: FuelCode;
  fuel_name: string;
  status: ReportStatus | null;
  price: number | null;
  queue_status: QueueStatus | null;
  limit_liters: number | null;
  reported_at: string | null;
  is_stale: boolean;
}

export interface StationSummary {
  id: number;
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  region: string | null;
  fuels: FuelStatus[];
  status: ReportStatus;
  is_stale: boolean;
}

export interface ReportHistoryItem {
  id: number;
  fuel_code: FuelCode;
  fuel_name: string;
  status: ReportStatus;
  price: number | null;
  queue_status: QueueStatus | null;
  limit_liters: number | null;
  comment: string | null;
  weight?: number;
  created_at: string;
}

export interface StationDetail extends Omit<StationSummary, 'status' | 'is_stale'> {
  history: ReportHistoryItem[];
}

export interface CreateReportPayload {
  station_id: number;
  fuel_type: FuelCode;
  status: 'available' | 'unavailable';
  price?: number | null;
  queue_status?: QueueStatus;
  limit_liters?: number | null;
  comment?: string | null;
  user_fingerprint: string;
}

export interface SearchResult {
  id: number;
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  region: string | null;
}
