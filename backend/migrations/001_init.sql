-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Fuel types
CREATE TABLE IF NOT EXISTS fuel_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
);

-- Users (for future auth / reputation)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  reputation_score NUMERIC(10, 2) DEFAULT 1.0 NOT NULL,
  reports_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Stations
CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  osm_id BIGINT UNIQUE,
  region VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_stations_region ON stations (region);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  fuel_type_id INTEGER NOT NULL REFERENCES fuel_types(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('available', 'unavailable', 'unknown')),
  price NUMERIC(10, 2),
  queue_status VARCHAR(20) DEFAULT 'unknown' CHECK (queue_status IN ('none', 'short', 'long', 'unknown')),
  limit_liters INTEGER,
  comment TEXT,
  user_fingerprint VARCHAR(64),
  user_id INTEGER REFERENCES users(id),
  weight NUMERIC(10, 2) DEFAULT 1.0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_station_fuel ON reports (station_id, fuel_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  ip VARCHAR(45) PRIMARY KEY,
  report_count INTEGER DEFAULT 0 NOT NULL,
  window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed fuel types
INSERT INTO fuel_types (code, name) VALUES
  ('ai92', 'АИ-92'),
  ('ai95', 'АИ-95'),
  ('ai98', 'АИ-98'),
  ('dt', 'ДТ'),
  ('gas', 'Газ/LPG')
ON CONFLICT (code) DO NOTHING;
