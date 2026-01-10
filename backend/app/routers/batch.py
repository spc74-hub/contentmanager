"""
Batch processing for large-scale video imports.
Supports background processing with progress tracking.
"""
import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import yt_dlp

router = APIRouter()

executor = ThreadPoolExecutor(max_workers=2)

# Store batch job status in memory (in production, use Redis/DB)
batch_jobs: dict = {}

# Directory for storing results
RESULTS_DIR = Path("/tmp/content_manager_batches")
RESULTS_DIR.mkdir(exist_ok=True)


class BatchJob(BaseModel):
    id: str
    status: str  # pending, running, completed, failed
    source: str  # youtube_takeout, playlist, liked_videos
    total_videos: int
    processed: int
    categorized: int
    failed: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    results_file: Optional[str] = None


class BatchStartRequest(BaseModel):
    source: str  # "liked_videos", "watch_later", "playlist", "takeout"
    playlist_url: Optional[str] = None
    use_cookies: bool = True
    browser: str = "chrome"
    categorize: bool = True
    include_transcript: bool = False  # Slower but better categorization
    batch_size: int = 50  # Process in batches to save progress


def get_liked_videos_sync(use_cookies: bool, browser: str) -> list[dict]:
    """Get all liked videos from YouTube."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'ignoreerrors': True,
    }
    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    url = "https://www.youtube.com/playlist?list=LL"  # Liked videos playlist

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info.get('entries', []) if info else []


def get_watch_later_sync(use_cookies: bool, browser: str) -> list[dict]:
    """Get Watch Later playlist."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'ignoreerrors': True,
    }
    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    url = "https://www.youtube.com/playlist?list=WL"  # Watch Later

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info.get('entries', []) if info else []


def get_playlist_sync(url: str, use_cookies: bool, browser: str) -> list[dict]:
    """Get videos from a playlist."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'ignoreerrors': True,
    }
    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info.get('entries', []) if info else []


def get_video_details_sync(video_id: str, use_cookies: bool = False, browser: str = "chrome") -> Optional[dict]:
    """Get full details for a single video."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }
    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    url = f"https://www.youtube.com/watch?v={video_id}"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)
    except Exception as e:
        print(f"Error getting video {video_id}: {e}")
        return None


