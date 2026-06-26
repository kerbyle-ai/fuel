export type BenzinFuelSort = 2 | 4 | 8 | 10;

/** sort param on price.php → fuel-map fuel_types.code */
export const BENZIN_FUEL_SORT: Record<BenzinFuelSort, { code: string; label: string }> = {
  2: { code: 'ai92', label: 'АИ-92' },
  4: { code: 'ai95', label: 'АИ-95' },
  8: { code: 'dt', label: 'ДТ' },
  10: { code: 'gas', label: 'Газ' },
};

export interface BenzinRegion {
  id: number;
  name: string;
}

export interface BenzinPriceRow {
  benzinStationId: number;
  stationName: string;
  address: string | null;
  fuelCode: string;
  price: number;
  priceDate: string | null;
  regionId: number;
}

export interface BenzinStationDetail {
  benzinStationId: number;
  name: string;
  brand: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  regionId: number | null;
}
