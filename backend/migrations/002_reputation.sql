-- Anonymous users identified by browser fingerprint
ALTER TABLE users ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_fingerprint ON users (fingerprint);
CREATE INDEX IF NOT EXISTS idx_reports_fingerprint_station_fuel
  ON reports (user_fingerprint, station_id, fuel_type_id, created_at DESC);
