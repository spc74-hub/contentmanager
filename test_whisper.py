#!/usr/bin/env python3
"""
Test script for Whisper transcription of TikTok videos.
"""
import os
import sys
import time
import tempfile
import subprocess
from pathlib import Path

# Test videos - URLs from TikTok export JSON
TEST_VIDEOS = [
    {
        "id": 1,
        "title": "Video de prueba 1",
        "url": "https://www.tiktokv.com/share/video/7587877271755689238/",
        "duration": 60  # Estimated
    },
    {
        "id": 2,
        "title": "Video de prueba 2",
        "url": "https://www.tiktokv.com/share/video/7580811574563114262/",
        "duration": 60
    },
    {
        "id": 3,
        "title": "Video de prueba 3",
        "url": "https://www.tiktokv.com/share/video/7584053741477760278/",
        "duration": 60
    }
]

def download_audio(video_url: str, output_path: str) -> bool:
    """Download audio from TikTok video using yt-dlp."""
    print(f"  Downloading audio...")
    start = time.time()

    try:
        result = subprocess.run([
            sys.executable, "-m", "yt_dlp",
            "-x",  # Extract audio
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", output_path,
            "--quiet",
            "--no-warnings",
            video_url
        ], capture_output=True, text=True, timeout=120)

        elapsed = time.time() - start

        if result.returncode != 0:
            print(f"  ❌ Download failed: {result.stderr[:200]}")
            return False

        print(f"  ✅ Downloaded in {elapsed:.1f}s")
        return True

    except subprocess.TimeoutExpired:
        print(f"  ❌ Download timeout")
        return False
    except Exception as e:
        print(f"  ❌ Download error: {e}")
        return False


def transcribe_audio(audio_path: str, model_size: str = "base") -> tuple[str, float]:
    """Transcribe audio using faster-whisper."""
    print(f"  Transcribing with Whisper ({model_size})...")
    start = time.time()

    try:
        from faster_whisper import WhisperModel

        # Load model (will download on first use)
        model = WhisperModel(model_size, device="cpu", compute_type="int8")

        # Transcribe
        segments, info = model.transcribe(audio_path, language="es", beam_size=5)

        # Collect all text
        text = " ".join([segment.text.strip() for segment in segments])

        elapsed = time.time() - start
        print(f"  ✅ Transcribed in {elapsed:.1f}s (detected language: {info.language}, prob: {info.language_probability:.2f})")

        return text, elapsed

    except Exception as e:
        print(f"  ❌ Transcription error: {e}")
        return "", time.time() - start


def test_single_video(video: dict, model_size: str = "base") -> dict:
    """Test transcription for a single video."""
    print(f"\n{'='*60}")
    print(f"Testing: {video['title'][:50]}...")
    print(f"URL: {video['url']}")
    print(f"Duration: {video['duration']}s")
    print(f"{'='*60}")

    result = {
        "id": video["id"],
        "title": video["title"],
        "duration": video["duration"],
        "transcript": "",
        "download_success": False,
        "transcription_time": 0,
        "error": None
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")

        # Download
        if download_audio(video["url"], audio_path):
            result["download_success"] = True

            # Check if file exists (yt-dlp adds extension)
            actual_path = audio_path
            if not os.path.exists(audio_path):
                # Try with different extensions
                for ext in [".mp3", ".m4a", ".webm", ".opus"]:
                    test_path = audio_path.replace(".mp3", ext)
                    if os.path.exists(test_path):
                        actual_path = test_path
                        break

            if os.path.exists(actual_path):
                file_size = os.path.getsize(actual_path) / 1024
                print(f"  Audio file: {file_size:.1f} KB")

                # Transcribe
                transcript, trans_time = transcribe_audio(actual_path, model_size)
                result["transcript"] = transcript
                result["transcription_time"] = trans_time
            else:
                result["error"] = "Audio file not found after download"
        else:
            result["error"] = "Download failed"

    return result


def main():
    print("="*60)
    print("WHISPER TRANSCRIPTION TEST")
    print("="*60)
    print(f"Testing {len(TEST_VIDEOS)} TikTok videos")
    print("Model: base (smallest, fastest)")
    print()

    # Test with base model first (fastest)
    model_size = "base"
    results = []

    for video in TEST_VIDEOS:
        result = test_single_video(video, model_size)
        results.append(result)

        if result["transcript"]:
            print(f"\n📝 TRANSCRIPT:")
            print("-" * 40)
            print(result["transcript"][:500])
            if len(result["transcript"]) > 500:
                print(f"... ({len(result['transcript'])} chars total)")
            print("-" * 40)

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    successful = [r for r in results if r["transcript"]]
    failed = [r for r in results if not r["transcript"]]

    print(f"✅ Successful: {len(successful)}/{len(results)}")
    print(f"❌ Failed: {len(failed)}/{len(results)}")

    if successful:
        total_duration = sum(r["duration"] for r in successful)
        total_trans_time = sum(r["transcription_time"] for r in successful)
        avg_ratio = total_trans_time / total_duration if total_duration > 0 else 0

        print(f"\n⏱️  Performance:")
        print(f"   Total video duration: {total_duration}s")
        print(f"   Total transcription time: {total_trans_time:.1f}s")
        print(f"   Ratio: {avg_ratio:.2f}x realtime")
        print(f"   (< 1.0 means faster than realtime)")

        # Estimate for all TikToks
        total_tiktok_duration = 4779 * 30  # Assuming avg 30s per TikTok
        estimated_time = total_tiktok_duration * avg_ratio
        print(f"\n📊 Estimate for all 4,779 TikToks:")
        print(f"   Assuming avg 30s per video = {total_tiktok_duration/3600:.1f} hours of content")
        print(f"   Estimated transcription time: {estimated_time/3600:.1f} hours")

    if failed:
        print(f"\n❌ Failed videos:")
        for r in failed:
            print(f"   - {r['title'][:40]}... : {r.get('error', 'Unknown error')}")


if __name__ == "__main__":
    main()
