-- Schema for tag to area mappings
-- This table stores the relationship between tags and areas for classification

-- Create tag_area_mappings table
CREATE TABLE IF NOT EXISTS tag_area_mappings (
    id SERIAL PRIMARY KEY,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 1.0,  -- Confidence of the mapping (0.0-1.0)
    source VARCHAR(50) DEFAULT 'manual',  -- 'manual', 'learned'
    usage_count INTEGER DEFAULT 0,  -- Times used for classification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tag_id, area_id)
);

-- Create index for faster lookups by tag
CREATE INDEX IF NOT EXISTS idx_tag_area_mappings_tag ON tag_area_mappings(tag_id);

-- Create index for faster lookups by area
CREATE INDEX IF NOT EXISTS idx_tag_area_mappings_area ON tag_area_mappings(area_id);

-- Enable RLS
ALTER TABLE tag_area_mappings ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for all users" ON tag_area_mappings
    FOR SELECT USING (true);

-- Allow insert/update for authenticated users
CREATE POLICY "Allow insert for all users" ON tag_area_mappings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for all users" ON tag_area_mappings
    FOR UPDATE USING (true);
