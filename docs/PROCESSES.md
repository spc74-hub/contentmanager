# Content Manager — Flujos de Negocio

## 1. Importacion de videos desde YouTube Playlist

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (/import)
    participant B as Backend API
    participant YT as YouTube API / yt-dlp

    U->>F: Pega URL de playlist
    U->>F: Configura opciones (metadata, transcript)
    U->>F: Click "Cargar playlist"
    F->>B: GET /api/youtube/playlist/{id}/videos
    B->>YT: Extrae metadata de cada video
    YT-->>B: Titulo, autor, duracion, vistas, thumbnail...
    B-->>F: Lista de videos con metadata
    F->>U: Muestra preview de videos
    U->>F: Click "Guardar en biblioteca"
    F->>B: POST /api/videos/bulk
    B-->>F: Videos creados
    F->>U: Confirmacion de importacion
```

## 2. Importacion de videos desde URLs en bulk

```mermaid
flowchart TD
    A[Usuario pega URLs\nuna por linea] --> B[Click Procesar URLs]
    B --> C{Detectar fuente}
    C -->|YouTube| D[Extraer metadata con yt-dlp]
    C -->|TikTok| E[Extraer metadata con yt-dlp]
    C -->|Desconocido| F[Marcar como error]
    D --> G[Extraer transcript?\nsi esta habilitado]
    E --> G
    G --> H[Guardar en BD]
    H --> I[Mostrar resultados\nexito/fallo por URL]
    F --> I
```

## 3. Procesamiento IA completo de un video

```mermaid
flowchart TD
    A[Job IA iniciado\nPOST /api/ai-process/start] --> B[Obtener videos\nsegun filtros]
    B --> C{Para cada video}
    
    C --> D{Tiene transcript?}
    D -->|No| E{Fuente?}
    E -->|YouTube| F[Extraer subtitulos\nes manual > es auto > en manual > en auto]
    E -->|TikTok| G[Descargar audio\nTranscribir con Whisper]
    F --> H{Subtitulos encontrados?}
    H -->|Si| I[Limpiar VTT:\nquitar timestamps, HTML, duplicados\nLimitar a 15.000 chars]
    H -->|No| J[Marcar sin transcript]
    G --> I
    D -->|Si| I
    
    I --> K{Generar resumen?}
    K -->|Si| L[Enviar transcript a Ollama\nllama3.2:3b, temp 0.3]
    L --> M[Obtener resumen 2-3 frases\n+ 3-5 puntos clave]
    K -->|No| N[Siguiente paso]
    M --> N
    
    N --> O{Categorizar?}
    O -->|Si| P[Clasificacion multi-signal]
    P --> P1[Tags 30%]
    P --> P2[Transcript 50%]
    P --> P3[Descripcion 15%]
    P --> P4[Historial autor 5%]
    P1 & P2 & P3 & P4 --> Q[Combinar senales\nAsignar area + topics]
    Q --> R{Confianza >= 0.4?}
    R -->|Si| S[Guardar area y topics]
    R -->|No| T[Marcar needs_review]
    O -->|No| U[Fin video]
    S --> U
    T --> U
    J --> U
    
    U --> V{Mas videos?}
    V -->|Si| C
    V -->|No| W[Job completado\nMostrar estadisticas]
```

## 4. Busqueda semantica y Chat RAG

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (/assistant)
    participant B as Backend API
    participant O as Ollama
    participant PG as PostgreSQL + pgvector

    Note over U,PG: Prerequisito: videos deben tener embeddings generados

    U->>F: Escribe pregunta / busqueda
    
    alt Modo Busqueda
        F->>B: POST /api/embeddings/search
        B->>O: Generar embedding de la query\n(nomic-embed-text, 768 dim)
        O-->>B: Vector embedding
        B->>PG: SELECT ... ORDER BY embedding <=> query_vec\nWHERE similarity > 0.3
        PG-->>B: Top N videos similares
        B-->>F: Videos con score de similitud
        F->>U: Mostrar resultados ordenados
    else Modo Chat RAG
        F->>B: POST /api/embeddings/chat
        B->>O: Generar embedding de la pregunta
        O-->>B: Vector embedding
        B->>PG: Buscar top 5 videos similares
        PG-->>B: Videos con resumen + puntos clave
        B->>B: Construir contexto:\nTitulo, Autor, Resumen, Puntos clave
        B->>O: Prompt: contexto + pregunta\n(llama3.2:3b)
        O-->>B: Respuesta en lenguaje natural
        B-->>F: Respuesta + fuentes citadas
        F->>U: Mostrar respuesta del asistente
    end
```

## 5. Gestion de taxonomia (clasificacion manual)

