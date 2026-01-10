from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import youtube, scraper, categorizer, tiktok, batch, ai_process, taxonomy, embeddings, channels

settings = get_settings()

app = FastAPI(
    title="Content Manager API",
    description="API para gestionar contenidos de YouTube",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(youtube.router, prefix="/api/youtube", tags=["YouTube"])
app.include_router(scraper.router, prefix="/api/scraper", tags=["Scraper (yt-dlp)"])
app.include_router(categorizer.router, prefix="/api/ai", tags=["AI Categorizer"])
app.include_router(tiktok.router, prefix="/api/tiktok", tags=["TikTok Import"])
app.include_router(batch.router, prefix="/api/batch", tags=["Batch Processing"])
app.include_router(ai_process.router, prefix="/api/ai-process", tags=["AI Processing (Whisper + Ollama)"])
app.include_router(taxonomy.router, prefix="/api/taxonomy", tags=["Taxonomy Management"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["Embeddings & RAG"])
app.include_router(channels.router)  # Already has /api/channels prefix

# Conditionally load Supabase routers
try:
    from app.routers import videos, categories
    app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
    app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
except Exception as e:
    print(f"⚠️  Supabase routers not loaded (configure .env): {e}")


@app.get("/")
async def root():
    return {"message": "Content Manager API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
