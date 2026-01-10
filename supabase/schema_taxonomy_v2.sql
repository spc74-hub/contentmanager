-- New Taxonomy Schema v2
-- Areas (10 life areas) -> Topics (~45) -> Tags (existing hashtags)
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PHASE 1: CREATE NEW TABLES
-- ============================================================================

-- Areas table (replaces categories conceptually, but we keep categories for now)
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_es VARCHAR(255),  -- Spanish name for display
    icon VARCHAR(50),
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Topics table (replaces subcategories)
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_es VARCHAR(255),  -- Spanish name for display
    description TEXT,
    video_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, area_id)
);

-- Video-Topics junction table (many-to-many with confidence)
CREATE TABLE IF NOT EXISTS video_topics (
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 1.0,  -- 0.0 to 1.0
    needs_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (video_id, topic_id)
);

-- Favorite authors table
CREATE TABLE IF NOT EXISTS favorite_authors (
    id SERIAL PRIMARY KEY,
    author_name VARCHAR(255) NOT NULL UNIQUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: ADD COLUMNS TO VIDEOS TABLE
-- ============================================================================

DO $$
BEGIN
    -- Add area_id to videos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'area_id') THEN
        ALTER TABLE videos ADD COLUMN area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL;
    END IF;

    -- Add is_favorite to videos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'is_favorite') THEN
        ALTER TABLE videos ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add upload_date if not exists (for TikTok publish date)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'upload_date') THEN
        ALTER TABLE videos ADD COLUMN upload_date VARCHAR(20);
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_topics_area_id ON topics(area_id);
CREATE INDEX IF NOT EXISTS idx_topics_video_count ON topics(video_count DESC);
CREATE INDEX IF NOT EXISTS idx_video_topics_topic_id ON video_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_video_topics_needs_review ON video_topics(needs_review) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_videos_area_id ON videos(area_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_favorite ON videos(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_favorite_authors_name ON favorite_authors(author_name);

-- ============================================================================
-- PHASE 4: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_authors ENABLE ROW LEVEL SECURITY;

-- Policies for areas
CREATE POLICY "Allow public read areas" ON areas FOR SELECT USING (true);
CREATE POLICY "Allow public insert areas" ON areas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update areas" ON areas FOR UPDATE USING (true);

-- Policies for topics
CREATE POLICY "Allow public read topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Allow public insert topics" ON topics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update topics" ON topics FOR UPDATE USING (true);

-- Policies for video_topics
CREATE POLICY "Allow public read video_topics" ON video_topics FOR SELECT USING (true);
CREATE POLICY "Allow public insert video_topics" ON video_topics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update video_topics" ON video_topics FOR UPDATE USING (true);
CREATE POLICY "Allow public delete video_topics" ON video_topics FOR DELETE USING (true);

-- Policies for favorite_authors
CREATE POLICY "Allow public read favorite_authors" ON favorite_authors FOR SELECT USING (true);
CREATE POLICY "Allow public insert favorite_authors" ON favorite_authors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update favorite_authors" ON favorite_authors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete favorite_authors" ON favorite_authors FOR DELETE USING (true);

-- ============================================================================
-- PHASE 5: TRIGGERS FOR TOPIC COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_topic_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE topics SET video_count = video_count + 1 WHERE id = NEW.topic_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE topics SET video_count = video_count - 1 WHERE id = OLD.topic_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_topic_count_trigger ON video_topics;
CREATE TRIGGER update_topic_count_trigger
AFTER INSERT OR DELETE ON video_topics
FOR EACH ROW EXECUTE FUNCTION update_topic_count();

-- ============================================================================
-- PHASE 6: SEED AREAS (10 Life Areas)
-- ============================================================================

INSERT INTO areas (id, name, name_es, icon, color, sort_order) VALUES
(1, 'Health & Fitness', 'Salud y Fitness', '🏋️', '#22C55E', 1),
(2, 'Business & Career', 'Negocio y Carrera', '💼', '#3B82F6', 2),
(3, 'Money & Finances', 'Dinero y Finanzas', '💰', '#F59E0B', 3),
(4, 'Relationships', 'Relaciones', '❤️', '#EC4899', 4),
(5, 'Fun & Recreation', 'Ocio y Entretenimiento', '🎉', '#8B5CF6', 5),
(6, 'Physical Environment', 'Entorno Físico', '🏠', '#06B6D4', 6),
(7, 'Personal Growth', 'Crecimiento Personal', '🧠', '#6366F1', 7),
(8, 'Family & Friends', 'Familia y Amigos', '👨‍👩‍👧‍👦', '#F97316', 8),
(9, 'Charity & Legacy', 'Caridad y Legado', '🎁', '#14B8A6', 9),
(10, 'Spiritual', 'Espiritual', '🧘', '#A855F7', 10)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_es = EXCLUDED.name_es,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order;

-- Reset sequence
SELECT setval('areas_id_seq', (SELECT MAX(id) FROM areas));

-- ============================================================================
-- PHASE 7: SEED TOPICS (~45 topics across 10 areas)
-- ============================================================================

-- Health & Fitness (Area 1)
INSERT INTO topics (area_id, name, name_es) VALUES
(1, 'Golf', 'Golf'),
(1, 'Nutrition', 'Nutrición'),
(1, 'Fitness & Exercise', 'Fitness y Ejercicio'),
(1, 'Keto & Fasting', 'Keto y Ayuno'),
(1, 'Mental Wellness', 'Bienestar Mental'),
(1, 'Food & Cooking', 'Cocina y Recetas'),
(1, 'Sleep & Recovery', 'Sueño y Recuperación')
ON CONFLICT (name, area_id) DO NOTHING;

-- Business & Career (Area 2)
INSERT INTO topics (area_id, name, name_es) VALUES
(2, 'AI & ChatGPT', 'IA y ChatGPT'),
(2, 'Productivity Tools', 'Herramientas de Productividad'),
(2, 'Entrepreneurship', 'Emprendimiento'),
(2, 'Marketing & Sales', 'Marketing y Ventas'),
(2, 'Programming & Tech', 'Programación y Tecnología'),
(2, 'Career Development', 'Desarrollo Profesional'),
(2, 'Remote Work', 'Trabajo Remoto')
ON CONFLICT (name, area_id) DO NOTHING;

-- Money & Finances (Area 3)
INSERT INTO topics (area_id, name, name_es) VALUES
(3, 'Investing', 'Inversión'),
(3, 'ETFs & Index Funds', 'ETFs y Fondos Indexados'),
(3, 'Personal Finance', 'Finanzas Personales'),
(3, 'Real Estate', 'Inmobiliario'),
(3, 'Crypto', 'Criptomonedas'),
(3, 'Taxes', 'Impuestos'),
(3, 'Financial Independence', 'Independencia Financiera')
ON CONFLICT (name, area_id) DO NOTHING;

-- Relationships (Area 4)
INSERT INTO topics (area_id, name, name_es) VALUES
(4, 'Dating & Romance', 'Citas y Romance'),
(4, 'Communication', 'Comunicación'),
(4, 'Social Skills', 'Habilidades Sociales')
ON CONFLICT (name, area_id) DO NOTHING;

-- Fun & Recreation (Area 5)
INSERT INTO topics (area_id, name, name_es) VALUES
(5, 'Music', 'Música'),
(5, 'Travel', 'Viajes'),
(5, 'Movies & Series', 'Películas y Series'),
(5, 'Gaming', 'Videojuegos'),
(5, 'Hobbies & Crafts', 'Hobbies y Manualidades'),
(5, 'Comedy & Entertainment', 'Comedia y Entretenimiento')
ON CONFLICT (name, area_id) DO NOTHING;

-- Physical Environment (Area 6)
INSERT INTO topics (area_id, name, name_es) VALUES
(6, 'Home & Decor', 'Casa y Decoración'),
(6, 'Organization', 'Organización'),
(6, 'Asturias & Local', 'Asturias y Local'),
(6, 'Minimalism', 'Minimalismo'),
(6, 'Gardening', 'Jardinería')
ON CONFLICT (name, area_id) DO NOTHING;

-- Personal Growth (Area 7)
INSERT INTO topics (area_id, name, name_es) VALUES
(7, 'Learning & Education', 'Aprendizaje y Educación'),
(7, 'Habits & Routines', 'Hábitos y Rutinas'),
(7, 'Philosophy & Stoicism', 'Filosofía y Estoicismo'),
(7, 'Psychology', 'Psicología'),
(7, 'Mindset & Motivation', 'Mentalidad y Motivación'),
(7, 'Books & Reading', 'Libros y Lectura')
ON CONFLICT (name, area_id) DO NOTHING;

-- Family & Friends (Area 8)
INSERT INTO topics (area_id, name, name_es) VALUES
(8, 'Parenting', 'Crianza'),
(8, 'Family Activities', 'Actividades Familiares'),
(8, 'Friendships', 'Amistades')
ON CONFLICT (name, area_id) DO NOTHING;

-- Charity & Legacy (Area 9)
INSERT INTO topics (area_id, name, name_es) VALUES
(9, 'Giving & Philanthropy', 'Donaciones y Filantropía'),
(9, 'Volunteering', 'Voluntariado'),
(9, 'Legacy Planning', 'Planificación del Legado')
ON CONFLICT (name, area_id) DO NOTHING;

-- Spiritual (Area 10)
INSERT INTO topics (area_id, name, name_es) VALUES
(10, 'Meditation', 'Meditación'),
(10, 'Mindfulness', 'Mindfulness'),
(10, 'Religion & Faith', 'Religión y Fe'),
(10, 'Purpose & Meaning', 'Propósito y Significado')
ON CONFLICT (name, area_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES (run to check everything is set up)
-- ============================================================================

-- SELECT 'Areas created:' as info, COUNT(*) as count FROM areas;
-- SELECT 'Topics created:' as info, COUNT(*) as count FROM topics;
-- SELECT a.name as area, COUNT(t.id) as topic_count FROM areas a LEFT JOIN topics t ON t.area_id = a.id GROUP BY a.id, a.name ORDER BY a.sort_order;
