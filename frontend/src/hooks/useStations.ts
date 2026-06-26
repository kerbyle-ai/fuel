import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStationsInBbox } from '../api/client';
import type { FuelCode, StationSummary } from '../api/types';
import { DEFAULT_FETCH_BBOX } from '../constants';

interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface UseStationsOptions {
  fuelTypes: FuelCode[];
  hideWithoutFuel: boolean;
  debounceMs?: number;
}

export function useStations({ fuelTypes, hideWithoutFuel, debounceMs = 400 }: UseStationsOptions) {
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bboxRef = useRef<Bbox | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(
    async (bbox: Bbox) => {
      bboxRef.current = bbox;
      setLoading(true);
      setError(null);

      try {
        const data = await fetchStationsInBbox({
          ...bbox,
          fuelTypes: fuelTypes.length ? fuelTypes : undefined,
          hideWithoutFuel,
        });
        setStations(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        setStations([]);
      } finally {
        setLoading(false);
      }
    },
    [fuelTypes, hideWithoutFuel]
  );

  const onBboxChange = useCallback(
    (bbox: Bbox) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => load(bbox), debounceMs);
    },
    [load, debounceMs]
  );

  const refresh = useCallback(() => {
    if (bboxRef.current) load(bboxRef.current);
  }, [load]);

  useEffect(() => {
    load(bboxRef.current ?? DEFAULT_FETCH_BBOX);
  }, [load]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { stations, loading, error, onBboxChange, refresh };
}
