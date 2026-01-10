-- Taxonomy Management Schema Extension
-- Adds video status fields, tag groups, and management capabilities
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PHASE 1: ADD STATUS FIELDS TO VIDEOS
-- ============================================================================

DO $$
BEGIN
    -- Add is_archived flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'is_archived') THEN
        ALTER TABLE videos ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add is_validated flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'is_validated') THEN
        ALTER TABLE videos ADD COLUMN is_validated BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add validated_at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'validated_at') THEN
        ALTER TABLE videos ADD COLUMN validated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Indexes for status filtering
CREATE INDEX IF NOT EXISTS idx_videos_is_archived ON videos(is_archived);
CREATE INDEX IF NOT EXISTS idx_videos_is_validated ON videos(is_validated);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(is_archived, is_validated);

-- ============================================================================
-- PHASE 2: CREATE TAG_GROUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tag_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    tag_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add group_id to tags table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'group_id') THEN
        ALTER TABLE tags ADD COLUMN group_id INTEGER REFERENCES tag_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes for tag groups
CREATE INDEX IF NOT EXISTS idx_tags_group_id ON tags(group_id);
CREATE INDEX IF NOT EXISTS idx_tag_groups_sort_order ON tag_groups(sort_order);

-- ============================================================================
-- PHASE 3: ROW LEVEL SECURITY FOR TAG_GROUPS
-- ============================================================================

ALTER TABLE tag_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read tag_groups" ON tag_groups FOR SELECT USING (true);
CREATE POLICY "Allow public insert tag_groups" ON tag_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tag_groups" ON tag_groups FOR UPDATE USING (true);
CREATE POLICY "Allow public delete tag_groups" ON tag_groups FOR DELETE USING (true);

-- ============================================================================
-- PHASE 4: DELETE POLICIES FOR AREAS AND TOPICS (if not exist)
-- ============================================================================

DO $$
BEGIN
    -- Check and create delete policy for areas
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'areas' AND policyname = 'Allow public delete areas'
    ) THEN
        CREATE POLICY "Allow public delete areas" ON areas FOR DELETE USING (true);
    END IF;

    -- Check and create delete policy for topics
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'topics' AND policyname = 'Allow public delete topics'
    ) THEN
        CREATE POLICY "Allow public delete topics" ON topics FOR DELETE USING (true);
    END IF;
END $$;

-- ============================================================================
-- PHASE 5: FUNCTION TO UPDATE TAG_GROUP COUNTS
-- ============================================================================

-- Function to recalculate tag_group tag_count
CREATE OR REPLACE FUNCTION update_tag_group_tag_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update new group count
        IF NEW.group_id IS NOT NULL THEN
            UPDATE tag_groups SET tag_count = (
                SELECT COUNT(*) FROM tags WHERE group_id = NEW.group_id
            ) WHERE id = NEW.group_id;
        END IF;
        -- Update old group count if changed
        IF TG_OP = 'UPDATE' AND OLD.group_id IS DISTINCT FROM NEW.group_id AND OLD.group_id IS NOT NULL THEN
            UPDATE tag_groups SET tag_count = (
                SELECT COUNT(*) FROM tags WHERE group_id = OLD.group_id
            ) WHERE id = OLD.group_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.group_id IS NOT NULL THEN
            UPDATE tag_groups SET tag_count = (
                SELECT COUNT(*) FROM tags WHERE group_id = OLD.group_id
            ) WHERE id = OLD.group_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tag_group_tag_count_trigger ON tags;
CREATE TRIGGER update_tag_group_tag_count_trigger
AFTER INSERT OR UPDATE OF group_id OR DELETE ON tags
FOR EACH ROW EXECUTE FUNCTION update_tag_group_tag_count();

-- ============================================================================
-- PHASE 5b: FUNCTION TO UPDATE TAG_GROUP VIDEO_COUNT (unique videos)
-- ============================================================================

-- Function to recalculate tag_group video_count when video_tags change
CREATE OR REPLACE FUNCTION update_tag_group_video_count()
RETURNS TRIGGER AS $$
DECLARE
    affected_group_id INTEGER;
BEGIN
    -- Get the group_id of the tag involved
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT group_id INTO affected_group_id FROM tags WHERE id = NEW.tag_id;
    ELSE
        SELECT group_id INTO affected_group_id FROM tags WHERE id = OLD.tag_id;
    END IF;

    -- Update the video_count for the affected group (count unique videos)
    IF affected_group_id IS NOT NULL THEN
        UPDATE tag_groups SET video_count = (
            SELECT COUNT(DISTINCT vt.video_id)
            FROM video_tags vt
            JOIN tags t ON t.id = vt.tag_id
            WHERE t.group_id = affected_group_id
        ) WHERE id = affected_group_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tag_group_video_count_trigger ON video_tags;
CREATE TRIGGER update_tag_group_video_count_trigger
AFTER INSERT OR DELETE ON video_tags
FOR EACH ROW EXECUTE FUNCTION update_tag_group_video_count();

-- ============================================================================
-- PHASE 6: FUNCTION TO AUTO-SET validated_at WHEN is_validated CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_validated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_validated = TRUE AND (OLD.is_validated IS NULL OR OLD.is_validated = FALSE) THEN
        NEW.validated_at = NOW();
    ELSIF NEW.is_validated = FALSE THEN
        NEW.validated_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_validated_at_trigger ON videos;
CREATE TRIGGER update_validated_at_trigger
BEFORE UPDATE OF is_validated ON videos
FOR EACH ROW EXECUTE FUNCTION update_validated_at();

-- ============================================================================
-- PHASE 7: ADD video_count TO AREAS (computed field via trigger)
-- ============================================================================

-- Add video_count column to areas if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'video_count') THEN
        ALTER TABLE areas ADD COLUMN video_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Function to update area video_count when video.area_id changes
CREATE OR REPLACE FUNCTION update_area_video_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.area_id IS NOT NULL THEN
            UPDATE areas SET video_count = video_count + 1 WHERE id = NEW.area_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.area_id IS DISTINCT FROM NEW.area_id THEN
            IF OLD.area_id IS NOT NULL THEN
                UPDATE areas SET video_count = video_count - 1 WHERE id = OLD.area_id;
            END IF;
            IF NEW.area_id IS NOT NULL THEN
                UPDATE areas SET video_count = video_count + 1 WHERE id = NEW.area_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.area_id IS NOT NULL THEN
            UPDATE areas SET video_count = video_count - 1 WHERE id = OLD.area_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_area_video_count_trigger ON videos;
CREATE TRIGGER update_area_video_count_trigger
AFTER INSERT OR UPDATE OF area_id OR DELETE ON videos
FOR EACH ROW EXECUTE FUNCTION update_area_video_count();

-- Initialize area video counts
UPDATE areas SET video_count = (
    SELECT COUNT(*) FROM videos WHERE videos.area_id = areas.id
);

-- ============================================================================
-- PHASE 8: VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify the migration:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'videos' AND column_name IN ('is_archived', 'is_validated', 'validated_at');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'group_id';
-- SELECT * FROM tag_groups LIMIT 5;
-- SELECT a.name, a.video_count FROM areas a ORDER BY a.sort_order;
