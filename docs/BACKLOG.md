# Content Manager — Backlog

## Prioridad Alta
- [ ] **Completar migracion batch** — El router batch.py esta stubbed (devuelve 501). Migrar la logica de importacion batch (liked videos, watch later, takeout) al nuevo backend SQLAlchemy
- [ ] **Endpoint de favoritos** — El hook useFavorites.ts tiene un TODO: falta endpoint dedicado en el backend. Actualmente devuelve vacio
- [ ] **Limpiar codigo legacy Supabase** — Queda frontend/src/lib/supabase.ts como wrapper de compatibilidad con ts-nocheck. Eliminar todas las referencias a Supabase del frontend

## Prioridad Media
- [ ] **Bug flickering infinite scroll** — El boton "Load more" parpadea en la pagina de Videos (documentado en plan.md)
- [ ] **Doble ratio en sidebars** — Mostrar conteo de videos/items en los widgets laterales de taxonomia (opciones: formato compacto, parentesis o tooltip)
- [ ] **Estadisticas de enriquecimiento en AI Processing** — Completar endpoint de enrichment-stats para desglose por fuente y canal
- [ ] **Autenticacion robusta** — El SECRET_KEY es "change-me-in-production", pasar a variable de entorno real. Auth es opcional en la mayoria de endpoints
- [ ] **Mejorar health check** — Verificar estado real de Ollama, Whisper y yt-dlp en el health endpoint

## Prioridad Baja / Futuro
- [ ] **Persistencia de jobs** — Los jobs de AI processing se almacenan en memoria. Migrar a BD o Redis para sobrevivir reinicios
- [ ] **Drag-and-drop en taxonomia** — El codigo del frontend tiene preparacion para drag-and-drop pero no esta implementado
- [ ] **Filtros por URL** — Sincronizar mas filtros con URL params (actualmente solo author se sincroniza)
- [ ] **Tests** — No hay tests unitarios ni de integracion en el proyecto
- [ ] **Paginacion en mas endpoints** — Varios endpoints devuelven todos los registros sin paginacion
- [ ] **Optimizar bulk operations** — Las operaciones masivas son secuenciales, evaluar batch con SQLAlchemy
- [ ] **Exportacion de videos** — Similar a la exportacion CSV de canales, pero para videos

## Bugs Conocidos
- [ ] **Infinite scroll flicker** — El boton "Load more" parpadea intermitentemente en /videos
- [ ] **Server hot-reload cuelga** — uvicorn con --reload a veces se queda colgado tras cambios en Python. Workaround: matar proceso en puerto 8000 y reiniciar
- [ ] **Supabase wrapper residual** — frontend/src/lib/supabase.ts exporta `any` con ts-nocheck. No causa errores pero es codigo muerto