async def categorize_video(video: dict, categories: list[str]) -> str:
    """Categorize a single video using Ollama."""
    import httpx

    tags_str = ", ".join((video.get('tags') or [])[:10]) or "ninguno"

    prompt = f"""Eres un clasificador de videos. Analiza el siguiente video y asígnale la categoría MÁS APROPIADA.

Categorías disponibles: {", ".join(categories)}

Video:
- Título: {video.get('title', '')}
- Canal: {video.get('channel', video.get('uploader', ''))}
- Tags: {tags_str}

Responde ÚNICAMENTE con el nombre de la categoría:"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 20}
                }
            )

            if response.status_code == 200:
                result = response.json()
                category = result.get("response", "Otros").strip().rstrip(".")
                for cat in categories:
                    if cat.lower() in category.lower():
                        return cat
            return "Otros"
    except Exception as e:
        print(f"Categorization error: {e}")
        return "Otros"


async def process_batch_job(job_id: str, request: BatchStartRequest):
    """Background task to process a batch job."""
    job = batch_jobs.get(job_id)
    if not job:
        return

    job["status"] = "running"
    job["started_at"] = datetime.now().isoformat()

    categories = [
        "Finanzas", "Productividad", "Tecnología", "Educación",
        "Entretenimiento", "Salud", "Negocios", "Marketing",
        "Desarrollo Personal", "Otros"
    ]

    results = []
    loop = asyncio.get_event_loop()

    try:
        # Step 1: Get video list
        print(f"[BATCH {job_id}] Fetching video list from {request.source}...")

        if request.source == "liked_videos":
            entries = await loop.run_in_executor(
                executor, get_liked_videos_sync, request.use_cookies, request.browser
            )
        elif request.source == "watch_later":
            entries = await loop.run_in_executor(
                executor, get_watch_later_sync, request.use_cookies, request.browser
            )
        elif request.source == "playlist" and request.playlist_url:
            entries = await loop.run_in_executor(
                executor, get_playlist_sync, request.playlist_url, request.use_cookies, request.browser
            )
        else:
            raise ValueError(f"Unknown source: {request.source}")

        # Filter out None entries
        entries = [e for e in entries if e is not None]
        job["total_videos"] = len(entries)

        print(f"[BATCH {job_id}] Found {len(entries)} videos to process")

        # Step 2: Process in batches
        for i, entry in enumerate(entries):
            try:
                video_id = entry.get('id', '')
                if not video_id:
                    job["failed"] += 1
                    continue

                # Get basic info (already have from flat extraction)
                video_data = {
                    "id": video_id,
                    "title": entry.get('title', 'Sin título'),
                    "channel": entry.get('channel', entry.get('uploader', 'Desconocido')),
                    "url": entry.get('url', f"https://www.youtube.com/watch?v={video_id}"),
                    "duration": entry.get('duration', 0),
                    "view_count": entry.get('view_count', 0),
                    "tags": entry.get('tags', []),
                }

                # Categorize if requested
                if request.categorize:
                    category = await categorize_video(video_data, categories)
                    video_data["category"] = category
                    job["categorized"] += 1

                results.append(video_data)
                job["processed"] += 1

                # Save progress every batch_size videos
                if (i + 1) % request.batch_size == 0:
                    progress_file = RESULTS_DIR / f"{job_id}_progress.json"
                    with open(progress_file, 'w') as f:
                        json.dump({"job": job, "results": results}, f)
                    print(f"[BATCH {job_id}] Progress: {job['processed']}/{job['total_videos']}")

                # Small delay to not overwhelm Ollama
                if request.categorize:
                    await asyncio.sleep(0.5)

            except Exception as e:
                print(f"[BATCH {job_id}] Error processing video: {e}")
                job["failed"] += 1

        # Step 3: Save final results
        results_file = RESULTS_DIR / f"{job_id}_results.json"
        with open(results_file, 'w') as f:
            json.dump({
                "job_id": job_id,
                "source": request.source,
                "total": len(results),
                "categories_summary": {},
                "videos": results
            }, f, indent=2, ensure_ascii=False)

        # Calculate category summary
        if request.categorize:
            summary = {}
            for v in results:
                cat = v.get("category", "Otros")
                summary[cat] = summary.get(cat, 0) + 1

            # Update file with summary
            with open(results_file, 'r+') as f:
                data = json.load(f)
                data["categories_summary"] = summary
                f.seek(0)
                json.dump(data, f, indent=2, ensure_ascii=False)

        job["status"] = "completed"
        job["completed_at"] = datetime.now().isoformat()
        job["results_file"] = str(results_file)

        print(f"[BATCH {job_id}] Completed! {job['processed']} processed, {job['categorized']} categorized")

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["completed_at"] = datetime.now().isoformat()
        print(f"[BATCH {job_id}] Failed: {e}")


@router.post("/start", response_model=BatchJob)
async def start_batch_job(request: BatchStartRequest, background_tasks: BackgroundTasks):
    """
    Start a batch processing job.

    Sources:
    - liked_videos: Your YouTube liked videos (requires cookies)
    - watch_later: Your Watch Later playlist (requires cookies)
    - playlist: Any public or private playlist (provide playlist_url)

    The job runs in the background. Use /batch/status/{job_id} to check progress.
    """
    job_id = f"batch_{int(time.time())}"

    job = {
        "id": job_id,
        "status": "pending",
        "source": request.source,
        "total_videos": 0,
        "processed": 0,
        "categorized": 0,
        "failed": 0,
        "started_at": None,
        "completed_at": None,
        "error": None,
        "results_file": None,
    }

    batch_jobs[job_id] = job

    # Start background processing
    background_tasks.add_task(process_batch_job, job_id, request)

    return BatchJob(**job)


@router.get("/status/{job_id}", response_model=BatchJob)
async def get_job_status(job_id: str):
    """Get the status of a batch job."""
    job = batch_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return BatchJob(**job)


@router.get("/jobs")
async def list_jobs():
    """List all batch jobs."""
    return {"jobs": [BatchJob(**j) for j in batch_jobs.values()]}


@router.get("/results/{job_id}")
async def get_results(job_id: str):
    """Get the results of a completed batch job."""
    job = batch_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Job is {job['status']}, not completed")

    results_file = job.get("results_file")
    if not results_file or not Path(results_file).exists():
        raise HTTPException(status_code=404, detail="Results file not found")

    with open(results_file, 'r') as f:
        return json.load(f)


@router.post("/import/takeout")
async def import_google_takeout(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """
    Import from Google Takeout export.

    Upload the watch-history.json or liked-videos.json from your Takeout export.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be JSON")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    videos = []

    # Google Takeout format varies
    if isinstance(data, list):
        for item in data:
            # Watch history format
            if "titleUrl" in item:
                url = item.get("titleUrl", "")
                video_id = ""
                if "v=" in url:
                    video_id = url.split("v=")[1].split("&")[0]
                elif "watch?v=" in url:
                    video_id = url.split("watch?v=")[1].split("&")[0]

                videos.append({
                    "id": video_id,
                    "title": item.get("title", "").replace("Watched ", ""),
                    "url": url,
                    "watched_at": item.get("time", ""),
                    "channel": item.get("subtitles", [{}])[0].get("name", "") if item.get("subtitles") else "",
                })

    return {
        "total": len(videos),
        "videos": videos[:100],  # Return first 100 as preview
        "message": f"Found {len(videos)} videos. Use /batch/start with source='takeout' to process them."
    }


