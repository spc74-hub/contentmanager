#!/usr/bin/env python3
"""
Script para migrar los datos de data.js a Supabase.
Ejecutar desde la carpeta ContentManager:
    python scripts/migrate_data.py
"""

import json
import re
import os
from supabase import create_client

# Configuración - ajustar según tu .env
SUPABASE_URL = "https://pxehtmaykinglsmizezi.supabase.co"
SUPABASE_KEY = "sb_publishable_gaNuUSrcWcNwKwqs_TTlpA_hkKLKXnh"

# Ruta al archivo data.js original
DATA_JS_PATH = "../Vermastarde1/data.js"


def parse_data_js(file_path: str) -> tuple[list, list]:
    """Parse the data.js file to extract videos and categories."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract videosData array
    videos_match = re.search(r'const videosData = \[(.*?)\];', content, re.DOTALL)
    categories_match = re.search(r'const categoriesData = \[(.*?)\];', content, re.DOTALL)

    videos = []
    categories = []

    if videos_match:
        # Parse videos - this is a simplified parser
        video_pattern = r'\{[^}]+\}'
        for match in re.finditer(video_pattern, videos_match.group(1)):
            video_str = match.group()
            try:
                # Extract fields using regex
                video = {}

                id_match = re.search(r'id:\s*(\d+)', video_str)
                title_match = re.search(r'title:\s*"([^"]*)"', video_str)
                author_match = re.search(r'author:\s*"([^"]*)"', video_str)
                category_match = re.search(r'categoryId:\s*(\d+)', video_str)
                summary_match = re.search(r'summary:\s*"([^"]*)"', video_str)
                duration_match = re.search(r'duration:\s*(\d+)', video_str)
                likes_match = re.search(r'likes:\s*(\d+)', video_str)
                url_match = re.search(r'url:\s*"([^"]*)"', video_str)

                if all([id_match, title_match, author_match, category_match, summary_match]):
                    videos.append({
                        'id': int(id_match.group(1)),
                        'title': title_match.group(1),
                        'author': author_match.group(1),
                        'category_id': int(category_match.group(1)),
                        'summary': summary_match.group(1),
                        'duration': int(duration_match.group(1)) if duration_match else 0,
                        'likes': int(likes_match.group(1)) if likes_match else 0,
                        'url': url_match.group(1) if url_match else '',
                    })
            except Exception as e:
                print(f"Error parsing video: {e}")

    if categories_match:
        category_pattern = r'\{[^}]+\}'
        for match in re.finditer(category_pattern, categories_match.group(1)):
            cat_str = match.group()
            try:
                id_match = re.search(r'id:\s*(\d+)', cat_str)
                name_match = re.search(r'name:\s*"([^"]*)"', cat_str)
                icon_match = re.search(r'icon:\s*"([^"]*)"', cat_str)
                color_match = re.search(r'color:\s*"([^"]*)"', cat_str)

                if all([id_match, name_match, icon_match, color_match]):
                    categories.append({
                        'id': int(id_match.group(1)),
                        'name': name_match.group(1),
                        'icon': icon_match.group(1),
                        'color': color_match.group(1),
                    })
            except Exception as e:
                print(f"Error parsing category: {e}")

    return videos, categories


def migrate_to_supabase(videos: list, categories: list):
    """Migrate data to Supabase."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Insert categories first
    print(f"Migrando {len(categories)} categorías...")
    for cat in categories:
        try:
            supabase.table("categories").upsert(cat).execute()
            print(f"  ✓ Categoría: {cat['name']}")
        except Exception as e:
            print(f"  ✗ Error en categoría {cat['name']}: {e}")

    # Insert videos
    print(f"\nMigrando {len(videos)} videos...")
    for video in videos:
        try:
            # Remove 'id' to let Supabase auto-generate it
            video_data = {k: v for k, v in video.items() if k != 'id'}
            supabase.table("videos").insert(video_data).execute()
            print(f"  ✓ Video: {video['title'][:50]}...")
        except Exception as e:
            print(f"  ✗ Error en video {video['title'][:30]}: {e}")

    print("\n✅ Migración completada!")


def main():
    # Ajustar ruta relativa
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, DATA_JS_PATH)

    if not os.path.exists(data_path):
        # Intentar ruta alternativa
        data_path = "/Users/sergioporcarcelda/Proyectos VSC/Notebooklm/Vermastarde1/data.js"

    if not os.path.exists(data_path):
        print(f"❌ No se encontró el archivo: {data_path}")
        return

    print(f"📁 Leyendo datos de: {data_path}")
    videos, categories = parse_data_js(data_path)

    print(f"📊 Encontrados: {len(videos)} videos, {len(categories)} categorías")

    if not videos or not categories:
        print("❌ No se pudieron extraer los datos")
        return

    print("\n🚀 Iniciando migración a Supabase...")
    migrate_to_supabase(videos, categories)


if __name__ == "__main__":
    main()
