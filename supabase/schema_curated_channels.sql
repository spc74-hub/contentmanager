-- Schema for curated_channels table
-- Stores manually curated YouTube channels with classification metadata

-- Enum types for channel classification
DO $$ BEGIN
  CREATE TYPE channel_level AS ENUM ('intro', 'medio', 'avanzado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE channel_energy AS ENUM ('baja', 'media', 'alta');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE channel_use_type AS ENUM ('estudio', 'inspiracion', 'ocio', 'espiritual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Channel themes table (for the 27 themes from Excel)
CREATE TABLE IF NOT EXISTS channel_themes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7),  -- Hex color for UI
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Curated channels table
CREATE TABLE IF NOT EXISTS curated_channels (
  id SERIAL PRIMARY KEY,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  youtube_url VARCHAR(500),           -- Original URL from Excel (may be search URL)
  youtube_channel_id VARCHAR(50),     -- Resolved YouTube channel ID (UC...)
  youtube_channel_url VARCHAR(500),   -- Resolved direct channel URL
  thumbnail VARCHAR(500),

  -- Classification
  theme_id INTEGER REFERENCES channel_themes(id),
  level channel_level DEFAULT 'medio',
  energy channel_energy DEFAULT 'media',
  use_type channel_use_type DEFAULT 'inspiracion',

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_resolved BOOLEAN DEFAULT false,  -- Whether youtube_channel_id has been resolved

  -- Import tracking (when we import videos from this channel)
  last_import_at TIMESTAMP WITH TIME ZONE,
  total_videos_imported INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint on name to avoid duplicates
  UNIQUE(name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_curated_channels_theme ON curated_channels(theme_id);
CREATE INDEX IF NOT EXISTS idx_curated_channels_level ON curated_channels(level);
CREATE INDEX IF NOT EXISTS idx_curated_channels_energy ON curated_channels(energy);
CREATE INDEX IF NOT EXISTS idx_curated_channels_use_type ON curated_channels(use_type);
CREATE INDEX IF NOT EXISTS idx_curated_channels_is_active ON curated_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_curated_channels_youtube_channel_id ON curated_channels(youtube_channel_id);

-- Enable RLS
ALTER TABLE channel_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_channels ENABLE ROW LEVEL SECURITY;

-- Policies (single user app - allow all)
CREATE POLICY "Allow all on channel_themes" ON channel_themes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on curated_channels" ON curated_channels FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_curated_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_curated_channels_updated_at ON curated_channels;
CREATE TRIGGER trigger_curated_channels_updated_at
  BEFORE UPDATE ON curated_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_curated_channels_updated_at();