@router.delete("/cancel/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running job (best effort - may not stop immediately)."""
    job = batch_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "running":
        job["status"] = "cancelled"
        job["completed_at"] = datetime.now().isoformat()
        return {"message": "Job cancellation requested"}

    return {"message": f"Job is {job['status']}, cannot cancel"}


class ReprocessRequest(BaseModel):
    """Request to reprocess existing videos."""
    include_subcategories: bool = True
    include_summary: bool = True
    extended_summary: bool = False
    extract_transcript: bool = True  # Fetch transcripts from YouTube
    limit: Optional[int] = None  # Limit number of videos to process
    category_id: Optional[int] = None  # Only process specific category
    skip_with_summary: bool = True  # Skip videos that already have summary


async def get_transcript_for_video(video_id: str) -> Optional[str]:
    """Get transcript/subtitles for a YouTube video."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        try:
            # Try Spanish first, then English, then any available
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            transcript = None
            for lang in ['es', 'en']:
                try:
                    transcript = transcript_list.find_transcript([lang])
                    break
                except:
                    continue

            if not transcript:
                # Get any available transcript
                transcript = transcript_list.find_generated_transcript(['es', 'en'])

            if transcript:
                fetched = transcript.fetch()
                text = " ".join([entry['text'] for entry in fetched])
                return text[:15000]  # Limit to 15k chars

        except Exception as e:
            print(f"No transcript for {video_id}: {e}")
            return None

    except ImportError:
        print("youtube_transcript_api not installed")
        return None

    return None


async def categorize_with_ai(title: str, author: str, tags: list, transcript: Optional[str], categories: list[str]) -> str:
    """Categorize video using Ollama."""
    import httpx

    tags_str = ", ".join(tags[:10]) if tags else "ninguno"
    context = f"\n- Transcripción (fragmento): {transcript[:500]}..." if transcript else ""

    prompt = f"""Eres un clasificador de videos. Analiza el siguiente video y asígnale la categoría MÁS APROPIADA.

Categorías disponibles: {", ".join(categories)}

Video:
- Título: {title}
- Canal: {author}
- Tags: {tags_str}{context}

Responde ÚNICAMENTE con el nombre de la categoría:"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 20}
                }
            )

            if response.status_code == 200:
                result = response.json()
                category = result.get("response", "Otros").strip().rstrip(".")
                for cat in categories:
                    if cat.lower() in category.lower():
                        return cat
        return "Otros"
    except Exception as e:
        print(f"Categorization error: {e}")
        return "Otros"


async def get_subcategories_ai(title: str, author: str, main_category: str, transcript: Optional[str]) -> list[str]:
    """Get subcategories using Ollama."""
    import httpx

    context = f"\n- Transcripción (fragmento): {transcript[:300]}..." if transcript else ""

    prompt = f"""Analiza este video y sugiere 2-3 subcategorías específicas dentro de "{main_category}".

Video:
- Título: {title}
- Canal: {author}{context}

Responde SOLO con las subcategorías separadas por comas (máximo 3):"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 50}
                }
            )

            if response.status_code == 200:
                result = response.json()
                raw = result.get("response", "").strip()
                subcats = [s.strip() for s in raw.split(",") if s.strip()]
                return subcats[:3]
        return []
    except Exception as e:
        print(f"Subcategories error: {e}")
        return []


async def generate_summary_ai(title: str, transcript: str, extended: bool = False) -> tuple[Optional[str], list[str]]:
    """Generate summary from transcript using Ollama."""
    import httpx

    if not transcript:
        return None, []

    if extended:
        prompt = f"""Analiza este video y proporciona un resumen detallado con puntos clave.

Título: {title}
Transcripción:
{transcript[:8000]}

IMPORTANTE: Responde EXACTAMENTE en este formato:

RESUMEN: [Escribe aquí un resumen de 4-6 oraciones sobre el contenido del video]

PUNTOS CLAVE:
- [Primer punto clave]
- [Segundo punto clave]
- [Tercer punto clave]
- [Cuarto punto clave]"""
        num_predict = 600
    else:
        prompt = f"""Resume este video en 2-3 oraciones concisas.

Título: {title}
Transcripción:
{transcript[:4000]}

