from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.db.session import engine, get_db, async_session_maker
from app.db.models import Base
from app.auth import (
    LoginRequest, Token, create_access_token, verify_password, get_password_hash,
)
from app.db.models import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and pgvector extension
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Content Manager API",
    description="API para gestionar contenidos de YouTube",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from app.routers import (
    videos, categories, youtube, scraper, categorizer,
    tiktok, batch, ai_process, taxonomy, embeddings, channels
)

app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["YouTube"])
app.include_router(scraper.router, prefix="/api/scraper", tags=["Scraper (yt-dlp)"])
app.include_router(categorizer.router, prefix="/api/ai", tags=["AI Categorizer"])
app.include_router(tiktok.router, prefix="/api/tiktok", tags=["TikTok Import"])
app.include_router(batch.router, prefix="/api/batch", tags=["Batch Processing"])
app.include_router(ai_process.router, prefix="/api/ai-process", tags=["AI Processing (Whisper + Ollama)"])
app.include_router(taxonomy.router, prefix="/api/taxonomy", tags=["Taxonomy Management"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["Embeddings & RAG"])
app.include_router(channels.router)  # Already has /api/channels prefix


# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@app.post("/api/auth/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.hashed_password):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(data={"sub": user.email})
    return Token(access_token=token, token_type="bearer")


# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    return {"message": "Content Manager API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
