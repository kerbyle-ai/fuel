import { useEffect, useRef, useState } from 'react';
import { searchStations } from '../../api/client';
import type { SearchResult } from '../../api/types';

interface StationSearchProps {
  onSelect: (station: SearchResult) => void;
}

export function StationSearch({ onSelect }: StationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchStations(query.trim());
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (station: SearchResult) => {
    onSelect(station);
    setQuery(station.name);
    setOpen(false);
  };

  return (
    <div className="station-search" ref={wrapRef}>
      <input
        type="search"
        className="station-search__input"
        placeholder="Поиск АЗС по названию…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && <span className="station-search__hint">Поиск…</span>}
      {open && results.length > 0 && (
        <ul className="station-search__results">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => handleSelect(s)}>
                <strong>{s.name}</strong>
                {s.brand && <span className="muted"> · {s.brand}</span>}
                {s.region && <span className="muted"> · {s.region}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