Resumen (2-3 oraciones):"""
        num_predict = 150

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": num_predict}
                }
            )

            if response.status_code != 200:
                return None, []

            result = response.json()
            raw_response = result.get("response", "").strip()

            if extended:
                summary = ""
                key_points = []
                lines = raw_response.split("\n")
                in_points = False
                in_summary = False

                for line in lines:
                    line = line.strip()
                    line_lower = line.lower()

                    if "resumen:" in line_lower:
                        in_summary = True
                        in_points = False
                        if ":" in line:
                            summary = line.split(":", 1)[1].strip()
                        continue

                    if "puntos clave" in line_lower:
                        in_points = True
                        in_summary = False
                        continue

                    if in_points and line.startswith(("-", "•", "*")):
                        point = line.lstrip("-•*").strip()
                        if point and len(point) > 3:
                            key_points.append(point)
                    elif in_summary and line:
                        summary = summary + " " + line if summary else line

                if not summary:
                    summary = raw_response[:500]

                return summary, key_points[:6]
            else:
                return raw_response, []

    except Exception as e:
        print(f"Summary error: {e}")
        return None, []


async def process_reprocess_job(job_id: str, request: ReprocessRequest):
    """Background task to reprocess existing videos."""
    from app.config import get_settings

    job = batch_jobs.get(job_id)
    if not job:
        return

    job["status"] = "running"
    job["started_at"] = datetime.now().isoformat()

    settings = get_settings()

    try:
        from supabase import create_client
        supabase = create_client(settings.supabase_url, settings.supabase_key)

        # Get categories
        categories_response = supabase.table("categories").select("id, name").execute()
        category_map = {c["id"]: c["name"] for c in categories_response.data}
        category_names = list(category_map.values())

        # Build query for videos
        query = supabase.table("videos").select("id, youtube_id, title, author, category_id, summary, has_transcript")

        if request.category_id:
            query = query.eq("category_id", request.category_id)

        if request.skip_with_summary:
            query = query.or_("summary.is.null,summary.eq.")

        if request.limit:
            query = query.limit(request.limit)

        videos_response = query.execute()
        videos = videos_response.data

        job["total_videos"] = len(videos)
        print(f"[REPROCESS {job_id}] Found {len(videos)} videos to process")

        processed = 0
        errors = []

        for video in videos:
            if job.get("status") == "cancelled":
                break

            try:
                video_id = video["id"]
                youtube_id = video.get("youtube_id")
                title = video.get("title", "")
                author = video.get("author", "")
                current_category_id = video.get("category_id")

                update_data = {}

                # Step 1: Get transcript if needed
                transcript = None
                if request.extract_transcript and youtube_id:
                    transcript = await get_transcript_for_video(youtube_id)
                    if transcript:
                        update_data["transcript"] = transcript
                        update_data["has_transcript"] = True

                # Step 2: Re-categorize if we have new transcript
                if transcript:
                    new_category = await categorize_with_ai(title, author, [], transcript, category_names)
                    # Find category ID
                    for cat_id, cat_name in category_map.items():
                        if cat_name == new_category:
                            update_data["category_id"] = cat_id
                            break

                # Step 3: Get subcategories
                subcategories = []
                if request.include_subcategories:
                    current_cat_name = category_map.get(update_data.get("category_id", current_category_id), "Otros")
                    subcategories = await get_subcategories_ai(title, author, current_cat_name, transcript)

                # Step 4: Generate summary
                if request.include_summary and transcript:
                    summary, key_points = await generate_summary_ai(title, transcript, request.extended_summary)
                    if summary:
                        update_data["summary"] = summary
                        # Store key points as JSON in description field or a new field
                        if key_points:
                            update_data["description"] = "Puntos clave:\n- " + "\n- ".join(key_points)

                # Update video in database
                if update_data:
                    supabase.table("videos").update(update_data).eq("id", video_id).execute()

                # Handle subcategories (create if needed and link)
                if subcategories and current_category_id:
                    for subcat_name in subcategories:
                        # Check if subcategory exists
                        existing = supabase.table("subcategories").select("id").eq("name", subcat_name).eq("category_id", current_category_id).execute()

                        if not existing.data:
                            # Create subcategory
                            supabase.table("subcategories").insert({
                                "name": subcat_name,
                                "category_id": current_category_id
                            }).execute()

                processed += 1
                job["processed"] = processed

                if processed % 10 == 0:
                    print(f"[REPROCESS {job_id}] Progress: {processed}/{job['total_videos']}")

                # Small delay between videos
                await asyncio.sleep(1)

            except Exception as e:
                errors.append(f"Video {video.get('id')}: {str(e)}")
                job["failed"] += 1

        job["status"] = "completed"
        job["completed_at"] = datetime.now().isoformat()

        # Save results summary
        results_file = RESULTS_DIR / f"{job_id}_reprocess_results.json"
        with open(results_file, 'w') as f:
            json.dump({
                "job_id": job_id,
                "total": job["total_videos"],
                "processed": processed,
                "failed": job["failed"],
                "errors": errors[:20]
            }, f, indent=2)

        job["results_file"] = str(results_file)

        print(f"[REPROCESS {job_id}] Completed! {processed} processed, {job['failed']} failed")

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["completed_at"] = datetime.now().isoformat()
        print(f"[REPROCESS {job_id}] Failed: {e}")


@router.post("/reprocess", response_model=BatchJob)
async def reprocess_existing_videos(request: ReprocessRequest, background_tasks: BackgroundTasks):
    """
    Re-process existing videos in Supabase to add:
    - Transcripts (fetched from YouTube)
    - Re-categorization (better with transcript)
    - Subcategories
    - AI-generated summaries

    This runs in background. Use /batch/status/{job_id} to check progress.

    Options:
    - include_subcategories: Generate 2-3 subcategories per video
    - include_summary: Generate AI summary from transcript
    - extended_summary: Include key points in summary
    - extract_transcript: Fetch YouTube subtitles/transcripts
    - limit: Process only N videos (for testing)
    - category_id: Only process videos from specific category
    - skip_with_summary: Skip videos that already have a summary
    """
    job_id = f"reprocess_{int(time.time())}"

    job = {
        "id": job_id,
        "status": "pending",
        "source": "reprocess_existing",
        "total_videos": 0,
        "processed": 0,
        "categorized": 0,
        "failed": 0,
        "started_at": None,
        "completed_at": None,
        "error": None,
        "results_file": None,
    }

    batch_jobs[job_id] = job

    # Start background processing
    background_tasks.add_task(process_reprocess_job, job_id, request)

    return BatchJob(**job)


@router.post("/import-to-db/{job_id}")
async def import_batch_to_database(job_id: str):
    """
    Import completed batch results to Supabase database.

    Creates categories and tags dynamically as needed.
    """
    from app.config import get_settings

    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    # Load results file
    results_file = RESULTS_DIR / f"{job_id}_results.json"
    if not results_file.exists():
        raise HTTPException(status_code=404, detail="Results file not found")

    with open(results_file, 'r') as f:
        data = json.load(f)

    videos = data.get("videos", [])
    if not videos:
        raise HTTPException(status_code=400, detail="No videos in results")

    try:
        from supabase import create_client
        supabase = create_client(settings.supabase_url, settings.supabase_key)

        # Default colors for categories
        category_colors = {
            "Finanzas": "#10b981", "Productividad": "#f59e0b", "Tecnología": "#3b82f6",
            "Educación": "#8b5cf6", "Entretenimiento": "#ef4444", "Salud": "#ec4899",
            "Negocios": "#14b8a6", "Marketing": "#f97316", "Desarrollo Personal": "#84cc16",
            "Otros": "#6b7280"
        }
        category_icons = {
            "Finanzas": "💰", "Productividad": "⚡", "Tecnología": "💻",
            "Educación": "📚", "Entretenimiento": "🎬", "Salud": "❤️",
            "Negocios": "💼", "Marketing": "📣", "Desarrollo Personal": "🌱",
            "Otros": "📁"
        }

        # Step 1: Get or create categories
        categories_response = supabase.table("categories").select("id, name").execute()
        category_map = {c["name"]: c["id"] for c in categories_response.data}

        # Find categories we need to create
        unique_categories = set(v.get("category", "Otros") for v in videos)
        new_categories = [cat for cat in unique_categories if cat not in category_map]

        for cat_name in new_categories:
            response = supabase.table("categories").insert({
                "name": cat_name,
                "icon": category_icons.get(cat_name, "📁"),
                "color": category_colors.get(cat_name, "#6b7280")
            }).execute()
            if response.data:
                category_map[cat_name] = response.data[0]["id"]

        # Step 2: Get or create tags from video tags
        tags_response = supabase.table("tags").select("id, name").execute()
        tag_map = {t["name"].lower(): t["id"] for t in tags_response.data}

        # Collect all unique tags from videos
        all_tags = set()
        for video in videos:
            for tag in video.get("tags", [])[:10]:  # Limit to 10 tags per video
                if tag and len(tag) <= 100:
                    all_tags.add(tag.lower().strip())

        # Create new tags
        new_tags = [tag for tag in all_tags if tag not in tag_map]
        if new_tags:
            for tag_name in new_tags[:500]:  # Limit total new tags
                try:
                    response = supabase.table("tags").insert({"name": tag_name}).execute()
                    if response.data:
                        tag_map[tag_name] = response.data[0]["id"]
                except:
                    pass  # Skip duplicates

        # Step 3: Insert videos
        inserted = 0
        video_tags_to_insert = []
        errors = []

        # Map source values to standardized values
        source_mapping = {
            "liked_videos": "liked",
            "watch_later": "watch_later",
            "playlist": "playlist",
            "takeout": "liked",  # Google Takeout typically contains liked/watched videos
            "youtube_liked": "liked",
            "single": "single",
        }
        raw_source = data.get("source", "liked")
        normalized_source = source_mapping.get(raw_source, raw_source if raw_source in ["liked", "playlist", "single", "watch_later", "tiktok"] else "liked")

        for video in videos:
            category_name = video.get("category", "Otros")
            category_id = category_map.get(category_name, category_map.get("Otros"))

            video_data = {
                "youtube_id": video.get("id"),
                "title": video.get("title", "Sin título"),
                "author": video.get("channel") or "Desconocido",
                "description": "",
                "summary": "",
                "duration": video.get("duration", 0),
                "view_count": video.get("view_count", 0),
                "like_count": 0,
                "url": video.get("url", ""),
                "thumbnail": f"https://img.youtube.com/vi/{video.get('id')}/mqdefault.jpg" if video.get("id") else None,
                "category_id": category_id,
                "source": normalized_source
            }

            try:
                response = supabase.table("videos").insert(video_data).execute()
                if response.data:
                    inserted += 1
                    video_id = response.data[0]["id"]

                    # Prepare video-tag relationships
                    for tag in video.get("tags", [])[:10]:
                        tag_lower = tag.lower().strip()
                        if tag_lower in tag_map:
                            video_tags_to_insert.append({
                                "video_id": video_id,
                                "tag_id": tag_map[tag_lower]
                            })
            except Exception as e:
                errors.append(f"Video {video.get('id')}: {str(e)}")

        # Step 4: Insert video-tag relationships
        tags_linked = 0
        if video_tags_to_insert:
            for i in range(0, len(video_tags_to_insert), 100):
                batch = video_tags_to_insert[i:i + 100]
                try:
                    supabase.table("video_tags").insert(batch).execute()
                    tags_linked += len(batch)
                except:
                    pass

        return {
            "success": True,
            "total_videos": len(videos),
            "inserted": inserted,
            "categories_created": len(new_categories),
            "tags_created": len(new_tags),
            "tags_linked": tags_linked,
            "categories_used": list(unique_categories),
            "errors": errors[:10] if errors else None
        }

    except ImportError:
        raise HTTPException(status_code=503, detail="Supabase client not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ==================== TIKTOK IMPORT ====================

# TikTok import job storage
tiktok_jobs: dict = {}

class TikTokImportRequest(BaseModel):
    json_path: str  # Path to user_data_tiktok.json
    source_type: str = "favorites"  # "favorites", "likes", or "both"
    batch_size: int = 50  # Videos per batch
    delay_seconds: float = 2.0  # Delay between videos to avoid rate limiting
    categorize: bool = True  # Use AI to categorize
    max_videos: Optional[int] = None  # Limit for testing (None = all)


class TikTokJob(BaseModel):
    id: str
    status: str  # pending, running, completed, failed, paused
    total_videos: int
    processed: int
    successful: int
    failed: int
    skipped: int  # Already in DB
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    eta_minutes: Optional[float] = None
    current_video: Optional[str] = None
    error: Optional[str] = None
    errors_list: list = []


def extract_tiktok_id_from_url(url: str) -> Optional[str]:
    """Extract TikTok video ID from URL."""
    import re
    # Pattern: /video/1234567890/
    match = re.search(r'/video/(\d+)', url)
    return match.group(1) if match else None


def get_tiktok_metadata_sync(url: str) -> Optional[dict]:
    """Get TikTok video metadata using yt-dlp."""
    import re

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None

            # Extract hashtags from description
            description = info.get('description', '') or ''
            hashtags = re.findall(r'#(\w+)', description)

            return {
                'id': info.get('id'),
                'title': info.get('title') or description[:100],
                'author': info.get('uploader') or info.get('creator') or 'Unknown',
                'description': description,
                'duration': info.get('duration') or 0,
                'view_count': info.get('view_count') or 0,
                'like_count': info.get('like_count') or 0,
                'comment_count': info.get('comment_count') or 0,
                'url': info.get('webpage_url') or url,
                'thumbnail': info.get('thumbnail'),
                'upload_date': info.get('upload_date'),  # YYYYMMDD
                'hashtags': hashtags[:15],  # Limit to 15 hashtags
            }
    except Exception as e:
        print(f"Error fetching TikTok {url}: {e}")
        return None


def parse_tiktok_export(json_path: str, source_type: str) -> list[dict]:
    """Parse TikTok data export JSON and extract video URLs."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    videos = []
    activity = data.get('Your Activity', {})

    if source_type in ('favorites', 'both'):
        favorites = activity.get('Favorite Videos', {}).get('FavoriteVideoList', [])
        for v in favorites:
            video_id = extract_tiktok_id_from_url(v.get('Link', ''))
            if video_id:
                videos.append({
                    'url': v.get('Link'),
                    'tiktok_id': video_id,
                    'favorited_at': v.get('Date'),
                    'source_type': 'tiktok_favorites'
                })

    if source_type in ('likes', 'both'):
        likes = activity.get('Like List', {}).get('ItemFavoriteList', [])
        for v in likes:
            video_id = extract_tiktok_id_from_url(v.get('link', ''))
            if video_id:
                # Avoid duplicates if doing both
                if not any(existing['tiktok_id'] == video_id for existing in videos):
                    videos.append({
                        'url': v.get('link'),
                        'tiktok_id': video_id,
                        'liked_at': v.get('date'),
                        'source_type': 'tiktok_likes'
                    })

    return videos


