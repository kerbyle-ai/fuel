import { createHash } from 'crypto';

export const FUEL_TYPES = [
  { code: 'ai92', name: 'АИ-92' },
  { code: 'ai95', name: 'АИ-95' },
  { code: 'ai98', name: 'АИ-98' },
  { code: 'dt', name: 'ДТ' },
  { code: 'gas', name: 'Газ/LPG' },
] as const;

export const MAP_DEFAULTS = {
  center: [55.7558, 37.6173] as [number, number],
  zoom: 10,
  minZoom: 4,
  maxZoom: 18,
  bounds: [
    [41.0, 19.0],
    [82.0, 180.0],
  ] as [[number, number], [number, number]],
};

export const STALE_HOURS = 3;

export type FuelCode = (typeof FUEL_TYPES)[number]['code'];
export type ReportStatus = 'available' | 'unavailable' | 'unknown';
export type QueueStatus = 'none' | 'short' | 'long' | 'unknown';

/** Report weight = 0.5 + min(reputation/100, 1.5) → range [0.5, 2.0] */
export function computeReportWeight(reputationScore: number): number {
  return 0.5 + Math.min(reputationScore / 100, 1.5);
}

export const FINGERPRINT_HEADER = 'x-user-fingerprint';

export function getClientFingerprint(ip: string, userAgent: string): string {
  return createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').slice(0, 32);
}
