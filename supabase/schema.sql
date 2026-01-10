-- Content Manager Database Schema
-- Run this in your Supabase SQL Editor

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    youtube_id VARCHAR(50),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    url VARCHAR(500) NOT NULL,
    thumbnail VARCHAR(500),
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id);
CREATE INDEX IF NOT EXISTS idx_videos_author ON videos(author);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust as needed)
CREATE POLICY "Allow public read categories" ON categories
    FOR SELECT USING (true);

CREATE POLICY "Allow public read videos" ON videos
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert categories" ON categories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert videos" ON videos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update categories" ON categories
    FOR UPDATE USING (true);

CREATE POLICY "Allow public update videos" ON videos
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete categories" ON categories
    FOR DELETE USING (true);

CREATE POLICY "Allow public delete videos" ON videos
    FOR DELETE USING (true);

-- Function to update updated_at on videos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
