-- Migration Script: Categories → Areas
-- Maps existing category_id to new area_id for processed videos
-- Videos in "Otros" (category_id=3) will NOT be migrated - they need AI re-processing

-- ============================================================================
-- MAPPING: Old Categories → New Areas
-- ============================================================================
--
-- Old Category                 → New Area
-- ---------------------------    --------------------------
-- 1. Entretenimiento           → 5. Ocio y Entretenimiento
-- 2. Educación                 → 7. Crecimiento Personal
-- 3. Otros                     → NULL (needs re-processing)
-- 4. Desarrollo Personal       → 7. Crecimiento Personal
-- 5. Finanzas                  → 3. Dinero y Finanzas
-- 6. Tecnología                → 2. Negocio y Carrera
--
-- ============================================================================

-- Migrate Entretenimiento → Ocio y Entretenimiento
UPDATE videos SET area_id = 5 WHERE category_id = 1;

-- Migrate Educación → Crecimiento Personal
UPDATE videos SET area_id = 7 WHERE category_id = 2;

-- Migrate Desarrollo Personal → Crecimiento Personal
UPDATE videos SET area_id = 7 WHERE category_id = 4;

-- Migrate Finanzas → Dinero y Finanzas
UPDATE videos SET area_id = 3 WHERE category_id = 5;

-- Migrate Tecnología → Negocio y Carrera
UPDATE videos SET area_id = 2 WHERE category_id = 6;

-- "Otros" (category_id = 3) stays NULL - these need AI re-processing
-- They will be processed with the new taxonomy system

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check migration results:
-- SELECT
--     COALESCE(a.name_es, 'Sin área (pendiente)') as area,
--     COUNT(*) as videos
-- FROM videos v
-- LEFT JOIN areas a ON v.area_id = a.id
-- GROUP BY a.name_es, a.sort_order
-- ORDER BY a.sort_order NULLS LAST;

-- Videos pending re-processing (were in "Otros"):
-- SELECT COUNT(*) as pending_reprocess FROM videos WHERE area_id IS NULL;
