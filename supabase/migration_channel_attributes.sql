-- Migration: Add configurable channel attributes (levels, energies, use_types)
-- Run this in Supabase SQL Editor

-- Create channel_levels table
CREATE TABLE IF NOT EXISTS channel_levels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'bg-gray-100 text-gray-700',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create channel_energies table
CREATE TABLE IF NOT EXISTS channel_energies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'bg-gray-100 text-gray-700',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create channel_use_types table
CREATE TABLE IF NOT EXISTS channel_use_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'BookOpen',
    color VARCHAR(50) DEFAULT 'bg-gray-100 text-gray-700',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default levels
INSERT INTO channel_levels (name, label, color, sort_order) VALUES
    ('intro', 'Intro', 'bg-green-100 text-green-700', 1),
    ('medio', 'Medio', 'bg-yellow-100 text-yellow-700', 2),
    ('avanzado', 'Avanzado', 'bg-red-100 text-red-700', 3)
ON CONFLICT (name) DO NOTHING;

-- Insert default energies
INSERT INTO channel_energies (name, label, color, sort_order) VALUES
    ('baja', 'Baja', 'bg-blue-100 text-blue-700', 1),
    ('media', 'Media', 'bg-orange-100 text-orange-700', 2),
    ('alta', 'Alta', 'bg-red-100 text-red-700', 3)
ON CONFLICT (name) DO NOTHING;

-- Insert default use types
INSERT INTO channel_use_types (name, label, icon, color, sort_order) VALUES
    ('estudio', 'Estudio', 'BookOpen', 'bg-blue-100 text-blue-700', 1),
    ('inspiracion', 'Inspiración', 'Zap', 'bg-yellow-100 text-yellow-700', 2),
    ('ocio', 'Ocio', 'Coffee', 'bg-green-100 text-green-700', 3),
    ('espiritual', 'Espiritual', 'Heart', 'bg-purple-100 text-purple-700', 4)
ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_channel_levels_sort ON channel_levels(sort_order);
CREATE INDEX IF NOT EXISTS idx_channel_energies_sort ON channel_energies(sort_order);
CREATE INDEX IF NOT EXISTS idx_channel_use_types_sort ON channel_use_types(sort_order);

-- Enable RLS
ALTER TABLE channel_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_energies ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_use_types ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on channel_levels" ON channel_levels FOR SELECT USING (true);
CREATE POLICY "Allow public read access on channel_energies" ON channel_energies FOR SELECT USING (true);
CREATE POLICY "Allow public read access on channel_use_types" ON channel_use_types FOR SELECT USING (true);

-- Create policies for authenticated write access
CREATE POLICY "Allow authenticated insert on channel_levels" ON channel_levels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on channel_levels" ON channel_levels FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete on channel_levels" ON channel_levels FOR DELETE USING (true);

CREATE POLICY "Allow authenticated insert on channel_energies" ON channel_energies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on channel_energies" ON channel_energies FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete on channel_energies" ON channel_energies FOR DELETE USING (true);

CREATE POLICY "Allow authenticated insert on channel_use_types" ON channel_use_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on channel_use_types" ON channel_use_types FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete on channel_use_types" ON channel_use_types FOR DELETE USING (true);
