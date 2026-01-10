-- Schema for vector embeddings (RAG functionality)
-- Requires Supabase Pro for pgvector extension

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to videos table (768 dimensions for nomic-embed-text)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Add tracking column for when embedding was last updated
ALTER TABLE videos ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- 4. Create IVFFlat index for fast similarity search
-- Note: IVFFlat is good for 1K-100K records, lists=100 is optimal for ~5-10K records
CREATE INDEX IF NOT EXISTS idx_videos_embedding
ON videos USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. Function for semantic search (returns videos ordered by similarity)
-- Note: Using explicit casts to ensure type compatibility
CREATE OR REPLACE FUNCTION search_videos_by_embedding(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id integer,
  youtube_id text,
  title text,
  author text,
  summary text,
  key_points text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id::integer,
    v.youtube_id::text,
    v.title::text,
    v.author::text,
    v.summary::text,
    v.key_points,
    (1 - (v.embedding <=> query_embedding))::float as similarity
  FROM videos v
  WHERE v.embedding IS NOT NULL
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Function to get embedding stats
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
  total_videos bigint,
  videos_with_embedding bigint,
  videos_without_embedding bigint,
  percentage_complete numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_videos,
    COUNT(embedding)::bigint as videos_with_embedding,
    (COUNT(*) - COUNT(embedding))::bigint as videos_without_embedding,
    ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2) as percentage_complete
  FROM videos;
END;
$$;
