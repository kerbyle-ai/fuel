import { useCallback, useState } from 'react';

type GeoState = {
  lat: number;
  lng: number;
} | null;

export function useGeolocation() {
  const [position, setPosition] = useState<GeoState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Доступ к геолокации запрещён'
            : 'Не удалось определить местоположение'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { position, loading, error, locate };
}
