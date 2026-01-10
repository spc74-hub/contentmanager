-- Seed data for channel_themes
-- 27 themes from Canales_YouTube_MASTER_400_INTELIGENTE.xlsx

INSERT INTO channel_themes (name, color, sort_order) VALUES
  ('Alimentación', '#22c55e', 1),
  ('Arte', '#ec4899', 2),
  ('Astronomía', '#6366f1', 3),
  ('Caridad y Legado', '#f59e0b', 4),
  ('Ciencia y Naturaleza', '#10b981', 5),
  ('Cine', '#ef4444', 6),
  ('Comunicación y Habilidades', '#8b5cf6', 7),
  ('Entretenimiento Inteligente', '#f97316', 8),
  ('Familia y Educación', '#06b6d4', 9),
  ('Filosofía', '#64748b', 10),
  ('Finanzas Personales', '#84cc16', 11),
  ('Fitness', '#14b8a6', 12),
  ('Geopolítica', '#dc2626', 13),
  ('Golf', '#22d3ee', 14),
  ('Historia', '#a855f7', 15),
  ('Hábitos', '#eab308', 16),
  ('Inversión', '#16a34a', 17),
  ('Libros y Learning', '#7c3aed', 18),
  ('Música', '#e11d48', 19),
  ('Negocio y Emprendimiento', '#0ea5e9', 20),
  ('Productividad', '#f472b6', 21),
  ('Psicología', '#a78bfa', 22),
  ('Religión Católica', '#fbbf24', 23),
  ('Tecnología', '#3b82f6', 24),
  ('Tecnología SAP', '#1d4ed8', 25),
  ('Viajes y Experiencias', '#fb923c', 26),
  ('Yoga y Movilidad', '#2dd4bf', 27)
ON CONFLICT (name) DO NOTHING;
