# Content Manager — Guia de Usuario

## Introduccion

Content Manager es una aplicacion web para gestionar tu biblioteca personal de videos de YouTube y TikTok. Permite importar, organizar, clasificar con IA y buscar semanticamente entre miles de videos.

La app se accede desde **content.spcapps.com** y funciona como PWA (se puede instalar en el movil).

---

## Dashboard (/)

La pagina principal muestra un resumen general de tu biblioteca:

- **Total de videos** en la biblioteca
- **Categorias** existentes
- **Autores** unicos
- **Duracion total** acumulada de todos los videos
- **Distribucion por categorias**: lista con icono, nombre y cantidad de videos por categoria
- **Top 10 autores**: ranking de los autores con mas videos importados

---

## Videos (/videos)

Navegador principal de la biblioteca de videos.

### Vistas
- **Grid**: tarjetas con thumbnail, titulo, autor, duracion y stats. Responsive de 1 a 4 columnas
- **Lista**: filas compactas con la info esencial

### Filtros disponibles
- **Categoria** (legacy): dropdown con categorias predefinidas
- **Area** (nueva taxonomia): selecciona una de las 10 areas de vida
- **Topic**: topics dentro del area seleccionada
- **Autor**: busqueda por nombre de autor
- **Duracion**: rangos (0-5, 5-15, 15-30, 30-60, 60+ minutos)
- **Vistas**: rangos (0-10K, 10K-100K, 100K-1M, 1M+)
- **Tags**: busqueda con autocompletado entre los ~15.000 hashtags
- **Fuente**: liked_videos, playlist, tiktok, subscription, curated_channel
- **Canal curado**: filtrar por canal especifico
- **Favoritos**: mostrar solo favoritos
- **Estado IA**: todos / procesados / pendientes

### Ordenacion
- Por: fecha de creacion, fecha de publicacion, vistas, duracion, titulo
- Orden: ascendente / descendente

### Acciones
- **Click en video**: abre modal de detalle
- **Estrella**: marcar/desmarcar como favorito
- **Checkbox**: seleccionar multiples videos
- **Borrado masivo**: eliminar todos los seleccionados (con confirmacion)
- **Infinite scroll**: se cargan mas videos automaticamente al hacer scroll

### Modal de detalle de video
- Thumbnail con boton de play
- Stats: vistas, likes, duracion
- Botones: "Ver original" (abre en YouTube/TikTok), "Abrir en nueva pestana"
- Descripcion original del video
- **Resumen IA** (caja azul): resumen de 2-3 frases generado por IA
- **Puntos clave** (caja verde): lista de 3-5 puntos principales
- **Transcripcion completa**: texto transcrito con boton de copiar
- Sidebar con metadatos: autor, fuente, categoria/area, fechas, subcategorias, tags

---

## Autores (/authors)

Explora los creadores de contenido de tu biblioteca.

### Filtros
- **Busqueda** por nombre de autor
- **Area**: filtrar autores que tengan videos en un area concreta
- **Topic**: filtrar por topic (requiere area seleccionada)
- **Clasificacion**: Todos / Clasificados (con area) / Sin clasificar
- **Favoritos**: solo autores marcados como favoritos

### Tarjeta de autor
- Avatar con la primera letra del nombre
- Cantidad de videos y vistas totales
- **Barra de distribucion**: muestra visualmente el porcentaje de videos en cada area (coloreada)
- Tags de areas con cantidad de videos (maximo 4 visibles, "+X mas")
- Estrella para marcar favorito
- Click en la tarjeta navega a `/videos?author=nombre` para ver sus videos

### Estadisticas
- Cabecera con: autores filtrados / total | autores con area | favoritos

---

## Taxonomia (/taxonomy)

Interfaz compleja de tres paneles para clasificar contenido.

### Panel izquierdo — Arbol de navegacion
- Lista expandible de **Areas** (10 areas de vida)
- Cada area muestra sus **Topics** al expandirse
- Cantidad de videos por area y topic
- Botones para crear, editar y eliminar areas y topics
- Al eliminar un area, opcion de reasignar videos a otra area