def process_tiktok_batch_sync(
    job_id: str,
    videos: list[dict],
    batch_size: int,
    delay_seconds: float,
    categorize: bool
):
    """Background task to process TikTok videos."""
    import re
    from supabase import create_client
    import os
    from dotenv import load_dotenv

    # Load environment variables from .env file
    env_path = Path(__file__).parent.parent.parent / ".env"
    load_dotenv(env_path)

    job = tiktok_jobs[job_id]
    job['status'] = 'running'
    job['started_at'] = datetime.now().isoformat()

    # Initialize Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        job['status'] = 'failed'
        job['error'] = 'Supabase credentials not configured'
        return

    supabase = create_client(supabase_url, supabase_key)

    # Get existing TikTok IDs to skip duplicates
    existing_response = supabase.table("videos").select("youtube_id").eq("source", "tiktok").execute()
    existing_ids = {v['youtube_id'] for v in existing_response.data} if existing_response.data else set()

    # Get category map
    categories_response = supabase.table("categories").select("id, name").execute()
    category_map = {c['name']: c['id'] for c in categories_response.data} if categories_response.data else {}
    otros_id = category_map.get('Otros', 1)

    # Get existing tags
    tags_response = supabase.table("tags").select("id, name").execute()
    tag_map = {t['name'].lower(): t['id'] for t in tags_response.data} if tags_response.data else {}

    start_time = time.time()

    for i, video_info in enumerate(videos):
        if job['status'] == 'paused':
            break

        tiktok_id = video_info['tiktok_id']
        job['current_video'] = f"{i+1}/{len(videos)} - {tiktok_id}"

        # Skip if already in DB
        if tiktok_id in existing_ids:
            job['skipped'] += 1
            job['processed'] += 1
            continue

        # Fetch metadata from TikTok
        metadata = get_tiktok_metadata_sync(video_info['url'])

        if not metadata:
            job['failed'] += 1
            job['processed'] += 1
            job['errors_list'].append(f"Failed to fetch: {tiktok_id}")
            time.sleep(delay_seconds)
            continue

        # Prepare video data
        # Convert upload_date from YYYYMMDD to YYYY-MM-DD if present
        upload_date_formatted = None
        if metadata.get('upload_date'):
            raw_date = metadata['upload_date']
            if len(raw_date) == 8:  # YYYYMMDD format
                upload_date_formatted = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"

        video_data = {
            'youtube_id': tiktok_id,  # Reusing field for TikTok ID
            'title': metadata['title'][:500] if metadata['title'] else f"TikTok {tiktok_id}",
            'author': metadata['author'],
            'description': (metadata['description'] or '')[:2000],
            'summary': '',  # Will be filled by AI categorization if enabled
            'duration': metadata['duration'],
            'view_count': metadata['view_count'],
            'like_count': metadata['like_count'],
            'url': metadata['url'],
            'thumbnail': metadata['thumbnail'],
            'upload_date': upload_date_formatted,
            'category_id': otros_id,  # Default, AI will update if categorize=True
            'source': 'tiktok',
        }

        # Insert video
        try:
            response = supabase.table("videos").insert(video_data).execute()
            if response.data:
                video_id = response.data[0]['id']
                job['successful'] += 1
                existing_ids.add(tiktok_id)  # Add to cache

                # Insert hashtags as tags
                for hashtag in metadata.get('hashtags', []):
                    tag_lower = hashtag.lower().strip()
                    if not tag_lower or len(tag_lower) > 100:
                        continue

                    tag_id = tag_map.get(tag_lower)

                    # Create tag if not exists
                    if not tag_id:
                        try:
                            tag_response = supabase.table("tags").insert({"name": tag_lower}).execute()
                            if tag_response.data:
                                tag_id = tag_response.data[0]['id']
                                tag_map[tag_lower] = tag_id
                        except:
                            pass

                    # Link video to tag
                    if tag_id:
                        try:
                            supabase.table("video_tags").insert({
                                "video_id": video_id,
                                "tag_id": tag_id
                            }).execute()
                        except:
                            pass  # Skip duplicate links
            else:
                job['failed'] += 1
                job['errors_list'].append(f"Insert failed: {tiktok_id}")
        except Exception as e:
            job['failed'] += 1
            job['errors_list'].append(f"{tiktok_id}: {str(e)[:100]}")

        job['processed'] += 1

        # Calculate ETA
        elapsed = time.time() - start_time
        if job['processed'] > 0:
            avg_time = elapsed / job['processed']
            remaining = len(videos) - job['processed']
            job['eta_minutes'] = round((remaining * avg_time) / 60, 1)

        # Delay to avoid rate limiting
        time.sleep(delay_seconds)

    job['status'] = 'completed' if job['status'] != 'paused' else 'paused'
    job['completed_at'] = datetime.now().isoformat()
    job['current_video'] = None

    # Save final state to file
    results_file = RESULTS_DIR / f"tiktok_{job_id}.json"
    with open(results_file, 'w') as f:
        json.dump(job, f, indent=2)


