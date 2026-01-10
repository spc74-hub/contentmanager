-- Seed Tag Groups (~50 semantic groups)
-- Run this AFTER schema_taxonomy_management.sql

-- ============================================================================
-- INSERT TAG GROUPS
-- ============================================================================

INSERT INTO tag_groups (name, description, icon, color, sort_order) VALUES
-- INVESTING & FINANCE
('Value Investing', 'Warren Buffett, value investing, fundamental analysis', '📈', '#22C55E', 1),
('Stock Market', 'Stocks, bolsa, acciones, trading', '📊', '#3B82F6', 2),
('ETFs & Index Funds', 'ETFs, fondos indexados, passive investing', '📉', '#6366F1', 3),
('Crypto', 'Bitcoin, ethereum, blockchain, criptomonedas', '🪙', '#F59E0B', 4),
('Personal Finance', 'Finanzas personales, ahorro, presupuesto', '💰', '#10B981', 5),
('Financial Freedom', 'Libertad financiera, FIRE, independencia', '🔓', '#14B8A6', 6),
('Real Estate', 'Inmobiliario, propiedades, alquiler', '🏠', '#8B5CF6', 7),

-- BUSINESS & CAREER
('Entrepreneurship', 'Emprendimiento, startup, negocio', '🚀', '#EC4899', 8),
('Marketing', 'Marketing, ventas, growth, publicidad', '📢', '#F97316', 9),
('Career Advice', 'Carrera, trabajo, empleo, CV', '💼', '#0EA5E9', 10),
('Mentorship', 'Mentores, consejos, coaching', '🎓', '#6366F1', 11),
('Remote Work', 'Trabajo remoto, freelance, digital nomad', '🌍', '#22D3EE', 12),

-- TECHNOLOGY
('AI & ChatGPT', 'Inteligencia artificial, ChatGPT, OpenAI, prompts', '🤖', '#A855F7', 13),
('Programming', 'Coding, programacion, developer, software', '💻', '#3B82F6', 14),
('Tech News', 'Tecnologia, gadgets, apps, novedades tech', '📱', '#64748B', 15),
('Notion & Tools', 'Notion, productividad digital, herramientas', '🛠️', '#334155', 16),

-- HEALTH & FITNESS
('Fitness', 'Fitness, gym, workout, ejercicio, entrenamiento', '💪', '#EF4444', 17),
('Nutrition', 'Nutricion, dieta, alimentacion, macros, calorias', '🥗', '#84CC16', 18),
('Keto & Fasting', 'Keto, ayuno intermitente, low carb', '🥑', '#65A30D', 19),
('Mental Health', 'Salud mental, ansiedad, estres, terapia', '🧠', '#8B5CF6', 20),
('Sleep', 'Sueno, dormir, descanso, recuperacion', '😴', '#6366F1', 21),
('Golf', 'Golf, swing, clubs, courses', '⛳', '#16A34A', 22),

-- PERSONAL DEVELOPMENT
('Habits', 'Habitos, rutina, disciplina, constancia', '🎯', '#F59E0B', 23),
('Motivation', 'Motivacion, inspiracion, superacion', '🔥', '#EF4444', 24),
('Mindset', 'Mentalidad, mindset, actitud, crecimiento', '💭', '#8B5CF6', 25),
('Stoicism', 'Estoicismo, filosofia, sabiduria', '🏛️', '#64748B', 26),
('Psychology', 'Psicologia, comportamiento, mente', '🧩', '#EC4899', 27),
('Books & Reading', 'Libros, lectura, resumenes, aprendizaje', '📚', '#A855F7', 28),
('Public Speaking', 'Ted talks, presentaciones, comunicacion', '🎤', '#F97316', 29),

-- RELATIONSHIPS
('Dating', 'Citas, dating, relaciones, amor', '💕', '#EC4899', 30),
('Communication', 'Comunicacion, conversacion, escucha', '💬', '#3B82F6', 31),
('Social Skills', 'Habilidades sociales, networking, carisma', '🤝', '#10B981', 32),

-- LIFESTYLE & FUN
('Travel', 'Viajes, travel, turismo, destinos', '✈️', '#0EA5E9', 33),
('Music', 'Musica, canciones, artistas, conciertos', '🎵', '#A855F7', 34),
('Gaming', 'Videojuegos, gaming, esports', '🎮', '#6366F1', 35),
('Movies & Series', 'Peliculas, series, Netflix, cine', '🎬', '#EF4444', 36),
('Food & Cooking', 'Cocina, recetas, comida, restaurantes', '🍳', '#F59E0B', 37),
('Marbella & Costa del Sol', 'Marbella, Costa del Sol, Andalucia', '🌴', '#22D3EE', 38),

