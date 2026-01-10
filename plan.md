# Plan: Añadir doble ratio (videos + items) en sidebars

## Análisis actual

### Sidebar izquierdo (Áreas)
- Actualmente muestra: `video_count` (número de videos en el área)
- El área tiene topics asociados, podríamos mostrar también el número de topics

### Sidebar derecho (Tag Groups)
- Actualmente muestra: `video_count` (número de videos con tags de ese grupo)
- Cada grupo tiene `tag_count` (número de tags en ese grupo)
- Podríamos mostrar ambos: videos / tags

## Propuesta de formato

### Opción A: Formato compacto con separador
```
AI & ChatGPT    36/12
               videos/tags
```
El número de videos primero (más relevante) y número de items después.

### Opción B: Formato con paréntesis
```
AI & ChatGPT    36 (12)
                videos (tags)
```

### Opción C: Solo hover tooltip
Mostrar solo videos como ahora, pero con tooltip al hacer hover mostrando desglose:
- "36 videos | 12 tags"

## Impacto en Performance

### Datos ya disponibles (sin queries adicionales):
- **Tag Groups**: ya tienen `tag_count` y `video_count` en el modelo
- **Áreas**: ya tienen `video_count`, pero NO el número de topics

### Datos que necesitan cálculo:
- **Topics por área**: Se puede calcular en frontend desde `topics.filter(t => t.area_id === area.id).length`
  - Ya tenemos todos los topics cargados, solo es un filter/count

### Para filtered counts:
- Actualmente `filteredCounts` devuelve:
  - `area_counts` (videos por área filtrados)
  - `tag_group_counts` (videos por tag group filtrados)
  - `tag_counts` (videos por tag filtrados)
- NO devuelve número de topics/tags por área/grupo cuando hay filtros
- Añadir esto requeriría expandir el endpoint `/api/taxonomy/counts`

## Decisiones necesarias

1. **¿Mostrar siempre o solo cuando hay espacio?** El sidebar ya es compacto

2. **¿Qué formato preferir?** (A, B, o C)

3. **¿Mostrar counts de items también cuando hay filtros activos?**
   - Opción simple: Solo mostrar el count de items original (no filtrado)
   - Opción compleja: Calcular también items filtrados (más queries)

## Propuesta recomendada

**Formato híbrido con tooltip:**
- Mostrar el número de videos (como ahora, con filtros en azul)
- En hover, tooltip muestra: "36 videos, 12 tags" o "134 videos, 8 topics"
- Sin impacto en performance (datos ya disponibles)
- Sin cambiar la UI actual

## Alternativa visual compacta

Si prefieres ver los dos números directamente:
```
AI & ChatGPT    36 · 12t
                ^    ^
                |    número de tags
                videos
```
Usando "t" para tags y sin sufijo para videos (el principal).

---

## Bug parpadeo infinite scroll

El problema persiste. Posibles causas:
1. El botón "Cargar más" aparece/desaparece constantemente
2. React Query está refetching la query
3. El componente se re-renderiza por cambios de estado

Investigaré más a fondo después de confirmar la solución de doble ratio.
