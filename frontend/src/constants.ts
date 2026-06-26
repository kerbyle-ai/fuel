import type { FuelCode } from './api/types';

export const FUEL_TYPES: { code: FuelCode; label: string }[] = [
  { code: 'ai92', label: 'АИ-92' },
  { code: 'ai95', label: 'АИ-95' },
  { code: 'ai98', label: 'АИ-98' },
  { code: 'dt', label: 'ДТ' },
  { code: 'gas', label: 'Газ' },
];

export const MAP_DEFAULTS = {
  center: [55.7558, 37.6173] as [number, number],
  zoom: 11,
  minZoom: 4,
  maxZoom: 18,
  bounds: [
    [41.0, 19.0],
    [82.0, 180.0],
  ] as [[number, number], [number, number]],
};

/** Moscow bbox for initial fetch before Leaflet emits viewport bounds */
export const DEFAULT_FETCH_BBOX = {
  south: 55.5,
  west: 37.3,
  north: 56.0,
  east: 37.9,
} as const;

export const STATUS_LABELS: Record<string, string> = {
  available: 'Есть',
  unavailable: 'Нет',
  unknown: 'Неизвестно',
};

export const QUEUE_LABELS: Record<string, string> = {
  none: 'Нет',
  short: 'Короткая',
  long: 'Длинная',
  unknown: 'Неизвестно',
};

export const STALE_HOURS = 3;

/** Ссылка на донат (CloudTips, Яндекс Чаевые и т.п.). Пусто — баннер скрыт. */
export const DONATION_URL = (import.meta.env.VITE_DONATION_URL ?? '').trim();
