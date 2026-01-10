# CLAUDE.md - Instrucciones para Claude Code

Este archivo contiene instrucciones que Claude debe seguir siempre al trabajar en este proyecto.

## Servidor Backend

El servidor backend usa uvicorn con hot-reload. Cuando se modifican archivos Python, el servidor se reinicia automáticamente pero a veces se queda colgado.

### Cómo levantar el servidor:
```bash
cd /Users/sergioporcarcelda/Proyectos\ VSC/ContentManager/backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Si el servidor se cuelga después de cambios en Python:
1. Matar el proceso del puerto 8000:
   ```bash
   lsof -ti:8000 | xargs kill -9
   ```
2. Esperar 2 segundos y volver a levantar el servidor

### Verificar que el servidor está activo:
```bash
curl -s http://localhost:8000/api/ai-process/health
```

### IMPORTANTE:
- Después de modificar cualquier archivo en `/backend/app/`, verificar que el servidor sigue respondiendo
- Si no responde, reiniciar con los comandos anteriores
- El servidor corre en background, usar `run_in_background: true` en Bash

## Base de Datos (Supabase)

### Límite de 1000 registros
Supabase tiene un límite por defecto de **1000 registros** por consulta. Para tablas grandes (como `videos` con 6000+ registros), SIEMPRE usar paginación:

```python
# Patrón de paginación para Supabase
all_records = []
page_size = 1000
offset = 0

while True:
    response = supabase.table("videos").select("*").range(offset, offset + page_size - 1).execute()

    if response.data:
        all_records.extend(response.data)

    if not response.data or len(response.data) < page_size:
        break  # No más páginas

    offset += page_size
```

### Tablas principales:
- `videos` - Videos importados (~6000+ registros) - REQUIERE PAGINACIÓN
- `curated_channels` - Canales curados
- `areas` - Áreas de taxonomía
- `topics` - Topics por área
- `video_topics` - Relación videos-topics
- `video_tags` - Tags de videos
- `categories` - Categorías legacy

### IMPORTANTE:
- Siempre verificar si una consulta puede devolver más de 1000 registros
- Usar `.range(offset, offset + limit - 1)` para paginar
- Las estadísticas y conteos deben iterar sobre todas las páginas

## Instrucciones Generales

<!-- Añade aquí más instrucciones -->