-- FAMILY & HOME
('Parenting', 'Crianza, hijos, educacion infantil', '👶', '#F97316', 39),
('Home & Decor', 'Casa, decoracion, hogar, organizacion', '🏡', '#8B5CF6', 40),
('Minimalism', 'Minimalismo, orden, simplicidad', '✨', '#64748B', 41),

-- SPIRITUAL
('Meditation', 'Meditacion, mindfulness, calma', '🧘', '#A855F7', 42),
('Religion', 'Religion, fe, espiritualidad, oracion', '🙏', '#6366F1', 43),

-- TIKTOK/VIRAL (generic)
('Viral & FYP', 'FYP, viral, parati, foryou, trending', '🔥', '#EF4444', 44),
('Tips & Hacks', 'Tips, trucos, hacks, consejos rapidos', '💡', '#F59E0B', 45),
('Spanish Content', 'Espana, Mexico, contenido en espanol', '🇪🇸', '#EF4444', 46),

-- INVESTING GURUS
('Investing Gurus', 'Warren Buffett, Ray Dalio, Charlie Munger', '👴', '#22C55E', 47),

-- MISCELLANEOUS
('Uncategorized', 'Tags sin categoria asignada', '📁', '#94A3B8', 50)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- MAP TAGS TO GROUPS (using pattern matching)
-- ============================================================================

-- Value Investing
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Value Investing')
WHERE LOWER(name) IN ('value investing', 'value', 'fundamental analysis', 'intrinsic value', 'moat', 'margin of safety');

-- Investing Gurus
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Investing Gurus')
WHERE LOWER(name) IN ('warren buffett', 'ray dalio', 'charlie munger', 'peter lynch', 'benjamin graham', 'howard marks', 'li lu', 'mohnish pabrai');

-- Stock Market
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Stock Market')
WHERE LOWER(name) LIKE '%bolsa%'
   OR LOWER(name) LIKE '%stock%'
   OR LOWER(name) LIKE '%acciones%'
   OR LOWER(name) LIKE '%invertir%'
   OR LOWER(name) IN ('trading', 'stocks', 'mercado', 'sp500', 's&p500', 'nasdaq', 'dow jones', 'dividendos', 'dividends');

-- ETFs
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'ETFs & Index Funds')
WHERE LOWER(name) LIKE '%etf%'
   OR LOWER(name) LIKE '%index%fund%'
   OR LOWER(name) LIKE '%indexado%'
   OR LOWER(name) LIKE '%vanguard%'
   OR LOWER(name) IN ('passive investing', 'inversion pasiva');

-- Crypto
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Crypto')
WHERE LOWER(name) LIKE '%crypto%'
   OR LOWER(name) LIKE '%bitcoin%'
   OR LOWER(name) LIKE '%ethereum%'
   OR LOWER(name) LIKE '%blockchain%'
   OR LOWER(name) IN ('btc', 'eth', 'defi', 'nft', 'web3', 'criptomonedas', 'altcoin', 'altcoins');

-- Personal Finance
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Personal Finance')
WHERE LOWER(name) LIKE '%finanzas%personal%'
   OR LOWER(name) LIKE '%personal%finance%'
   OR LOWER(name) LIKE '%ahorro%'
   OR LOWER(name) LIKE '%presupuesto%'
   OR LOWER(name) LIKE '%deuda%'
   OR LOWER(name) IN ('money', 'dinero', 'saving', 'budget', 'debt free');

-- Financial Freedom
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Financial Freedom')
WHERE LOWER(name) LIKE '%libertad%financiera%'
   OR LOWER(name) LIKE '%financial%freedom%'
   OR LOWER(name) LIKE '%independencia%financiera%'
   OR LOWER(name) IN ('fire', 'retire early', 'jubilacion', 'retiro');

-- Real Estate
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Real Estate')
WHERE LOWER(name) LIKE '%inmobil%'
   OR LOWER(name) LIKE '%real%estate%'
   OR LOWER(name) LIKE '%propiedad%'
   OR LOWER(name) LIKE '%alquiler%'
   OR LOWER(name) IN ('reits', 'rental', 'housing', 'mortgage', 'hipoteca');

-- Entrepreneurship
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Entrepreneurship')
WHERE LOWER(name) LIKE '%emprend%'
   OR LOWER(name) LIKE '%startup%'
   OR LOWER(name) LIKE '%negocio%'
   OR LOWER(name) LIKE '%empresa%'
   OR LOWER(name) IN ('entrepreneur', 'founder', 'ceo', 'business', 'ecommerce', 'dropshipping', 'amazon fba');

