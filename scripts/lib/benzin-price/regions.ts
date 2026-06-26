import type { BenzinRegion } from './types.js';

/**
 * Common benzin-price.ru region_id values (KLADR-style).
 * Full list: https://www.benzin-price.ru/zapravka.php?page=region
 */
export const BENZIN_REGIONS: BenzinRegion[] = [
  { id: 77, name: 'Москва' },
  { id: 50, name: 'Московская область' },
  { id: 78, name: 'Санкт-Петербург' },
  { id: 47, name: 'Ленинградская область' },
  { id: 23, name: 'Краснодарский край' },
  { id: 61, name: 'Ростовская область' },
  { id: 36, name: 'Воронежская область' },
  { id: 52, name: 'Нижегородская область' },
  { id: 16, name: 'Республика Татарстан' },
  { id: 63, name: 'Самарская область' },
  { id: 66, name: 'Свердловская область' },
  { id: 54, name: 'Новосибирская область' },
  { id: 24, name: 'Красноярский край' },
  { id: 59, name: 'Пермский край' },
  { id: 2, name: 'Республика Башкортостан' },
  { id: 34, name: 'Волгоградская область' },
  { id: 25, name: 'Приморский край' },
  { id: 27, name: 'Хабаровский край' },
  { id: 777, name: 'Россия (все)' },
];

export function parseRegionIdsArg(arg: string | undefined): number[] {
  if (!arg || arg === 'all') {
    return BENZIN_REGIONS.filter((r) => r.id !== 777).map((r) => r.id);
  }
  return arg
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}
