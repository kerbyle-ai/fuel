import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStationsInBbox } from '../api/client';
import type { FuelCode, StationSummary } from '../api/types';
import { DEFAULT_FETCH_BBOX } from '../constants';
import { expandDegenerateBbox, type Bbox } from '../utils/bbox';

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
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (bbox: Bbox) => {
      const normalized = expandDegenerateBbox(bbox, DEFAULT_FETCH_BBOX);
      bboxRef.current = normalized;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestSeqRef.current;

      setLoading(true);
      setError(null);

      try {
        const data = await fetchStationsInBbox(
          {
            ...normalized,
            fuelTypes: fuelTypes.length ? fuelTypes : undefined,
            hideWithoutFuel,
          },
          controller.signal
        );

        if (requestId !== requestSeqRef.current) return;
        setStations(data);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (requestId !== requestSeqRef.current) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        setStations([]);
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
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

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    []
  );

  return { stations, loading, error, onBboxChange, refresh };
}
