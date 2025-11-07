-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Satellites
CREATE TABLE IF NOT EXISTS satellite (
  norad_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  owner_country TEXT,
  constellation TEXT,
  mission_type TEXT,
  launch_date DATE
);

-- TLEs
CREATE TABLE IF NOT EXISTS tle (
  id BIGSERIAL PRIMARY KEY,
  norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,
  epoch TIMESTAMPTZ NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL,
  source TEXT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tle_norad ON tle(norad_id);
CREATE INDEX IF NOT EXISTS idx_tle_epoch_brin ON tle USING BRIN(epoch);

-- Minimal placeholders for polygons/cities/models (optional for slice)
CREATE TABLE IF NOT EXISTS model_asset (
  id SERIAL PRIMARY KEY,
  norad_id INTEGER REFERENCES satellite(norad_id),
  uri TEXT,
  license TEXT
);



