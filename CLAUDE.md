# Content Manager — Gestor de contenido multimedia con IA

## Overview

Content Manager es una aplicacion web personal para gestionar una biblioteca de videos de YouTube y TikTok. Permite importar, organizar, clasificar y buscar videos usando taxonomia jerarquica e inteligencia artificial (transcripcion, resumen, categorizacion y busqueda semantica). Desarrollado para uso personal de Sergio Porcar.

## Architecture

| Capa | Stack |
|------|-------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, TanStack React Query 5, React Router 7, Recharts, Lucide Icons |
| **Backend** | FastAPI 0.115, Python 3.12, SQLAlchemy 2.0 (async), Pydantic 2 |
| **Base de datos** | PostgreSQL 16 con pgvector (embeddings 768-dim) |
| **IA local** | Ollama (llama3.2:3b para LLM, nomic-embed-text para embeddings), Whisper (transcripcion audio) |
| **Herramientas** | yt-dlp (scraping video), google-api-python-client (YouTube Data API v3), google-auth-oauthlib (OAuth) |
| **Infra** | Docker Compose, Nginx, VPS Hostinger (72.62.26.203) |
| **Dominio** | content.spcapps.com |
| **Repo** | spc74-hub/contentmanager |

### Estructura del repositorio

```
contentmanager-migration/
├── backend/
│   ├── app/
│   │   ├── main.py              # Entry point FastAPI
│   │   ├── config.py            # Configuracion (DB, OAuth, Ollama)
│   │   ├── auth.py              # JWT auth helpers
│   │   ├── db/
│   │   │   ├── models.py        # 20+ modelos SQLAlchemy
│   │   │   ├── session.py       # AsyncSession factory
│   │   │   └── helpers.py       # Queries reutilizables
│   │   ├── routers/
│   │   │   ├── videos.py        # CRUD videos
│   │   │   ├── categories.py    # Categorias legacy
│   │   │   ├── taxonomy.py      # Areas, Topics, Tags, TagGroups
│   │   │   ├── channels.py      # Canales curados
│   │   │   ├── youtube.py       # OAuth + YouTube API
│   │   │   ├── scraper.py       # yt-dlp scraping
│   │   │   ├── tiktok.py        # Importacion TikTok
│   │   │   ├── batch.py         # Importacion batch (stub)
│   │   │   ├── categorizer.py   # Categorizacion con Ollama
│   │   │   ├── ai_process.py    # Jobs IA: transcripcion, resumen, clasificacion
│   │   │   └── embeddings.py    # Embeddings, busqueda semantica, RAG
│   │   └── utils/
│   │       ├── classification.py # Logica multi-signal de clasificacion
│   │       └── tag_mappings.py   # Mapeos tag->area
│   ├── seed.py                  # Creacion tablas + datos iniciales
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router + QueryClient
│   │   ├── pages/               # 9 paginas principales
│   │   ├── hooks/               # 14 ficheros, 50+ hooks
│   │   ├── components/          # Layout, VideoDetailModal
│   │   ├── lib/                 # api.ts (fetch helper), supabase.ts (legacy)
│   │   └── types/               # TypeScript types
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── CLAUDE.md
└── docs/
    ├── USER_GUIDE.md
    ├── PROCESSES.md
    ├── CHANGELOG.md
    └── BACKLOG.md
```

## Features

### Videos
- Navegacion con vista grid/lista e infinite scroll
- Filtros avanzados: categoria, area, topic, autor, duracion, vistas, tags, fuente, favoritos, estado IA
- Ordenacion por fecha, publicacion, vistas, duracion, titulo
- Seleccion multiple y borrado masivo
- Modal detalle con metadatos, resumen IA, puntos clave, transcripcion
- Copia de transcripcion al portapapeles
- Marcar favoritos

### Taxonomia (Areas, Topics, Tags)
- Panel arbol con 10 areas de vida y ~31 topics predefinidos
- CRUD de areas y topics
- Tag groups para organizar los ~15.000 hashtags existentes
- Merge de tags
- Asignacion masiva de area/topic a videos
- Archivado y validacion masiva
- Filtros por estado (pendiente/validado/archivado) y fuente
- Estadisticas de taxonomia

