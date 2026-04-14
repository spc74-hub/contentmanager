# Changelog

## 2026-04-12
- **refactor:** Migracion completa de Supabase a PostgreSQL self-hosted con FastAPI + SQLAlchemy async
- **fix:** Errores TypeScript por codigo legacy de Supabase (dead code en useTaxonomy, cast en VideoDetailModal)
- **fix:** Wrapper de compatibilidad Supabase con ts-nocheck
- **fix:** Error de indentacion en batch.py, stub de migracion batch incompleta

## 2026-01-12
- **feat:** Atributos configurables para canales (niveles, energias, tipos de uso) con CRUD completo
- **feat:** Gestion de temas para canales con colores y orden personalizable
- **feat:** Edicion mejorada de canales con todos los nuevos atributos
- **feat:** Soporte PWA para instalacion en iOS (home screen)

## 2026-01-11
- **feat:** Filtros por idioma y rango de suscriptores en canales
- **feat:** Tags personalizados para canales con asignacion y colores
- **feat:** Resolucion automatica de URL y conteo de suscriptores al anadir canal
- **feat:** Importacion masiva de favoritos con delays para evitar rate limiting
- **feat:** Exportacion CSV de canales
- **feat:** Grupos de temas colapsables en la pagina de canales
- **feat:** Sistema de favoritos para canales curados
- **fix:** Uso de yt-dlp desde PATH en lugar de ruta local
- **fix:** Imports no usados en Channels.tsx

## 2026-01-10
- **feat:** Commit inicial con toda la funcionalidad base:
  - Frontend React 19 + TypeScript + Vite + Tailwind
  - Backend FastAPI con conexion a Supabase
  - Dashboard, Videos, VideoDetail, Autores, Taxonomia, Canales, Import, AI Processing, Assistant
  - Importacion desde YouTube playlists, suscripciones, URLs bulk, TikTok
  - Procesamiento IA: transcripcion, resumen, categorizacion, embeddings
  - Busqueda semantica y chat RAG
  - Taxonomia con 10 areas de vida y ~31 topics
  - Gestion de canales curados con temas
  - Autenticacion JWT
  - Deploy en Railway + Supabase