-- Marketing
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Marketing')
WHERE LOWER(name) LIKE '%marketing%'
   OR LOWER(name) LIKE '%ventas%'
   OR LOWER(name) LIKE '%publicidad%'
   OR LOWER(name) IN ('sales', 'growth', 'ads', 'copywriting', 'branding', 'seo', 'social media marketing');

-- Career Advice
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Career Advice')
WHERE LOWER(name) LIKE '%career%'
   OR LOWER(name) LIKE '%trabajo%'
   OR LOWER(name) LIKE '%empleo%'
   OR LOWER(name) IN ('job', 'jobadvice', 'careertok', 'careeradvice', 'cv', 'resume', 'interview', 'entrevista', 'linkedin');

-- Mentorship
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Mentorship')
WHERE LOWER(name) LIKE '%mentor%'
   OR LOWER(name) LIKE '%coach%'
   OR LOWER(name) IN ('mentortok', 'mentortiktok', 'mentorship', 'coaching', 'advice');

-- Remote Work
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Remote Work')
WHERE LOWER(name) LIKE '%remote%'
   OR LOWER(name) LIKE '%freelance%'
   OR LOWER(name) LIKE '%nomad%'
   OR LOWER(name) IN ('wfh', 'work from home', 'trabajo remoto', 'autonomo');

-- AI & ChatGPT
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'AI & ChatGPT')
WHERE LOWER(name) LIKE '%inteligencia%artificial%'
   OR LOWER(name) LIKE '%chatgpt%'
   OR LOWER(name) LIKE '%openai%'
   OR LOWER(name) LIKE '%gpt%'
   OR LOWER(name) LIKE '%prompt%'
   OR LOWER(name) IN ('ai', 'ia', 'machine learning', 'ml', 'artificial intelligence', 'midjourney', 'dalle', 'claude');

-- Programming
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Programming')
WHERE LOWER(name) LIKE '%coding%'
   OR LOWER(name) LIKE '%programacion%'
   OR LOWER(name) LIKE '%programming%'
   OR LOWER(name) LIKE '%developer%'
   OR LOWER(name) LIKE '%software%'
   OR LOWER(name) IN ('dev', 'code', 'python', 'javascript', 'react', 'nodejs', 'webdev', 'frontend', 'backend', 'fullstack');

-- Tech News
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Tech News')
WHERE LOWER(name) IN ('tech', 'tecnologia', 'technology', 'gadgets', 'apple', 'iphone', 'samsung', 'nvidia', 'tesla');

-- Notion & Tools
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Notion & Tools')
WHERE LOWER(name) LIKE '%notion%'
   OR LOWER(name) LIKE '%productividad%'
   OR LOWER(name) IN ('obsidian', 'roam', 'todoist', 'asana', 'trello', 'productivity', 'tools');

-- Fitness
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Fitness')
WHERE LOWER(name) LIKE '%fitness%'
   OR LOWER(name) LIKE '%gym%'
   OR LOWER(name) LIKE '%workout%'
   OR LOWER(name) LIKE '%ejercicio%'
   OR LOWER(name) LIKE '%entrena%'
   OR LOWER(name) IN ('crossfit', 'cardio', 'weights', 'pesas', 'musculacion', 'hipertrofia', 'calisthenics');

-- Nutrition
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Nutrition')
WHERE LOWER(name) LIKE '%nutricion%'
   OR LOWER(name) LIKE '%nutrition%'
   OR LOWER(name) LIKE '%dieta%'
   OR LOWER(name) LIKE '%diet%'
   OR LOWER(name) LIKE '%alimenta%'
   OR LOWER(name) LIKE '%caloria%'
   OR LOWER(name) LIKE '%macro%'
   OR LOWER(name) IN ('protein', 'proteina', 'vitamins', 'supplements', 'healthy eating');

-- Keto & Fasting
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Keto & Fasting')
WHERE LOWER(name) LIKE '%keto%'
   OR LOWER(name) LIKE '%ayuno%'
   OR LOWER(name) LIKE '%fasting%'
   OR LOWER(name) LIKE '%low%carb%'
   OR LOWER(name) IN ('intermittent fasting', 'carnivore', 'paleo');

-- Mental Health
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Mental Health')
WHERE LOWER(name) LIKE '%mental%health%'
   OR LOWER(name) LIKE '%salud%mental%'
   OR LOWER(name) LIKE '%ansiedad%'
   OR LOWER(name) LIKE '%anxiety%'
   OR LOWER(name) LIKE '%estres%'
   OR LOWER(name) LIKE '%stress%'
   OR LOWER(name) LIKE '%terapia%'
   OR LOWER(name) IN ('therapy', 'depression', 'depresion', 'burnout');

