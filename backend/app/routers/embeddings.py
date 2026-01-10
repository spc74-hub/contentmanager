"""
Embeddings router for RAG functionality.
Uses Ollama for embeddings and Supabase pgvector for storage/search.
"""
import asyncio
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from supabase import create_client, Client

router = APIRouter()

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Ollama config
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBEDDING_MODEL = "nomic-embed-text"

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=2)


# ============== Pydantic Models ==============

class EmbeddingGenerateRequest(BaseModel):
    video_ids: Optional[list[int]] = None  # If None, process all without embedding
    batch_size: int = 20
    force_regenerate: bool = False  # Regenerate even if embedding exists


class EmbeddingGenerateResponse(BaseModel):
    processed: int
    failed: int
    skipped: int
    processing_time_seconds: float
    errors: list[str] = []


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 10
    threshold: float = 0.3  # Minimum similarity score
    source_filter: Optional[str] = None  # Filter by source (youtube, tiktok, etc.)


class SearchResult(BaseModel):
    id: int
    video_id: str
    title: str
    author: str
    summary: Optional[str]
    similarity: float
    source: Optional[str]
    thumbnail: Optional[str]


class SemanticSearchResponse(BaseModel):
    results: list[SearchResult]
    query: str
    processing_time_ms: float


class ChatRequest(BaseModel):
    query: str
    video_ids: Optional[list[int]] = None  # Limit context to specific videos
    context_limit: int = 5  # Max videos to include in context
    model: str = "llama3.2:3b"  # LLM model for chat


class ChatSource(BaseModel):
    id: int
    video_id: str
    title: str
    author: str
    similarity: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]
    processing_time_seconds: float


class EmbeddingStats(BaseModel):
    total_videos: int
    with_embedding: int
    without_embedding: int
    percentage_complete: float
    by_source: dict[str, dict]


# ============== Helper Functions ==============

def generate_embedding_sync(text: str) -> list[float]:
    """Generate embedding using Ollama (synchronous)."""
    import requests

    response = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={
            "model": EMBEDDING_MODEL,
            "prompt": text
        },
        timeout=60
    )

    if response.status_code != 200:
        raise Exception(f"Ollama embedding error: {response.text}")

    return response.json()["embedding"]


async def generate_embedding(text: str) -> list[float]:
    """Generate embedding using Ollama (async)."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={
                "model": EMBEDDING_MODEL,
                "prompt": text
            }
        )

        if response.status_code != 200:
            raise Exception(f"Ollama embedding error: {response.text}")

        return response.json()["embedding"]


def build_video_text(video: dict) -> str:
    """Build text representation of video for embedding."""
    parts = []

    if video.get("title"):
        parts.append(f"Título: {video['title']}")

    if video.get("author"):
        parts.append(f"Autor: {video['author']}")

    if video.get("summary"):
        parts.append(f"Resumen: {video['summary']}")

    if video.get("key_points") and isinstance(video["key_points"], list):
        points = "\n".join(f"- {p}" for p in video["key_points"][:5])
        parts.append(f"Puntos clave:\n{points}")

    if video.get("description"):
        desc = video["description"][:500]  # Limit description length
        parts.append(f"Descripción: {desc}")

    return "\n\n".join(parts)


async def generate_llm_response(prompt: str, model: str) -> str:
    """Generate response using Ollama LLM."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False
            }
        )

        if response.status_code != 200:
            raise Exception(f"Ollama LLM error: {response.text}")

        return response.json()["response"]


# ============== Endpoints ==============

