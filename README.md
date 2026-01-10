# Content Manager

Aplicación para gestionar y organizar contenidos de YouTube por categorías temáticas.

## Stack Tecnológico

### Frontend
- React 19 + TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- React Router

### Backend
- FastAPI + Python
- Supabase (PostgreSQL)
- YouTube Data API v3

### Infraestructura
- Railway (frontend + backend)
- Supabase (base de datos)

## Configuración Inicial

### 1. Crear tablas en Supabase

Ve a tu proyecto de Supabase > SQL Editor y ejecuta:

```sql
-- Primero ejecuta el archivo schema.sql
-- Luego ejecuta seed_categories.sql
```

Los archivos están en la carpeta `supabase/`.

### 2. Configurar el Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Crea el archivo `.env` (ya existe con tus credenciales).

### 3. Configurar el Frontend

```bash
cd frontend
npm install
```

El archivo `.env` ya tiene la configuración de Supabase.

### 4. Migrar datos existentes

```bash
cd scripts
pip install supabase
python migrate_data.py
```

## Desarrollo

### Iniciar Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Iniciar Frontend

```bash
cd frontend
npm run dev
```

La app estará disponible en:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Despliegue en Railway

### Backend
1. Crear nuevo servicio desde el repo
2. Seleccionar la carpeta `backend`
3. Configurar variables de entorno
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend
1. Crear nuevo servicio desde el repo
2. Seleccionar la carpeta `frontend`
3. Build command: `npm run build`
4. Start command: `npm run preview -- --host --port $PORT`