-- Sleep
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Sleep')
WHERE LOWER(name) LIKE '%sueno%'
   OR LOWER(name) LIKE '%sleep%'
   OR LOWER(name) LIKE '%dormir%'
   OR LOWER(name) LIKE '%descanso%'
   OR LOWER(name) IN ('rest', 'recovery', 'recuperacion', 'insomnia');

-- Golf
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Golf')
WHERE LOWER(name) LIKE '%golf%'
   OR LOWER(name) LIKE '%swing%'
   OR LOWER(name) IN ('gol', 'golfer', 'instagolfers', 'pga', 'lpga');

-- Habits
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Habits')
WHERE LOWER(name) LIKE '%habit%'
   OR LOWER(name) LIKE '%rutina%'
   OR LOWER(name) LIKE '%routine%'
   OR LOWER(name) LIKE '%disciplina%'
   OR LOWER(name) IN ('discipline', 'consistency', 'constancia', 'morning routine');

-- Motivation
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Motivation')
WHERE LOWER(name) LIKE '%motivacion%'
   OR LOWER(name) LIKE '%motivation%'
   OR LOWER(name) LIKE '%inspiracion%'
   OR LOWER(name) LIKE '%inspiration%'
   OR LOWER(name) LIKE '%superacion%'
   OR LOWER(name) IN ('grind', 'hustle', 'success', 'exito', 'never give up');

-- Mindset
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Mindset')
WHERE LOWER(name) LIKE '%mindset%'
   OR LOWER(name) LIKE '%mentalidad%'
   OR LOWER(name) IN ('growth mindset', 'positive thinking', 'actitud', 'attitude');

-- Stoicism
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Stoicism')
WHERE LOWER(name) LIKE '%estoic%'
   OR LOWER(name) LIKE '%stoic%'
   OR LOWER(name) LIKE '%filosof%'
   OR LOWER(name) IN ('marcus aurelius', 'seneca', 'epictetus', 'philosophy', 'wisdom', 'sabiduria');

-- Psychology
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Psychology')
WHERE LOWER(name) LIKE '%psicolog%'
   OR LOWER(name) LIKE '%psycholog%'
   OR LOWER(name) LIKE '%comporta%'
   OR LOWER(name) IN ('behavior', 'neuroscience', 'brain', 'cognitive');

-- Books & Reading
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Books & Reading')
WHERE LOWER(name) LIKE '%libro%'
   OR LOWER(name) LIKE '%book%'
   OR LOWER(name) LIKE '%lectura%'
   OR LOWER(name) LIKE '%reading%'
   OR LOWER(name) IN ('booktok', 'bookclub', 'resumen', 'summary');

-- Public Speaking / TED
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Public Speaking')
WHERE LOWER(name) LIKE '%ted%talk%'
   OR LOWER(name) LIKE '%public%speaking%'
   OR LOWER(name) LIKE '%presenta%'
   OR LOWER(name) IN ('speech', 'communication', 'oratoria');

-- Dating
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Dating')
WHERE LOWER(name) LIKE '%dating%'
   OR LOWER(name) LIKE '%cita%'
   OR LOWER(name) LIKE '%relacion%'
   OR LOWER(name) LIKE '%amor%'
   OR LOWER(name) IN ('love', 'romance', 'pareja', 'couple', 'seduccion', 'attraction');

-- Communication
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Communication')
WHERE LOWER(name) LIKE '%comunicacion%'
   OR LOWER(name) LIKE '%conversation%'
   OR LOWER(name) IN ('listening', 'escucha', 'dialogue');

-- Social Skills
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Social Skills')
WHERE LOWER(name) LIKE '%social%skill%'
   OR LOWER(name) LIKE '%networking%'
   OR LOWER(name) LIKE '%carisma%'
   OR LOWER(name) IN ('charisma', 'influence', 'persuasion', 'likability');

-- Travel
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Travel')
WHERE LOWER(name) LIKE '%viaj%'
   OR LOWER(name) LIKE '%travel%'
   OR LOWER(name) LIKE '%turismo%'
   OR LOWER(name) IN ('tourism', 'destination', 'destino', 'vacation', 'vacaciones', 'adventure');

-- Music
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Music')
WHERE LOWER(name) LIKE '%music%'
   OR LOWER(name) LIKE '%musica%'
   OR LOWER(name) LIKE '%cancion%'
   OR LOWER(name) IN ('song', 'artist', 'concert', 'spotify', 'playlist');

