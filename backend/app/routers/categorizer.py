"""
AI-powered video categorization using Ollama (local LLM).
"""
import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# Ollama API endpoint (local)
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.2:3b"

# Default categories - can be customized
DEFAULT_CATEGORIES = [
    "Finanzas",
    "Productividad",
    "Tecnología",
    "Educación",
    "Entretenimiento",
    "Salud",
    "Negocios",
    "Marketing",
    "Desarrollo Personal",
    "Otros"
]


class VideoToCategorize(BaseModel):
    title: str
    author: str
    tags: list[str] = []
    description: str = ""
    transcript: Optional[str] = None  # YouTube subtitles/transcript


class CategorizeRequest(BaseModel):
    videos: list[VideoToCategorize]
    categories: list[str] = DEFAULT_CATEGORIES
    include_summary: bool = False  # Generate summary from transcript
    include_subcategories: bool = False  # Generate subcategories
    extended_summary: bool = False  # Include key points in summary


class CategorizedVideo(BaseModel):
    title: str
    category: str
    subcategories: list[str] = []
    summary: Optional[str] = None
    key_points: list[str] = []
    confidence: Optional[str] = None
    processing_time_seconds: Optional[float] = None


class CategorizeResponse(BaseModel):
    results: list[CategorizedVideo]
    total: int
    processing_time_seconds: float


class SummarizeRequest(BaseModel):
    video_id: str
    title: str
    transcript: str


class SummaryResponse(BaseModel):
    video_id: str
    summary: str
    key_points: list[str]
    processing_time_seconds: float


async def categorize_single(video: VideoToCategorize, categories: list[str]) -> str:
    """Categorize a single video using Ollama."""
    categories_str = ", ".join(categories)
    tags_str = ", ".join(video.tags[:10]) if video.tags else "ninguno"

    # Use transcript if available for better categorization
    context = ""
    if video.transcript:
        context = f"\n- Transcripción (fragmento): {video.transcript[:500]}..."

    prompt = f"""Eres un clasificador de videos. Analiza el siguiente video y asígnale la categoría MÁS APROPIADA.

Categorías disponibles: {categories_str}

Video:
- Título: {video.title}
- Canal: {video.author}
- Tags: {tags_str}{context}

Instrucciones:
- Si habla de inversiones, bolsa, dinero, economía → Finanzas
- Si habla de herramientas, apps, IA, software → Tecnología
- Si es un tutorial o curso para aprender algo → Educación
- Si habla de productividad, gestión del tiempo, hábitos → Productividad
- Si habla de ejercicio, dieta, bienestar → Salud
- Si habla de emprendimiento, startups, empresas → Negocios
- Si habla de publicidad, ventas, redes sociales → Marketing
- Si habla de motivación, mentalidad, superación → Desarrollo Personal
- Si es humor, música, vlogs → Entretenimiento

Responde ÚNICAMENTE con el nombre de la categoría (una sola palabra o dos palabras máximo):"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for consistent results
                        "num_predict": 20,   # Short response
                    }
                }
            )

            if response.status_code != 200:
                return "Otros"

            result = response.json()
            category = result.get("response", "Otros").strip().rstrip(".")

            # Validate category is in the list
            for cat in categories:
                if cat.lower() in category.lower():
                    return cat

            return "Otros"

    except Exception as e:
        print(f"Error categorizing: {e}")
        return "Otros"


async def get_subcategories(video: VideoToCategorize, main_category: str) -> list[str]:
    """Get subcategories for a video based on its content."""
    tags_str = ", ".join(video.tags[:10]) if video.tags else "ninguno"

    context = ""
    if video.transcript:
        context = f"\n- Transcripción (fragmento): {video.transcript[:300]}..."

    prompt = f"""Analiza este video y sugiere 2-3 subcategorías específicas dentro de "{main_category}".

Video:
- Título: {video.title}
- Canal: {video.author}
- Tags: {tags_str}{context}