### Canales curados
- Gestion de canales de YouTube con tematica, nivel, energia, tipo de uso, idioma
- Temas configurables con color y orden
- Niveles, energias y tipos de uso configurables
- Tags de canal
- Favoritos, activar/desactivar, resolver
- Import de videos desde canales
- Busqueda, filtros multiples
- Estadisticas por tema/nivel/energia/idioma
- Exportacion CSV

### Importacion
- Playlist de YouTube (URL, extraccion metadata + transcript)
- Suscripciones (feed o canales guardados, CSV)
- URLs en bulk (YouTube/TikTok, una por linea)
- Import TikTok desde JSON de exportacion
- Scraping con yt-dlp (sin cuota API)
- Importacion batch desde playlists especiales (liked, watch later, takeout) — stub pendiente de migrar

### Procesamiento IA
- Transcripcion automatica: subtitulos YouTube (es/en, manual/auto) o Whisper (para TikTok)
- Resumen y puntos clave generados con Ollama
- Categorizacion automatica multi-signal (tags 30%, transcript 50%, descripcion 15%, historial autor 5%)
- Asignacion automatica de area y topics
- Monitor de jobs: progreso, ETA, errores, pausar/cancelar
- Estadisticas de enriquecimiento por fuente y canal
- Health check de Ollama/Whisper/yt-dlp

### Asistente IA
- Busqueda semantica con embeddings pgvector
- Chat RAG: preguntas en lenguaje natural con contexto de videos
- Indexacion de embeddings con stats y progreso
- Seleccion de modelo Ollama
- Analisis de seleccion (ligero/extendido)

### Autores
- Listado con estadisticas (videos, vistas, distribucion por areas)
- Filtro por area, topic, clasificacion, favoritos
- Barra de distribucion visual por areas
- Click para ver videos del autor

### Dashboard
- Total videos, categorias, autores, duracion
- Distribucion por categoria
- Top 10 autores

### Auth
- JWT con expiracion 72h, algoritmo HS256
- Login con email + password (bcrypt)
- Auth opcional en la mayoria de endpoints
- Usuario seed: sergio.porcar@gmail.com

## Database schema

### Tablas principales

| Tabla | Campos clave | Notas |
|-------|-------------|-------|
| **videos** | id, youtube_id, title, author, description, summary, key_points[], duration, view_count, url, thumbnail, upload_date, category_id, area_id, source, is_favorite, is_archived, is_validated, has_transcript, transcript, embedding(768) | Tabla principal, 6000+ registros |
| **areas** | id, name, name_es, icon, color, sort_order, video_count | 10 areas de vida |
| **topics** | id, area_id, name, name_es, description, video_count | ~31 topics, unique(name, area_id) |
| **video_topics** | video_id, topic_id, confidence, needs_review | Junction con confianza |
| **tags** | id, name, video_count, group_id | ~15.000 hashtags |
| **tag_groups** | id, name, description, icon, color, sort_order | Agrupacion de tags |
| **video_tags** | video_id, tag_id | Junction simple |
| **categories** | id, name, icon, color | Legacy, se mantiene por FK |
| **subcategories** | id, name, category_id, video_count | Legacy |
| **video_subcategories** | video_id, subcategory_id | Legacy junction |
| **curated_channels** | id, name, youtube_url, youtube_channel_id, thumbnail, theme_id, level, energy, use_type, language, is_active, is_favorite, subscriber_count, total_videos_imported | Canales YouTube curados |
| **channel_themes** | id, name, description, color, sort_order | Temas de canales |
| **channel_tags** | id, name, color | Tags de canales |
| **channel_tag_assignments** | channel_id, tag_id | Junction |
| **channel_levels** | id, name, label, color, sort_order | Niveles configurables |
| **channel_energies** | id, name, label, color, sort_order | Energias configurables |
| **channel_use_types** | id, name, label, icon, color, sort_order | Tipos de uso configurables |
| **subscribed_channels** | id, channel_id, channel_name, channel_url, is_active, total_videos_imported | Canales suscritos |
| **favorite_authors** | id, author_name, notes | Autores favoritos |
| **users** | id, email, hashed_password, is_active | Auth JWT |

