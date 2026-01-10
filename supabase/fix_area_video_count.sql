-- Fix: Add trigger to update area.video_count when videos.area_id changes
-- Run this in Supabase SQL Editor

-- First, add video_count column if it doesn't exist
ALTER TABLE areas ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0;

-- Function to update area video_count
CREATE OR REPLACE FUNCTION update_area_video_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.area_id IS NOT NULL THEN
            UPDATE areas SET video_count = video_count + 1 WHERE id = NEW.area_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Decrement old area if it existed
        IF OLD.area_id IS NOT NULL AND (NEW.area_id IS NULL OR NEW.area_id != OLD.area_id) THEN
            UPDATE areas SET video_count = video_count - 1 WHERE id = OLD.area_id;
        END IF;
        -- Increment new area if it exists and is different
        IF NEW.area_id IS NOT NULL AND (OLD.area_id IS NULL OR NEW.area_id != OLD.area_id) THEN
            UPDATE areas SET video_count = video_count + 1 WHERE id = NEW.area_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.area_id IS NOT NULL THEN
            UPDATE areas SET video_count = video_count - 1 WHERE id = OLD.area_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_area_video_count_trigger ON videos;
CREATE TRIGGER update_area_video_count_trigger
AFTER INSERT OR UPDATE OF area_id OR DELETE ON videos
FOR EACH ROW EXECUTE FUNCTION update_area_video_count();

-- Recalculate all area video counts from current data
UPDATE areas SET video_count = (
    SELECT COUNT(*) FROM videos WHERE videos.area_id = areas.id
);

-- Verify results
SELECT id, name_es, icon, video_count FROM areas ORDER BY sort_order;
