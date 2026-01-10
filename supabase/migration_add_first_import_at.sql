-- Migration: Add first_import_at column to subscribed_channels
-- Run this in Supabase SQL Editor to add the new column

-- Add the new column
ALTER TABLE subscribed_channels
ADD COLUMN IF NOT EXISTS first_import_at TIMESTAMP WITH TIME ZONE;

-- Optionally, set first_import_at for existing channels that have imports
-- (sets it to the same value as last_import_at for channels that already have imports)
UPDATE subscribed_channels
SET first_import_at = last_import_at
WHERE total_videos_imported > 0 AND first_import_at IS NULL;
