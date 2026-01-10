# Notas de Implementación - Nueva Taxonomía

## Estado: EN ANÁLISIS (No implementar aún)

---

## 1. ESTRUCTURA DE TAXONOMÍA APROBADA

### Nivel 1: Áreas (10) - Las 10 áreas de vida del usuario
1. 🏋️ Health & Fitness (incluye Food & Cooking como topic)
2. 💼 Business & Career
3. 💰 Money & Finances
4. ❤️ Relationships
5. 🎉 Fun & Recreation
6. 🏠 Physical Environment
7. 🧠 Personal Growth
8. 👨‍👩‍👧‍👦 Family & Friends
9. 🎁 Charity & Legacy
10. 🧘 Spiritual

### Nivel 2: Topics (~45) - Lista controlada, IA asigna
- Ejemplos por área en el análisis completo
- Un video puede tener múltiples topics
- Sistema híbrido: IA asigna + marca baja confianza para revisión

### Nivel 3: Tags - Hashtags originales
- Mantener los 14,945 tags existentes
- Extraer hashtags de títulos/descripciones TikTok a video_tags
- Útiles para búsqueda y descubrimiento

---

## 2. DECISIONES TOMADAS

- [x] Food & Cooking → dentro de Health & Fitness como topic
- [x] Mantener área Charity & Legacy aunque no tenga contenido aún
- [x] Extraer hashtags de TikTok a video_tags
- [x] Eliminar subcategorías actuales, reemplazar por topics
- [x] Sistema híbrido para clasificación (IA + revisión manual)
- [x] Autores: NO clasificación estática, perfil calculado dinámicamente
- [x] Crear tabla favorite_authors para seguir autores específicos
- [x] Videos favoritos: añadir campo is_favorite a videos
- [x] Vista de autores con filtros por área/topic y toggle favoritos

---

## 3. ESTRATEGIA DE AUTORES

### Perfil Dinámico (no estático)
- NO guardar "este autor es de área X"
- CALCULAR en tiempo real basándose en sus videos clasificados
- Cuando IA clasifica nuevo video, consulta historial del autor como contexto
- El contenido del video siempre tiene prioridad sobre el historial del autor

### Tabla favorite_authors (a implementar)
```sql
CREATE TABLE favorite_authors (
  id SERIAL PRIMARY KEY,
  author_name TEXT NOT NULL UNIQUE,
  notes TEXT,  -- "Buen contenido de IA, explica bien"
  created_at TIMESTAMP DEFAULT NOW()
);
-- SIN área/topics fijos - se calculan de sus videos
```

Funcionalidades:
- Marcar autor como favorito (⭐)
- Vista especial de autores favoritos
- Filtrar videos solo de favoritos
- (Futuro) Notificaciones de nuevos videos de favoritos

---

## 4. MODELO DE DATOS PROPUESTO

```sql
-- Tabla: areas (reemplaza categories)
CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INT
);

-- Tabla: topics (reemplaza subcategories)
CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  area_id INT REFERENCES areas(id),
  name TEXT NOT NULL,
  description TEXT,
  video_count INT DEFAULT 0
);

-- Tabla: video_topics (N:N entre videos y topics)
CREATE TABLE video_topics (
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  topic_id INT REFERENCES topics(id) ON DELETE CASCADE,
  confidence FLOAT,  -- 0.0 a 1.0
  needs_review BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (video_id, topic_id)
);

-- Modificación tabla videos:
ALTER TABLE videos ADD COLUMN area_id INT REFERENCES areas(id);

-- Tabla: favorite_authors
CREATE TABLE favorite_authors (
  id SERIAL PRIMARY KEY,
  author_name TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. ESTADÍSTICAS ACTUALES (Enero 2026)

| Métrica | Valor |
|---------|-------|
| Total videos | 5,528 |
| YouTube (playlist) | 503 |
| TikTok | 4,779 |
| Total autores | 3,676 |
| Autores con 1 video | 79.5% (2,921) |
| Autores con 5+ videos | 80 |
| Tags únicos | 14,945 |
| Subcategorías (a eliminar) | 1,032 |
| Videos en "Otros" | 57% |
| Videos sin tags extraídos | 96% |
| **Procesados (IA)** | **2,468 (44.6%)** |
| **Pendientes** | **3,060 (55.4%)** |

---

## 6. TIMING DE IMPLEMENTACIÓN

### Estado actual del procesamiento
- 2,468 videos YA procesados con sistema antiguo (categories + subcategories)
- 3,060 videos PENDIENTES de procesar

### Impacto en migración
| Escenario | Videos a migrar | Videos nuevos con sistema nuevo |
|-----------|-----------------|--------------------------------|
| Implementar AHORA | 2,468 | 3,060 (los pendientes) |
| Esperar a que termine | ~5,500 | Solo futuros imports |

### Recomendación
**Implementar PRONTO** - Así los 3,060 pendientes se procesan directamente
con el nuevo sistema y no hay que migrarlos después.

---

## 7. PLAN DE IMPLEMENTACIÓN (PENDIENTE)

### Fase 1: Base de datos
- [ ] Crear tablas areas y topics con datos iniciales
- [ ] Crear tabla favorite_authors
- [ ] Añadir campo is_favorite a videos
- [ ] Añadir campo area_id a videos

### Fase 2: Migración de datos existentes
- [ ] Extraer hashtags de títulos TikTok a video_tags
- [ ] Migrar videos procesados: category_id → area_id (mapping)
- [ ] Migrar subcategories relevantes → topics

### Fase 3: Nueva clasificación IA
- [ ] Modificar prompt de IA para usar area + topics
- [ ] Añadir contexto dinámico del autor al prompt
- [ ] Implementar marcado de baja confianza (needs_review)

### Fase 4: Frontend
- [ ] Actualizar filtros para usar areas/topics
- [ ] Nueva vista de Autores con filtros y favoritos
- [ ] Botón favorito en videos (⭐)
- [ ] Botón favorito en autores (⭐)
- [ ] Vista de revisión para videos con baja confianza

### Fase 5: Limpieza
- [ ] Eliminar tabla subcategories
- [ ] Eliminar tabla video_subcategories
- [ ] (Opcional) Eliminar tabla categories si ya no se usa

---

## 8. PREGUNTAS PENDIENTES

- ¿Lista definitiva de los ~45 topics por área?
- ¿Qué hacer con videos procesados con sistema antiguo: migrar automático o re-procesar con IA?

---

*Última actualización: 2026-01-06*