@router.post("/tiktok/start")
async def start_tiktok_import(request: TikTokImportRequest, background_tasks: BackgroundTasks):
    """
    Start TikTok import from exported JSON file.
    This runs in background and can take several hours.
    """
    # Validate JSON file exists
    json_path = Path(request.json_path)
    if not json_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.json_path}")

    # Parse the export file
    try:
        videos = parse_tiktok_export(request.json_path, request.source_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing TikTok export: {str(e)}")

    if not videos:
        raise HTTPException(status_code=400, detail="No videos found in export file")

    # Apply max_videos limit if set
    if request.max_videos:
        videos = videos[:request.max_videos]

    # Create job
    job_id = f"tiktok_{int(time.time())}"

    tiktok_jobs[job_id] = {
        'id': job_id,
        'status': 'pending',
        'total_videos': len(videos),
        'processed': 0,
        'successful': 0,
        'failed': 0,
        'skipped': 0,
        'started_at': None,
        'completed_at': None,
        'eta_minutes': None,
        'current_video': None,
        'error': None,
        'errors_list': [],
    }

    # Estimate time
    estimated_time = (len(videos) * request.delay_seconds) / 60

    # Start background processing
    background_tasks.add_task(
        process_tiktok_batch_sync,
        job_id,
        videos,
        request.batch_size,
        request.delay_seconds,
        request.categorize
    )

    return {
        "job_id": job_id,
        "total_videos": len(videos),
        "estimated_minutes": round(estimated_time, 1),
        "estimated_hours": round(estimated_time / 60, 2),
        "message": f"Started processing {len(videos)} TikTok videos. Check /batch/tiktok/status/{job_id} for progress."
    }


@router.get("/tiktok/status/{job_id}")
async def get_tiktok_job_status(job_id: str):
    """Get status of a TikTok import job."""
    if job_id not in tiktok_jobs:
        # Try to load from file
        results_file = RESULTS_DIR / f"tiktok_{job_id}.json"
        if results_file.exists():
            with open(results_file) as f:
                return json.load(f)
        raise HTTPException(status_code=404, detail="Job not found")

    return tiktok_jobs[job_id]


@router.post("/tiktok/pause/{job_id}")
async def pause_tiktok_job(job_id: str):
    """Pause a running TikTok import job."""
    if job_id not in tiktok_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = tiktok_jobs[job_id]
    if job['status'] != 'running':
        raise HTTPException(status_code=400, detail=f"Job is not running (status: {job['status']})")

    job['status'] = 'paused'
    return {"message": "Job paused", "job": job}


@router.get("/tiktok/jobs")
async def list_tiktok_jobs():
    """List all TikTok import jobs."""
    jobs = list(tiktok_jobs.values())

    # Also load completed jobs from files
    for f in RESULTS_DIR.glob("tiktok_*.json"):
        try:
            with open(f) as file:
                job = json.load(file)
                if job['id'] not in tiktok_jobs:
                    jobs.append(job)
        except:
            pass

    return sorted(jobs, key=lambda x: x.get('started_at') or '', reverse=True)


@router.post("/tiktok/preview")
async def preview_tiktok_import(json_path: str, source_type: str = "both"):
    """
    Preview what will be imported from TikTok export without actually importing.
    """
    path = Path(json_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {json_path}")

    try:
        videos = parse_tiktok_export(json_path, source_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing: {str(e)}")

    # Count by source type
    favorites_count = sum(1 for v in videos if v.get('source_type') == 'tiktok_favorites')
    likes_count = sum(1 for v in videos if v.get('source_type') == 'tiktok_likes')

    return {
        "total_videos": len(videos),
        "favorites": favorites_count,
        "likes": likes_count,
        "sample_urls": [v['url'] for v in videos[:5]],
        "estimated_time_hours": round((len(videos) * 2) / 3600, 2),  # 2 seconds per video
    }
