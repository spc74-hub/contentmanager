"""
Embeddings router for RAG functionality.
Uses Ollama for embeddings and pgvector for storage/search.
"""
import asyncio
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
from sqlalchemy import select, update, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Video
from app.config import get_settings

router = APIRouter()
settings = get_settings()

# Ollama config
OLLAMA_URL = settings.ollama_url
EMBEDDING_MODEL = "nomic-embed-text"

executor = ThreadPoolExecutor(max_workers=2)


# ============== Pydantic Models ==============

class EmbeddingGenerateRequest(BaseModel):
    video_ids: Optional[list[int]] = None
    batch_size: int = 20
    force_regenerate: bool = False


class EmbeddingGenerateResponse(BaseModel):
    processed: int
    failed: int
    skipped: int
    processing_time_seconds: float
    errors: list[str] = []


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 10
    threshold: float = 0.3
    source_filter: Optional[str] = None


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
    video_ids: Optional[list[int]] = None
    context_limit: int = 5
    model: str = "llama3.2:3b"


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

async def generate_embedding(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBEDDING_MODEL, "prompt": text}
        )
        if response.status_code != 200:
            raise Exception(f"Ollama embedding error: {response.text}")
        return response.json()["embedding"]


def build_video_text(video: dict) -> str:
    parts = []
    if video.get("title"):
        parts.append(f"Titulo: {video['title']}")
    if video.get("author"):
        parts.append(f"Autor: {video['author']}")
    if video.get("summary"):
        parts.append(f"Resumen: {video['summary']}")
    if video.get("key_points") and isinstance(video["key_points"], list):
        points = "\n".join(f"- {p}" for p in video["key_points"][:5])
        parts.append(f"Puntos clave:\n{points}")
    if video.get("description"):
        desc = video["description"][:500]
        parts.append(f"Descripcion: {desc}")
    return "\n\n".join(parts)


async def generate_llm_response(prompt: str, model: str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False}
        )
        if response.status_code != 200:
            raise Exception(f"Ollama LLM error: {response.text}")
        return response.json()["response"]


async def search_videos_by_embedding(
    db: AsyncSession,
    query_embedding: list[float],
    match_threshold: float = 0.5,
    match_count: int = 10,
) -> list[dict]:
    """Python implementation of the search_videos_by_embedding RPC function."""
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    sql = text("""
        SELECT
            v.id, v.youtube_id, v.title, v.author, v.summary, v.key_points,
            v.source, v.thumbnail,
            (1 - (v.embedding <=> :emb::vector)) as similarity
        FROM videos v
        WHERE v.embedding IS NOT NULL
          AND 1 - (v.embedding <=> :emb::vector) > :threshold
        ORDER BY v.embedding <=> :emb::vector
        LIMIT :limit
    """)
    result = await db.execute(sql, {"emb": embedding_str, "threshold": match_threshold, "limit": match_count})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def get_embedding_stats_from_db(db: AsyncSession) -> dict:
    """Python implementation of get_embedding_stats."""
    total_q = await db.execute(select(func.count(Video.id)))
    total = total_q.scalar() or 0

    with_emb_q = await db.execute(select(func.count(Video.id)).where(Video.embedding.isnot(None)))
    with_emb = with_emb_q.scalar() or 0

    # Stats by source
    source_q = await db.execute(
        select(
            Video.source,
            func.count(Video.id),
            func.count(Video.embedding),
        ).group_by(Video.source)
    )
    by_source = {}
    for row in source_q.all():
        source = row[0] or "unknown"
        by_source[source] = {"total": row[1], "with_embedding": row[2]}

    return {
        "total_videos": total,
        "with_embedding": with_emb,
        "without_embedding": total - with_emb,
        "percentage_complete": round((with_emb / total * 100) if total > 0 else 0, 2),
        "by_source": by_source,
    }


# ============== Endpoints ==============

