import type { FuelCode, QueueStatus, ReportStatus } from './config.js';

export interface FuelTypeRow {
  id: number;
  code: string;
  name: string;
}

export interface StationRow {
  id: number;
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  region: string | null;
  distance_m?: number;
}

export interface ReportRow {
  id: number;
  station_id: number;
  fuel_type_id: number;
  fuel_code: string;
  fuel_name: string;
  status: ReportStatus;
  price: string | null;
  queue_status: QueueStatus;
  limit_liters: number | null;
  comment: string | null;
  weight: string;
  created_at: Date;
}

export interface AggregatedFuelStatus {
  fuel_type: FuelCode;
  fuel_type_name: string;
  status: ReportStatus;
  price: number | null;
  queue_status: QueueStatus;
  limit_liters: number | null;
  stale: boolean;
  report_count: number;
  last_report_at: string | null;
}

export interface StationWithFuel {
  id: number;
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  region: string | null;
  distance_m?: number;
  fuel_status: AggregatedFuelStatus[];
}

export interface ReportHistoryItem {
  id: number;
  fuel_type: FuelCode;
  fuel_type_name: string;
  status: ReportStatus;
  price: number | null;
  queue_status: QueueStatus;
  limit_liters: number | null;
  comment: string | null;
  stale: boolean;
  created_at: string;
}