## API endpoints

### Auth
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, devuelve JWT |

### Videos (`/api/videos`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Listar videos con filtros |
| GET | `/{id}` | Detalle video |
| POST | `/` | Crear video |
| POST | `/bulk` | Crear videos masivo |
| PUT | `/{id}` | Actualizar video |
| DELETE | `/{id}` | Eliminar video |
| POST | `/delete-bulk` | Borrado masivo |
| POST | `/fix-thumbnails` | Regenerar thumbnails |
| GET | `/authors/list` | Lista autores unicos |

### Taxonomia (`/api/taxonomy`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/areas`, `/areas/{id}` | CRUD areas |
| GET/POST/PUT/DELETE | `/topics`, `/topics/{id}` | CRUD topics |
| GET/POST/PUT/DELETE | `/tag-groups`, `/tag-groups/{id}` | CRUD tag groups |
| PUT | `/tags/{id}/group` | Asignar tag a grupo |
| POST | `/tags/merge` | Fusionar tags |
| POST | `/videos/bulk/archive\|unarchive\|validate\|unvalidate\|assign-area\|assign-topic` | Acciones masivas |
| PUT | `/videos/{id}/archive\|unarchive\|validate\|area` | Acciones individuales |
| GET | `/stats` | Estadisticas taxonomia |
| POST | `/counts` | Conteos filtrados |

### Canales (`/api/channels`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/` , `/{id}` | CRUD canales curados |
| POST | `/add-by-url` | Anadir canal por URL |
| POST | `/{id}/toggle-favorite` | Toggle favorito |
| GET/POST/PUT/DELETE | `/themes`, `/levels`, `/energies`, `/use-types` | Configuracion atributos |
| GET/POST/PUT/DELETE | `/tags` | Tags de canales |
| GET | `/stats` | Estadisticas canales |
| GET | `/export` | Exportar CSV |

### YouTube (`/api/youtube`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/auth` | Iniciar OAuth |
| GET | `/callback` | Callback OAuth |
| GET | `/status` | Estado conexion |
| GET | `/playlists` | Playlists del usuario |
| GET | `/playlist/{id}/videos` | Videos de playlist |

### Procesamiento IA (`/api/ai-process`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/start` | Iniciar job IA |
| GET | `/job/{id}` | Estado del job |
| POST | `/cancel/{id}` | Cancelar job |
| GET | `/jobs` | Listar jobs |

### IA Categorizador (`/api/ai`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/categorize` | Categorizar batch con Ollama |
| POST | `/summarize` | Generar resumen |
| GET | `/categories` | Lista categorias default |
| GET | `/health` | Health Ollama |

### Embeddings y RAG (`/api/embeddings`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/generate` | Generar embeddings |
| GET | `/stats` | Estadisticas embeddings |
| POST | `/search` | Busqueda semantica |
| POST | `/chat` | Chat RAG |
| GET | `/models` | Modelos Ollama disponibles |

### Scraper (`/api/scraper`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/scrape` | Scraping con yt-dlp |
| POST | `/status/{id}` | Estado job |
| POST | `/cancel/{id}` | Cancelar job |

### TikTok (`/api/tiktok`)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/import/favorites` | Import favoritos JSON |
| POST | `/import/json` | Import exportacion completa |
| POST | `/enrich` | Enriquecer con yt-dlp |