### Panel central — Lista de videos
- Infinite scroll de videos filtrados por la seleccion del arbol
- Filtros adicionales:
  - **Estado**: todos, pendientes (sin area), validados, archivados
  - **Fuente**: incluir/excluir fuentes especificas
- Ordenacion por fecha, publicacion, likes, vistas, titulo
- Por cada video:
  - Badges de estado (archivado, validado, pendiente)
  - Botones de archivar/validar
  - Dropdown para asignar area

### Panel derecho — Tags y TagGroups
- Lista de grupos de tags
- Tags dentro de cada grupo
- Asignacion masiva de tags a videos seleccionados

### Acciones masivas
- Seleccionar multiples videos con checkboxes
- **Archivar/Desarchivar** masivo
- **Validar/Desvalidar** masivo
- **Asignar area** a todos los seleccionados
- **Asignar topic** a todos los seleccionados

### Paneles colapsables
- Los paneles izquierdo y derecho se pueden colapsar para dar mas espacio al central

---

## Canales (/channels)

Gestion de canales de YouTube curados.

### Atributos de cada canal
- **Nombre** y URL de YouTube
- **Tema**: categoria tematica del canal (configurable, con color)
- **Nivel**: principiante / intermedio / avanzado (configurable)
- **Energia**: baja / media / alta (configurable)
- **Tipo de uso**: aprendizaje / inspiracion / entretenimiento / referencia (configurable)
- **Idioma**: espanol, ingles, otro
- **Suscriptores**: cantidad formateada (1.2M, 500K)
- **Videos importados**: cantidad total y fecha de ultima importacion
- **Estado**: activo/inactivo, resuelto, favorito
- **Tags de canal**: etiquetas adicionales

### Operaciones
- **Anadir canal**: por URL de YouTube (resuelve automaticamente nombre, thumbnail, suscriptores)
- **Editar**: modificar cualquier atributo
- **Eliminar**: borrar canal
- **Favorito**: toggle estrella
- **Importar videos**: descargar videos recientes del canal
- **Importar masivo**: importar de multiples canales a la vez

### Filtros
- Busqueda por nombre
- Filtro por tema, nivel, energia, tipo de uso, idioma

### Configuracion de atributos
- Los temas, niveles, energias y tipos de uso son **configurables**: se pueden crear, editar, eliminar y reordenar

### Estadisticas
- Total canales y canales resueltos
- Desglose por tema, nivel, energia, tipo de uso, idioma, rango de suscriptores

### Exportacion
- Exportar todos los canales como CSV

---

## Importacion (/import)

Tres pestanas para importar videos de diferentes fuentes.

### Pestana 1: Playlist
1. Pegar URL de playlist de YouTube
2. Opciones: extraer metadata completa, extraer transcripcion
3. Click "Cargar playlist" (muestra temporizador)
4. Visualizar lista de videos extraidos con metadata
5. Opciones de guardado: incluir subcategorias, resumen
6. Click "Guardar en biblioteca" para insertar masivamente

### Pestana 2: Suscripciones
Dos sub-pestanas:
- **Feed**: carga canales suscritos, selecciona cuales importar, configura videos por canal
- **Canales guardados**: sube CSV de canales, selecciona cuales importar

### Pestana 3: URLs en bulk
1. Pegar multiples URLs de video (una por linea, YouTube o TikTok)
2. Opcion de extraer transcripcion
3. Click "Procesar URLs" (muestra temporizador)
4. Tabla de resultados mostrando exito/fallo por URL
5. Deteccion automatica de fuente (YouTube/TikTok)

### Notas
- El temporizador muestra tiempo transcurrido durante el procesamiento
- Los errores se muestran en alertas individuales
- Los videos se pueden previsualizar antes de guardar

---

## Procesamiento IA (/ai-processing)

Gestion de jobs de enriquecimiento con IA.

### Estado del sistema
- **Ollama**: estado, modelo cargado, modelos disponibles
- **Whisper**: disponibilidad
- **yt-dlp**: version instalada