Ejemplos de subcategorías:
- Finanzas: Inversiones, Ahorro, Criptomonedas, Impuestos, Presupuesto
- Tecnología: IA, Programación, Apps, Hardware, Tutoriales
- Productividad: GTD, Notion, Hábitos, Gestión del tiempo
- Educación: Idiomas, Matemáticas, Ciencias, Historia

Responde SOLO con las subcategorías separadas por comas (máximo 3):"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 50,
                    }
                }
            )

            if response.status_code != 200:
                return []

            result = response.json()
            raw = result.get("response", "").strip()
            subcats = [s.strip() for s in raw.split(",") if s.strip()]
            return subcats[:3]

    except Exception as e:
        print(f"Error getting subcategories: {e}")
        return []


async def generate_summary(video: VideoToCategorize, extended: bool = False) -> tuple[Optional[str], list[str]]:
    """Generate a summary from video transcript.

    Returns: (summary, key_points)
    """
    if not video.transcript:
        return None, []

    if extended:
        prompt = f"""Analiza este video y proporciona un resumen detallado con puntos clave.

Título: {video.title}
Transcripción:
{video.transcript[:8000]}

IMPORTANTE: Responde EXACTAMENTE en este formato:

RESUMEN: [Escribe aquí un resumen de 4-6 oraciones sobre el contenido del video]

PUNTOS CLAVE:
- [Primer punto clave]
- [Segundo punto clave]
- [Tercer punto clave]
- [Cuarto punto clave]

Asegúrate de incluir tanto el RESUMEN como los PUNTOS CLAVE."""
        num_predict = 600
    else:
        prompt = f"""Resume este video en 2-3 oraciones concisas.

Título: {video.title}
Transcripción:
{video.transcript[:4000]}

Resumen (2-3 oraciones):"""
        num_predict = 150

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": num_predict,
                    }
                }
            )

            if response.status_code != 200:
                return None, []

            result = response.json()
            raw_response = result.get("response", "").strip()

            if extended:
                # Parse extended response with more flexible matching
                summary = ""
                key_points = []
                lines = raw_response.split("\n")
                in_points = False
                in_summary = False

                for line in lines:
                    line = line.strip()
                    line_lower = line.lower()

                    # Check for summary section start
                    if "resumen:" in line_lower or "resumen " in line_lower[:10]:
                        in_summary = True
                        in_points = False
                        # Extract text after "RESUMEN:"
                        if ":" in line:
                            summary = line.split(":", 1)[1].strip()
                        continue

                    # Check for key points section start
                    if "puntos clave" in line_lower or "puntos:" in line_lower or "claves:" in line_lower:
                        in_points = True
                        in_summary = False
                        continue

                    # Process lines based on current section
                    if in_points:
                        # Match bullet points: -, •, *, or numbered (1., 2., etc.)
                        if line.startswith(("-", "•", "*")) or (len(line) > 2 and line[0].isdigit() and line[1] in ".)" ):
                            point = line.lstrip("-•*0123456789.)").strip()
                            if point and len(point) > 3:
                                key_points.append(point)
                    elif in_summary and line and not any(x in line_lower for x in ["puntos", "clave", "key"]):
                        # Continue accumulating summary text
                        if summary:
                            summary += " " + line
                        else:
                            summary = line

                # If no structured parsing worked, try a simpler approach
                if not summary and not key_points:
                    # Split by common separators
                    parts = raw_response.replace("PUNTOS CLAVE", "\n---SPLIT---\n").replace("Puntos clave", "\n---SPLIT---\n").split("---SPLIT---")
                    if len(parts) >= 2:
                        summary = parts[0].replace("RESUMEN:", "").replace("Resumen:", "").strip()
                        points_text = parts[1]
                        for line in points_text.split("\n"):
                            line = line.strip()
                            if line.startswith(("-", "•", "*")) or (len(line) > 2 and line[0].isdigit()):
                                point = line.lstrip("-•*0123456789.)").strip()
                                if point and len(point) > 3:
                                    key_points.append(point)

                # Fallback: use raw response as summary if nothing parsed
                if not summary:
                    summary = raw_response[:500]

                print(f"[DEBUG] Extended summary for '{video.title[:30]}...': summary={len(summary)} chars, key_points={len(key_points)}")

                return summary, key_points[:6]
            else:
                return raw_response, []

    except Exception as e:
        print(f"Error generating summary: {e}")
        return None, []


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_videos(request: CategorizeRequest):
    """
    Categorize a batch of videos using local AI (Ollama).

    - Processes videos in parallel (up to 5 concurrent)
    - Uses llama3.2:3b for fast inference
    - Returns category for each video
    - Optionally includes subcategories and summaries
    """
    import time
    start_time = time.time()

    # Check if Ollama is running
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            health = await client.get("http://localhost:11434/api/tags")
            if health.status_code != 200:
                raise HTTPException(status_code=503, detail="Ollama not running. Start with: ollama serve")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama not running. Start with: ollama serve")

    # Process videos with limited concurrency
    semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests

    async def categorize_with_semaphore(video: VideoToCategorize) -> CategorizedVideo:
        async with semaphore:
            video_start = time.time()

            # Get main category
            category = await categorize_single(video, request.categories)

            # Optionally get subcategories
            subcategories = []
            if request.include_subcategories:
                subcategories = await get_subcategories(video, category)

            # Optionally generate summary
            summary = None
            key_points = []
            if request.include_summary and video.transcript:
                summary, key_points = await generate_summary(video, extended=request.extended_summary)

            video_time = time.time() - video_start

            return CategorizedVideo(
                title=video.title,
                category=category,
                subcategories=subcategories,
                summary=summary,
                key_points=key_points,
                processing_time_seconds=round(video_time, 2)
            )

    # Run all categorizations
    tasks = [categorize_with_semaphore(video) for video in request.videos]
    results = await asyncio.gather(*tasks)

    processing_time = time.time() - start_time

    return CategorizeResponse(
        results=results,
        total=len(results),
        processing_time_seconds=round(processing_time, 2)
    )