### Batch (`/api/batch`) — stub
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/start` | Iniciar batch import (devuelve 501) |
| GET | `/job/{id}` | Estado job |
| GET | `/results/{id}` | Resultados |

## Auth

- **Tipo:** JWT (JSON Web Tokens) con HS256
- **Expiracion:** 72 horas
- **Password:** bcrypt (passlib)
- **Flujo:** POST email+password -> JWT token -> Header `Authorization: Bearer <token>`
- **Comportamiento:** Auth opcional en la mayoria de endpoints (no falla si no hay token)
- **Usuario seed:** sergio.porcar@gmail.com / changeme

## Deployment

- **Docker Compose** con 2 servicios:
  - `contentmanager-backend`: Python 3.12 slim + ffmpeg + yt-dlp, puerto 8000
  - `contentmanager-frontend`: Node 20 build + Nginx Alpine, sirve assets estaticos
- **Red:** spcapps-network (externa, compartida con otros servicios)
- **Base de datos:** PostgreSQL compartido en container `spcapps-postgres`
- **Dominio:** content.spcapps.com via Cloudflare Tunnel
- **Auto-deploy:** Webhook en https://webhook.spcapps.com/webhook (git push -> pull + build + restart)
- **PWA:** Service worker con cache de thumbnails YouTube (30 dias)

## Key files

| Fichero | Descripcion |
|---------|-------------|
| `backend/app/main.py` | Entry point FastAPI, registro de routers, CORS, auth endpoints |
| `backend/app/db/models.py` | 20+ modelos SQLAlchemy (todas las tablas) |
| `backend/app/routers/ai_process.py` | Jobs IA: transcripcion, resumen, categorizacion, area |
| `backend/app/routers/taxonomy.py` | CRUD areas/topics/tags, acciones masivas |
| `backend/app/routers/embeddings.py` | Generacion embeddings, busqueda semantica, RAG chat |
| `backend/app/routers/channels.py` | Gestion canales curados con atributos configurables |
| `backend/app/routers/videos.py` | CRUD videos con filtros |
| `backend/app/utils/classification.py` | Logica multi-signal de clasificacion IA |
| `backend/seed.py` | Creacion tablas, extension pgvector, seed areas/topics/user |
| `frontend/src/pages/Taxonomy.tsx` | Pagina taxonomia: arbol + videos + tags |
| `frontend/src/pages/Videos.tsx` | Navegador de videos con filtros e infinite scroll |
| `frontend/src/pages/AIProcessing.tsx` | Monitor jobs IA con configuracion |
| `frontend/src/pages/Assistant.tsx` | Busqueda semantica y chat RAG |
| `frontend/src/hooks/useTaxonomy.ts` | Hooks complejos de taxonomia |
| `docker-compose.yml` | Configuracion Docker para despliegue |

## Backlog

Resumen: pendiente completar la migracion batch, implementar endpoint de favoritos, y resolver flickering del infinite scroll. Ver [docs/BACKLOG.md](docs/BACKLOG.md) para detalle completo.

## Conventions

- Commits en ingles, documentacion y comunicacion en espanol
- Al hacer cambios, actualizar este CLAUDE.md
- Al completar items del backlog, marcarlos en docs/BACKLOG.md y documentar en docs/CHANGELOG.md
- Paginacion obligatoria para consultas a tablas grandes (videos tiene 6000+ registros)
- Backend con hot-reload (uvicorn --reload). Si se cuelga: `lsof -ti:8000 | xargs kill -9`
- No anadir features extra no pedidas
- No crear documentacion innecesaria

### Servidor Backend

El servidor backend usa uvicorn con hot-reload. Cuando se modifican archivos Python, el servidor se reinicia automaticamente pero a veces se queda colgado.

```bash
# Levantar servidor
cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Si se cuelga
lsof -ti:8000 | xargs kill -9

# Verificar health
curl -s http://localhost:8000/api/ai-process/health
```

### Limite de 1000 registros en consultas

Para tablas grandes (videos con 6000+ registros), SIEMPRE usar paginacion con `.range(offset, offset + limit - 1)` o equivalente SQLAlchemy con `limit`/`offset`.

## Documentacion

Ver `docs/` para documentacion detallada:
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — Guia funcional del usuario
- [docs/PROCESSES.md](docs/PROCESSES.md) — Flujos de negocio con diagramas mermaid
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — Historial de cambios
- [docs/BACKLOG.md](docs/BACKLOG.md) — Tareas pendientes por prioridad