### Configuracion de procesamiento
- **Fuente**: all / subscription / liked_videos / playlist / tiktok / curated_channel
- **Canal curado**: seleccionar canal especifico
- **Opciones de procesamiento** (checkboxes):
  - Transcripcion (subtitulos YouTube o Whisper)
  - Resumen (generado por LLM)
  - Puntos clave
  - Categorizacion (asignacion de area)
  - Subcategorias
- **Modelo Whisper**: tiny / base / small / medium / large
- **Limite de videos**: procesar solo N videos
- **Filtros**: saltar ya procesados, solo sin area, solo sin puntos clave, solo sin resumen

### Monitor de jobs
- **Estado**: running / completed / failed / paused
- **Progreso**: procesados / total
- **Desglose**: transcritos, resumidos, categorizados, puntos clave, area asignada
- **Fallidos/Saltados**: con lista de errores expandible
- **Video actual**: titulo del video en proceso
- **ETA**: minutos estimados restantes
- **Controles**: pausar, reanudar, cancelar

### Estadisticas de enriquecimiento
- Stats globales: total videos, archivados
- Desglose por fuente: cantidad de videos y datos faltantes
- Datos faltantes: sin transcripcion, sin area, sin resumen, sin puntos clave, sin topics
- Desglose por canal (expandible)
- Botones "Configurar" para iniciar procesamiento directo desde las stats

### Historial de jobs
- Lista de jobs ejecutados con estado, fechas y resultados

---

## Asistente IA (/assistant)

Interfaz de busqueda inteligente y chat con IA.

### Pestana Busqueda
- Campo de busqueda semantica (busca por significado, no solo palabras)
- Resultados: tarjetas con titulo, autor, resumen y puntuacion de similitud
- Boton "Analizar resultados" con dos modos:
  - **Ligero**: analisis rapido
  - **Extendido**: analisis mas profundo
- Los resultados se muestran en un modal con markdown renderizado

### Pestana Chat
- Historial de mensajes (usuario/asistente)
- Campo de texto para preguntas en lenguaje natural
- El asistente responde usando el **contexto de tus videos** (RAG)
- Selector de modelo Ollama
- Boton limpiar chat

### Pestana Indexacion
- Estadisticas: videos indexados / total, porcentaje
- Barra de progreso
- Configuracion: tamano de batch, forzar regeneracion
- Boton "Generar embeddings"
- **Importante**: los videos necesitan estar indexados (tener embedding) para que la busqueda semantica y el chat funcionen

### Barra de estadisticas
- Muestra porcentaje de indexacion
- Link directo a la pestana de indexacion si hay videos pendientes

---

## Datos y restricciones

### Fuentes de video soportadas
- **YouTube**: playlists, liked videos, watch later, suscripciones, canales curados
- **TikTok**: exportacion JSON de favoritos, exportacion completa de datos

### Formatos de datos
- **Duracion**: en segundos (se formatea como HH:MM:SS en la UI)
- **Vistas/Likes**: numeros enteros (se formatean como K, M, B)
- **Fechas**: ISO format o YYYYMMDD (upload_date)
- **Transcripciones**: texto plano, max ~15.000 caracteres
- **Embeddings**: vectores de 768 dimensiones (nomic-embed-text)
- **Thumbnails**: URLs de YouTube (cacheadas 30 dias por el service worker)

### Taxonomia
- **10 Areas de vida**: Health & Fitness, Business & Career, Money & Finances, Relationships, Fun & Recreation, Physical Environment, Personal Growth, Family & Friends, Charity & Legacy, Spiritual
- **~31 Topics** predefinidos distribuidos entre las areas
- **~15.000 Tags** (hashtags) existentes de los videos importados
- Un video tiene exactamente 1 area (o ninguna) y puede tener multiples topics y tags

### Estados de video
- **Pendiente**: sin area asignada (por defecto)
- **Validado**: area confirmada manualmente
- **Archivado**: ocultado de las vistas principales
- **Favorito**: marcado para acceso rapido
