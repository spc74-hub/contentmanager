-- Seed Categories
-- Run this AFTER creating the tables

INSERT INTO categories (id, name, icon, color) VALUES
(1, 'IA y Productividad', '🤖', '#3B82F6'),
(2, 'IA: Negocios y Marketing', '💼', '#8B5CF6'),
(3, 'IA: Fundamentos y Herramientas', '🔧', '#06B6D4'),
(4, 'IA: Desarrollo y Programación', '💻', '#10B981'),
(5, 'IA: Futuro, Sociedad y Riesgos', '🌐', '#F59E0B'),
(6, 'Inversión y Finanzas', '📈', '#EF4444'),
(7, 'Negocios y Emprendimiento', '🚀', '#EC4899'),
(8, 'Productividad y Desarrollo Personal', '⚡', '#14B8A6'),
(9, 'Psicología y Filosofía', '🧠', '#6366F1'),
(10, 'Salud y Bienestar', '💪', '#22C55E'),
(11, 'Economía y Geopolítica', '🌍', '#F97316'),
(12, 'Temas Diversos', '📚', '#64748B')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color;

-- Reset the sequence to continue from the last ID
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
