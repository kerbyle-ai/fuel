-- Persistent mapping benzin-price.ru station id → fuel-map station
CREATE TABLE IF NOT EXISTS benzin_station_links (
  benzin_id INTEGER PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_benzin_links_station ON benzin_station_links (station_id);