@router.get("/stats", response_model=EmbeddingStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    return await get_embedding_stats_from_db(db)


@router.post("/generate", response_model=EmbeddingGenerateResponse)
async def generate_embeddings(request: EmbeddingGenerateRequest, db: AsyncSession = Depends(get_db)):
    start_time = time.time()
    processed = 0
    failed = 0
    skipped = 0
    errors = []

    query = select(Video)
    if request.video_ids:
        query = query.where(Video.id.in_(request.video_ids))
    elif not request.force_regenerate:
        query = query.where(Video.embedding.is_(None))

    result = await db.execute(query)
    all_videos = result.scalars().all()

    if not request.force_regenerate:
        videos_to_process = [v for v in all_videos if v.embedding is None]
    else:
        videos_to_process = list(all_videos)

    for i in range(0, len(videos_to_process), request.batch_size):
        batch = videos_to_process[i:i + request.batch_size]
        for video in batch:
            try:
                if not video.title and not video.summary:
                    skipped += 1
                    continue

                video_dict = {
                    "title": video.title, "author": video.author,
                    "summary": video.summary, "key_points": video.key_points,
                    "description": video.description,
                }
                text_repr = build_video_text(video_dict)
                embedding = await generate_embedding(text_repr)

                video.embedding = embedding
                await db.commit()
                processed += 1
            except Exception as e:
                failed += 1
                errors.append(f"Video {video.id}: {str(e)[:100]}")
        await asyncio.sleep(0.5)

    return EmbeddingGenerateResponse(
        processed=processed, failed=failed, skipped=skipped,
        processing_time_seconds=round(time.time() - start_time, 2),
        errors=errors[:10],
    )


@router.post("/search", response_model=SemanticSearchResponse)
async def semantic_search(request: SemanticSearchRequest, db: AsyncSession = Depends(get_db)):
    start_time = time.time()
    query_embedding = await generate_embedding(request.query)

    rows = await search_videos_by_embedding(
        db, query_embedding, request.threshold, request.limit * 2
    )

    results = []
    for row in rows:
        if request.source_filter and row.get("source") != request.source_filter:
            continue
        results.append(SearchResult(
            id=row["id"],
            video_id=row["youtube_id"] or "",
            title=row["title"],
            author=row["author"],
            summary=row.get("summary"),
            similarity=round(row["similarity"], 4),
            source=row.get("source"),
            thumbnail=row.get("thumbnail"),
        ))
        if len(results) >= request.limit:
            break

    processing_time = (time.time() - start_time) * 1000
    return SemanticSearchResponse(
        results=results, query=request.query, processing_time_ms=round(processing_time, 2)
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_context(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    start_time = time.time()
    query_embedding = await generate_embedding(request.query)

    if request.video_ids:
        result = await db.execute(
            select(Video).where(Video.id.in_(request.video_ids), Video.embedding.isnot(None))
        )
        videos = result.scalars().all()

        import numpy as np
        query_vec = np.array(query_embedding)
        scored_videos = []
        for video in videos:
            if video.embedding is not None:
                video_vec = np.array(video.embedding)
                similarity = float(np.dot(query_vec, video_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(video_vec)))
                scored_videos.append({
                    "id": video.id, "youtube_id": video.youtube_id, "title": video.title,
                    "author": video.author, "summary": video.summary,
                    "key_points": video.key_points, "similarity": similarity,
                })
        scored_videos.sort(key=lambda x: x["similarity"], reverse=True)
        relevant_videos = scored_videos[:request.context_limit]
    else:
        relevant_videos = await search_videos_by_embedding(
            db, query_embedding, 0.3, request.context_limit
        )

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
            id=video["id"], video_id=video.get("youtube_id") or "",
            title=video["title"], author=video["author"],
            similarity=round(video.get("similarity", 0), 4),
        ))

    context = "\n\n---\n\n".join(context_parts)
    prompt = f"""Eres un asistente que responde preguntas basandose en el contenido de videos.

CONTEXTO DE VIDEOS RELEVANTES:
{context}

---

PREGUNTA DEL USUARIO: {request.query}

INSTRUCCIONES:
- Responde basandote UNICAMENTE en la informacion del contexto proporcionado
- Si la informacion no esta en el contexto, di que no tienes informacion suficiente
- Cita los videos relevantes cuando sea apropiado
- Responde en espanol de forma clara y concisa

RESPUESTA:"""

    answer = await generate_llm_response(prompt, request.model)

    return ChatResponse(
        answer=answer.strip(), sources=sources,
        processing_time_seconds=round(time.time() - start_time, 2),
    )


@router.get("/models")
async def list_available_models():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            if response.status_code != 200:
                return {"models": [], "error": "Could not fetch models"}
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models, "embedding_model": EMBEDDING_MODEL, "default_chat_model": "llama3.2:3b"}
    except Exception as e:
        return {"models": [], "error": str(e)}