```mermaid
flowchart TD
    A[Usuario abre /taxonomy] --> B[Panel izquierdo:\nArbol Areas > Topics]
    
    B --> C{Seleccionar area o topic}
    C --> D[Panel central muestra\nvideos filtrados]
    
    D --> E{Accion?}
    
    E -->|Individual| F[Asignar area\ncon dropdown]
    E -->|Individual| G[Archivar/Validar\ncon botones]
    
    E -->|Masiva| H[Seleccionar\nmultiples videos]
    H --> I{Accion masiva?}
    I -->|Asignar area| J[POST /taxonomy/videos/bulk/assign-area]
    I -->|Asignar topic| K[POST /taxonomy/videos/bulk/assign-topic]
    I -->|Archivar| L[POST /taxonomy/videos/bulk/archive]
    I -->|Validar| M[POST /taxonomy/videos/bulk/validate]
    
    E -->|Gestionar| N{Que gestionar?}
    N -->|Area| O[Crear/Editar/Eliminar area\nAl eliminar: reasignar videos]
    N -->|Topic| P[Crear/Editar/Eliminar topic]
    N -->|Tags| Q[Panel derecho:\nGrupos de tags\nMerge de tags]
```

## 6. Gestion de canales curados

```mermaid
flowchart TD
    A[Usuario abre /channels] --> B{Accion?}
    
    B -->|Anadir canal| C[Pegar URL de YouTube]
    C --> D[Backend resuelve:\nnombre, thumbnail,\nsuscriptores, channel_id]
    D --> E[Configurar atributos:\ntema, nivel, energia,\ntipo uso, idioma]
    E --> F[Canal guardado]
    
    B -->|Importar videos| G[Seleccionar canal(es)]
    G --> H[Click Importar]
    H --> I[Backend extrae videos\nrecientes del canal]
    I --> J[Videos guardados\nen biblioteca]
    
    B -->|Configurar atributos| K[Gestionar temas,\nniveles, energias,\ntipos de uso]
    K --> L[CRUD con color,\norden y etiqueta]
    
    B -->|Exportar| M[GET /channels/export]
    M --> N[Descarga CSV\ncon todos los canales]
```

## 7. Generacion de embeddings e indexacion

```mermaid
flowchart TD
    A[Usuario abre /assistant\nPestana Indexacion] --> B[Ver estadisticas:\nindexados / total]
    
    B --> C{Videos sin indexar?}
    C -->|Si| D[Configurar batch size\nForzar regeneracion?]
    D --> E[Click Generar embeddings]
    E --> F[POST /api/embeddings/generate]
    
    F --> G{Para cada video}
    G --> H[Construir texto:\ntitulo + autor + resumen\n+ puntos clave + descripcion]
    H --> I[Enviar a Ollama\nnomic-embed-text]
    I --> J[Recibir vector 768-dim]
    J --> K[Guardar en columna\nvideos.embedding]
    K --> L{Mas videos?}
    L -->|Si| G
    L -->|No| M[Indexacion completa\nActualizar estadisticas]
    
    C -->|No| N[Todo indexado\nBusqueda semantica lista]
```

## 8. Importacion TikTok

```mermaid
flowchart TD
    A[Usuario tiene exportacion\nJSON de TikTok] --> B{Tipo de archivo?}
    
    B -->|Favorite Videos.json| C[POST /api/tiktok/import/favorites]
    B -->|Exportacion completa| D[POST /api/tiktok/import/json]
    
    C --> E[Parsear JSON:\nURL, autor, fecha]
    D --> E
    
    E --> F[Guardar videos basicos\nen BD]
    
    F --> G{Enriquecer con yt-dlp?}
    G -->|Si| H[POST /api/tiktok/enrich]
    H --> I[Descargar metadata:\nvistas, likes, duracion]
    I --> J{Exito?}
    J -->|Si| K[Actualizar video\ncon metadata completa]
    J -->|No, IP bloqueada| L[Mantener datos basicos]
    
    G -->|No| M[Videos guardados\ncon datos basicos]
    K --> M
    L --> M
```

## Actores del sistema

| Actor | Descripcion |
|-------|-------------|
| **Usuario** | Sergio Porcar, unico usuario de la app |
| **Frontend** | App React corriendo en content.spcapps.com |
| **Backend** | FastAPI corriendo en Docker en VPS |
| **Ollama** | LLM local para categorizacion, resumen y chat |
| **Whisper** | Modelo local para transcripcion de audio |
| **YouTube API** | API oficial para OAuth y playlists |
| **yt-dlp** | Herramienta de scraping de video sin cuota |
| **PostgreSQL + pgvector** | BD relacional con extension de vectores |