@router.post("/summarize", response_model=SummaryResponse)
async def summarize_video(request: SummarizeRequest):
    """
    Generate a summary for a single video from its transcript.
    """
    import time
    start_time = time.time()

    # Check if Ollama is running
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            health = await client.get("http://localhost:11434/api/tags")
            if health.status_code != 200:
                raise HTTPException(status_code=503, detail="Ollama not running")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama not running")

    prompt = f"""Analiza este video y proporciona:
1. Un resumen de 2-3 oraciones
2. 3-5 puntos clave

Título: {request.title}
Transcripción:
{request.transcript[:3000]}

Responde en formato:
RESUMEN: [tu resumen aquí]
PUNTOS CLAVE:
- [punto 1]
- [punto 2]
- [punto 3]"""

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 300,
                    }
                }
            )

            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Error generating summary")

            result = response.json()
            raw_response = result.get("response", "").strip()

            # Parse response
            summary = ""
            key_points = []

            lines = raw_response.split("\n")
            in_points = False

            for line in lines:
                line = line.strip()
                if line.startswith("RESUMEN:"):
                    summary = line.replace("RESUMEN:", "").strip()
                elif line.startswith("PUNTOS CLAVE:"):
                    in_points = True
                elif in_points and line.startswith("-"):
                    key_points.append(line[1:].strip())
                elif not in_points and summary and line:
                    summary += " " + line

            processing_time = time.time() - start_time

            return SummaryResponse(
                video_id=request.video_id,
                summary=summary or raw_response[:200],
                key_points=key_points[:5],
                processing_time_seconds=round(processing_time, 2)
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/categories")
async def get_default_categories():
    """Get the default list of categories."""
    return {"categories": DEFAULT_CATEGORIES}


@router.get("/health")
async def check_ollama_health():
    """Check if Ollama is running and model is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                has_model = any(MODEL.split(":")[0] in name for name in model_names)
                return {
                    "status": "ok",
                    "ollama_running": True,
                    "model_available": has_model,
                    "model": MODEL,
                    "available_models": model_names
                }
    except httpx.ConnectError:
        pass

    return {
        "status": "error",
        "ollama_running": False,
        "model_available": False,
        "message": "Ollama not running. Start with: ollama serve"
    }
