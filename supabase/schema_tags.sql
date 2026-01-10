-- Tags and Subcategories Schema Extension
-- Run this after schema.sql in your Supabase SQL Editor

-- Tags table (YouTube original tags)
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    video_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS video_tags (
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, tag_id)
);

-- Subcategories table (AI-generated, cleaner)
CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    video_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, category_id)
);

-- Video-Subcategories junction table
CREATE TABLE IF NOT EXISTS video_subcategories (
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, subcategory_id)
);

-- Add extra columns to videos if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'description') THEN
        ALTER TABLE videos ADD COLUMN description TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'view_count') THEN
        ALTER TABLE videos ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'like_count') THEN
        ALTER TABLE videos ADD COLUMN like_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'source') THEN
        ALTER TABLE videos ADD COLUMN source VARCHAR(50) DEFAULT 'liked';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'transcript') THEN
        ALTER TABLE videos ADD COLUMN transcript TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'has_transcript') THEN
        ALTER TABLE videos ADD COLUMN has_transcript BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_video_count ON tags(video_count DESC);
CREATE INDEX IF NOT EXISTS idx_video_tags_tag_id ON video_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_video_subcategories_subcategory_id ON video_subcategories(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_videos_source ON videos(source);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_subcategories ENABLE ROW LEVEL SECURITY;

-- Policies for public access
CREATE POLICY "Allow public read tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Allow public insert tags" ON tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tags" ON tags FOR UPDATE USING (true);

CREATE POLICY "Allow public read video_tags" ON video_tags FOR SELECT USING (true);
CREATE POLICY "Allow public insert video_tags" ON video_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete video_tags" ON video_tags FOR DELETE USING (true);

CREATE POLICY "Allow public read subcategories" ON subcategories FOR SELECT USING (true);
CREATE POLICY "Allow public insert subcategories" ON subcategories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update subcategories" ON subcategories FOR UPDATE USING (true);

CREATE POLICY "Allow public read video_subcategories" ON video_subcategories FOR SELECT USING (true);
CREATE POLICY "Allow public insert video_subcategories" ON video_subcategories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete video_subcategories" ON video_subcategories FOR DELETE USING (true);

-- Function to update tag video_count
CREATE OR REPLACE FUNCTION update_tag_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET video_count = video_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET video_count = video_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tag count
DROP TRIGGER IF EXISTS update_tag_count_trigger ON video_tags;
CREATE TRIGGER update_tag_count_trigger
AFTER INSERT OR DELETE ON video_tags
FOR EACH ROW EXECUTE FUNCTION update_tag_count();

-- Function to update subcategory video_count
CREATE OR REPLACE FUNCTION update_subcategory_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE subcategories SET video_count = video_count + 1 WHERE id = NEW.subcategory_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE subcategories SET video_count = video_count - 1 WHERE id = OLD.subcategory_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for subcategory count
DROP TRIGGER IF EXISTS update_subcategory_count_trigger ON video_subcategories;
CREATE TRIGGER update_subcategory_count_trigger
AFTER INSERT OR DELETE ON video_subcategories
FOR EACH ROW EXECUTE FUNCTION update_subcategory_count();
