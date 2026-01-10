-- Schema for subscribed_channels table
-- Stores YouTube channels from Google Takeout subscriptions export

CREATE TABLE IF NOT EXISTS subscribed_channels (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(50) UNIQUE NOT NULL,      -- YouTube channel ID (UC...)
  channel_name VARCHAR(255) NOT NULL,
  channel_url VARCHAR(500) NOT NULL,
  thumbnail VARCHAR(500),

  -- Import tracking
  is_active BOOLEAN DEFAULT true,              -- To enable/disable channels for sync
  first_import_at TIMESTAMP WITH TIME ZONE,    -- First time videos were imported from this channel
  last_video_date TIMESTAMP WITH TIME ZONE,    -- Date of most recent video imported (publication date)
  last_import_at TIMESTAMP WITH TIME ZONE,     -- Last time videos were imported (sync date)
  total_videos_imported INTEGER DEFAULT 0,     -- Counter of videos imported from this channel

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_subscribed_channels_channel_id ON subscribed_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_subscribed_channels_is_active ON subscribed_channels(is_active);

-- Enable RLS
ALTER TABLE subscribed_channels ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (single user app)
CREATE POLICY "Allow all operations on subscribed_channels" ON subscribed_channels
  FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_subscribed_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_subscribed_channels_updated_at ON subscribed_channels;
CREATE TRIGGER trigger_subscribed_channels_updated_at
  BEFORE UPDATE ON subscribed_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_subscribed_channels_updated_at();