-- Gaming
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Gaming')
WHERE LOWER(name) LIKE '%gaming%'
   OR LOWER(name) LIKE '%videojuego%'
   OR LOWER(name) LIKE '%gamer%'
   OR LOWER(name) IN ('esports', 'twitch', 'streamer', 'playstation', 'xbox', 'nintendo');

-- Movies & Series
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Movies & Series')
WHERE LOWER(name) LIKE '%pelicula%'
   OR LOWER(name) LIKE '%movie%'
   OR LOWER(name) LIKE '%serie%'
   OR LOWER(name) LIKE '%netflix%'
   OR LOWER(name) IN ('film', 'cinema', 'cine', 'tv', 'hbo', 'disney', 'streaming');

-- Food & Cooking
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Food & Cooking')
WHERE LOWER(name) LIKE '%cocina%'
   OR LOWER(name) LIKE '%receta%'
   OR LOWER(name) LIKE '%recipe%'
   OR LOWER(name) LIKE '%comida%'
   OR LOWER(name) LIKE '%food%'
   OR LOWER(name) IN ('cooking', 'chef', 'restaurant', 'restaurante', 'foodie');

-- Marbella
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Marbella & Costa del Sol')
WHERE LOWER(name) LIKE '%marbella%'
   OR LOWER(name) LIKE '%costa%del%sol%'
   OR LOWER(name) LIKE '%andaluc%';

-- Parenting
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Parenting')
WHERE LOWER(name) LIKE '%crianza%'
   OR LOWER(name) LIKE '%parenting%'
   OR LOWER(name) LIKE '%hijo%'
   OR LOWER(name) LIKE '%bebe%'
   OR LOWER(name) IN ('kids', 'children', 'baby', 'mom', 'dad', 'padre', 'madre', 'familia');

-- Home & Decor
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Home & Decor')
WHERE LOWER(name) LIKE '%decoracion%'
   OR LOWER(name) LIKE '%decor%'
   OR LOWER(name) LIKE '%hogar%'
   OR LOWER(name) LIKE '%home%'
   OR LOWER(name) IN ('interior design', 'furniture', 'muebles', 'organization', 'organizacion');

-- Minimalism
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Minimalism')
WHERE LOWER(name) LIKE '%minimalis%'
   OR LOWER(name) LIKE '%simplici%'
   OR LOWER(name) IN ('declutter', 'konmari', 'essentialism');

-- Meditation
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Meditation')
WHERE LOWER(name) LIKE '%meditacion%'
   OR LOWER(name) LIKE '%meditation%'
   OR LOWER(name) LIKE '%mindfulness%'
   OR LOWER(name) IN ('breathwork', 'breathing', 'calm', 'zen', 'calma');

-- Religion
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Religion')
WHERE LOWER(name) LIKE '%religion%'
   OR LOWER(name) LIKE '%espiritual%'
   OR LOWER(name) LIKE '%spiritual%'
   OR LOWER(name) LIKE '%oracion%'
   OR LOWER(name) LIKE '%prayer%'
   OR LOWER(name) IN ('fe', 'faith', 'dios', 'god', 'bible', 'biblia', 'church', 'iglesia', 'catholic', 'christian');

-- Viral & FYP (generic TikTok tags)
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Viral & FYP')
WHERE LOWER(name) IN ('fyp', 'foryou', 'foryoupage', 'viral', 'parati', 'fy', 'trending', 'trend', 'viralvideo', 'fypシ');

-- Tips & Hacks
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Tips & Hacks')
WHERE LOWER(name) IN ('tip', 'tips', 'hack', 'hacks', 'trucos', 'consejos', 'lifehack', 'lifehacks');

-- Spanish Content
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Spanish Content')
WHERE LOWER(name) IN ('españa', 'espana', 'spain', 'mexico', 'méxico', 'argentina', 'colombia', 'latam', 'español', 'spanish');

-- ============================================================================
-- UPDATE TAG GROUP VIDEO COUNTS (counting unique videos, not sum of tag counts)
-- ============================================================================

UPDATE tag_groups tg SET video_count = (
    SELECT COUNT(DISTINCT vt.video_id)
    FROM video_tags vt
    JOIN tags t ON t.id = vt.tag_id
    WHERE t.group_id = tg.id
);

UPDATE tag_groups SET tag_count = (
    SELECT COUNT(*) FROM tags WHERE group_id = tag_groups.id
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- SELECT tg.name, tg.tag_count, tg.video_count FROM tag_groups tg ORDER BY tg.video_count DESC;
-- SELECT t.name, t.video_count, tg.name as group_name FROM tags t LEFT JOIN tag_groups tg ON t.group_id = tg.id ORDER BY t.video_count DESC LIMIT 50;