@router.get("/stats", response_model=EmbeddingStats)
async def get_embedding_stats():
    """Get statistics about embedding coverage."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    # Get total counts
    all_videos = []
    offset = 0
    batch_size = 1000

    while True:
        response = supabase.table("videos").select(
            "id, embedding, source"
        ).range(offset, offset + batch_size - 1).execute()

        if not response.data:
            break

        all_videos.extend(response.data)
        offset += batch_size

        if len(response.data) < batch_size:
            break

    total = len(all_videos)
    with_embedding = sum(1 for v in all_videos if v.get("embedding"))
    without_embedding = total - with_embedding

    # Stats by source
    by_source = {}
    for video in all_videos:
        source = video.get("source") or "unknown"
        if source not in by_source:
            by_source[source] = {"total": 0, "with_embedding": 0}
        by_source[source]["total"] += 1
        if video.get("embedding"):
            by_source[source]["with_embedding"] += 1

    return EmbeddingStats(
        total_videos=total,
        with_embedding=with_embedding,
        without_embedding=without_embedding,
        percentage_complete=round((with_embedding / total * 100) if total > 0 else 0, 2),
        by_source=by_source
    )


@router.post("/generate", response_model=EmbeddingGenerateResponse)
async def generate_embeddings(request: EmbeddingGenerateRequest):
    """Generate embeddings for videos that don't have them."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    start_time = time.time()
    processed = 0
    failed = 0
    skipped = 0
    errors = []

    # Get videos to process
    if request.video_ids:
        # Specific videos
        query = supabase.table("videos").select(
            "id, youtube_id, title, author, summary, key_points, description, embedding"
        ).in_("id", request.video_ids)
    else:
        # All videos without embedding (or all if force_regenerate)
        query = supabase.table("videos").select(
            "id, youtube_id, title, author, summary, key_points, description, embedding"
        )
        if not request.force_regenerate:
            query = query.is_("embedding", "null")

    # Fetch in batches
    all_videos = []
    offset = 0
    batch_size = 1000

    while True:
        response = query.range(offset, offset + batch_size - 1).execute()

        if not response.data:
            break

        all_videos.extend(response.data)
        offset += batch_size

        if len(response.data) < batch_size:
            break

    # Filter if not force regenerate
    if not request.force_regenerate:
        videos_to_process = [v for v in all_videos if not v.get("embedding")]
    else:
        videos_to_process = all_videos

    # Process in batches
    for i in range(0, len(videos_to_process), request.batch_size):
        batch = videos_to_process[i:i + request.batch_size]

        for video in batch:
            try:
                # Skip if no meaningful content
                if not video.get("title") and not video.get("summary"):
                    skipped += 1
                    continue

                # Build text and generate embedding
                text = build_video_text(video)
                embedding = await generate_embedding(text)

                # Save to Supabase
                supabase.table("videos").update({
                    "embedding": embedding,
                    "embedding_updated_at": "now()"
                }).eq("id", video["id"]).execute()

                processed += 1

            except Exception as e:
                failed += 1
                errors.append(f"Video {video.get('id')}: {str(e)[:100]}")

        # Small delay between batches to avoid overwhelming Ollama
        await asyncio.sleep(0.5)

    return EmbeddingGenerateResponse(
        processed=processed,
        failed=failed,
        skipped=skipped,
        processing_time_seconds=round(time.time() - start_time, 2),
        errors=errors[:10]  # Limit errors in response
    )


