import { useCallback, useEffect, useState } from 'react';
import { fetchStation } from '../api/client';
import type { StationDetail } from '../api/types';

export function useStationDetail(stationId: number | null) {
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStation(id);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (stationId == null) {
      setDetail(null);
      return;
    }
    load(stationId);
  }, [stationId, load]);

  return { detail, loading, error, reload: () => stationId != null && load(stationId) };
}
