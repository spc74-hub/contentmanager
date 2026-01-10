-- Migration: Add curated_channel_id to videos table
-- Links videos to their curated channel source

-- Add column to videos
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS curated_channel_id INTEGER REFERENCES curated_channels(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_videos_curated_channel ON videos(curated_channel_id);