@router.post("/search", response_model=SemanticSearchResponse)
async def semantic_search(request: SemanticSearchRequest):
    """Search videos by semantic similarity."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    start_time = time.time()

    # Generate embedding for query
    query_embedding = await generate_embedding(request.query)

    # Search using pgvector function
    response = supabase.rpc(
        "search_videos_by_embedding",
        {
            "query_embedding": query_embedding,
            "match_threshold": request.threshold,
            "match_count": request.limit * 2  # Get more to filter
        }
    ).execute()

    results = []
    for row in response.data or []:
        # Apply source filter if specified
        if request.source_filter:
            # Need to get source from videos table
            video_response = supabase.table("videos").select(
                "source, thumbnail"
            ).eq("id", row["id"]).single().execute()

            if video_response.data:
                if video_response.data.get("source") != request.source_filter:
                    continue
                source = video_response.data.get("source")
                thumbnail = video_response.data.get("thumbnail")
            else:
                continue
        else:
            # Get source and thumbnail
            video_response = supabase.table("videos").select(
                "source, thumbnail"
            ).eq("id", row["id"]).single().execute()
            source = video_response.data.get("source") if video_response.data else None
            thumbnail = video_response.data.get("thumbnail") if video_response.data else None

        results.append(SearchResult(
            id=row["id"],
            video_id=row["youtube_id"],
            title=row["title"],
            author=row["author"],
            summary=row.get("summary"),
            similarity=round(row["similarity"], 4),
            source=source,
            thumbnail=thumbnail
        ))

        if len(results) >= request.limit:
            break

    processing_time = (time.time() - start_time) * 1000  # Convert to ms

    return SemanticSearchResponse(
        results=results,
        query=request.query,
        processing_time_ms=round(processing_time, 2)
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_context(request: ChatRequest):
    """Chat with RAG context from videos."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    start_time = time.time()

    # Generate embedding for the question
    query_embedding = await generate_embedding(request.query)

    # Search for relevant videos
    if request.video_ids:
        # Search within specific videos
        # First get those videos' embeddings
        videos_response = supabase.table("videos").select(
            "id, youtube_id, title, author, summary, key_points, embedding"
        ).in_("id", request.video_ids).not_.is_("embedding", "null").execute()

        # Calculate similarity manually
        import numpy as np
        query_vec = np.array(query_embedding)

        scored_videos = []
        for video in videos_response.data or []:
            if video.get("embedding"):
                video_vec = np.array(video["embedding"])
                # Cosine similarity
                similarity = np.dot(query_vec, video_vec) / (
                    np.linalg.norm(query_vec) * np.linalg.norm(video_vec)
                )
                scored_videos.append({**video, "similarity": float(similarity)})

        # Sort by similarity
        scored_videos.sort(key=lambda x: x["similarity"], reverse=True)
        relevant_videos = scored_videos[:request.context_limit]
    else:
        # Use pgvector search
        response = supabase.rpc(
            "search_videos_by_embedding",
            {
                "query_embedding": query_embedding,
                "match_threshold": 0.3,
                "match_count": request.context_limit
            }
        ).execute()
        relevant_videos = response.data or []

    # Build context from videos
    context_parts = []
    sources = []

    for video in relevant_videos:
        video_context = f"**{video['title']}** (por {video['author']})"
        if video.get("summary"):
            video_context += f"\nResumen: {video['summary']}"
        if video.get("key_points"):
            points = video["key_points"]
            if isinstance(points, list) and points:
                video_context += f"\nPuntos clave: {', '.join(points[:3])}"
        context_parts.append(video_context)

        sources.append(ChatSource(
            id=video["id"],
            video_id=video["youtube_id"],
            title=video["title"],
            author=video["author"],
            similarity=round(video.get("similarity", 0), 4)
        ))

    context = "\n\n---\n\n".join(context_parts)

    # Build prompt for LLM
    prompt = f"""Eres un asistente que responde preguntas basándose en el contenido de videos.

CONTEXTO DE VIDEOS RELEVANTES:
{context}

---

PREGUNTA DEL USUARIO: {request.query}

INSTRUCCIONES:
- Responde basándote ÚNICAMENTE en la información del contexto proporcionado
- Si la información no está en el contexto, di que no tienes información suficiente
- Cita los videos relevantes cuando sea apropiado
- Responde en español de forma clara y concisa

RESPUESTA:"""

    # Generate response
    answer = await generate_llm_response(prompt, request.model)

    return ChatResponse(
        answer=answer.strip(),
        sources=sources,
        processing_time_seconds=round(time.time() - start_time, 2)
    )


@router.get("/models")
async def list_available_models():
    """List available Ollama models for chat."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")

            if response.status_code != 200:
                return {"models": [], "error": "Could not fetch models"}

            data = response.json()
            models = [m["name"] for m in data.get("models", [])]

            return {
                "models": models,
                "embedding_model": EMBEDDING_MODEL,
                "default_chat_model": "llama3.2:3b"
            }
    except Exception as e:
        return {"models": [], "error": str(e)}
