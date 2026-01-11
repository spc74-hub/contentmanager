-- Migration: Add language column to curated_channels
-- Date: 2026-01-11

-- Add language column (es = Spanish, en = English, other = Other)
ALTER TABLE curated_channels
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'es';

-- Create index for language filtering
CREATE INDEX IF NOT EXISTS idx_curated_channels_language ON curated_channels(language);

-- Create index for subscriber_count range queries
CREATE INDEX IF NOT EXISTS idx_curated_channels_subscriber_count ON curated_channels(subscriber_count);
