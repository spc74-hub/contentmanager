-- Extended Tag Groups Seed v2
-- Amplía la cobertura de tags con nuevos grupos y patrones ILIKE
-- Run this AFTER seed_tag_groups.sql (or instead of it)

-- ============================================================================
-- NEW TAG GROUPS (para categorías que faltaban)
-- ============================================================================

INSERT INTO tag_groups (name, description, icon, color, sort_order) VALUES
-- Tech específicos
('Tech Content', 'TechTok, tech trends, tech tips', '📲', '#3B82F6', 48),
('AI Agents & Automation', 'AI agents, automation, workflows, voice AI', '🤖', '#8B5CF6', 49),
('Learning & Education', 'AprendeEnTikTok, learn, education, study', '🎓', '#22C55E', 51),
('Work & Job Tips', 'Job tips, work advice, career hacks', '👔', '#0EA5E9', 52),
('Strategy & Thinking', 'Strategy, thinking, planning, analysis', '🧠', '#6366F1', 53),
('News & Current Events', 'News, current events, updates', '📰', '#64748B', 54),
('Future & Trends', 'Future, trends, predictions, 2024/2025', '🔮', '#A855F7', 55),
('Money Talk', 'Ingresos pasivos, passive income, money tips', '💵', '#10B981', 56)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- EXPANDED PATTERN MATCHING (ILIKE para capturar más variantes)
-- ============================================================================

-- Tech Content (techtok, techtiktok, techtrends, etc.)
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Tech Content')
WHERE LOWER(name) LIKE '%techtok%'
   OR LOWER(name) LIKE '%techtiktok%'
   OR LOWER(name) LIKE '%techtrend%'
   OR LOWER(name) LIKE '%techtip%'
   OR LOWER(name) LIKE '%techlife%'
   OR LOWER(name) LIKE '%technews%'
   OR LOWER(name) IN ('tech', 'technology', 'tecnologia', 'techie');

-- AI Agents & Automation
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'AI Agents & Automation')
WHERE LOWER(name) LIKE '%aiagent%'
   OR LOWER(name) LIKE '%ai agent%'
   OR LOWER(name) LIKE '%voiceai%'
   OR LOWER(name) LIKE '%voice ai%'
   OR LOWER(name) LIKE '%aiupdate%'
   OR LOWER(name) LIKE '%aitools%'
   OR LOWER(name) LIKE '%automation%'
   OR LOWER(name) LIKE '%workflow%'
   OR LOWER(name) LIKE '%automate%'
   OR LOWER(name) IN ('agent', 'agents', 'n8n', 'zapier', 'make', 'langchain');

-- Learning & Education
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Learning & Education')
WHERE LOWER(name) LIKE '%aprende%'
   OR LOWER(name) LIKE '%learn%'
   OR LOWER(name) LIKE '%education%'
   OR LOWER(name) LIKE '%educacion%'
   OR LOWER(name) LIKE '%study%'
   OR LOWER(name) LIKE '%estudi%'
   OR LOWER(name) LIKE '%tiktoklearning%'
   OR LOWER(name) IN ('learntok', 'edutok', 'studytok', 'knowledge', 'conocimiento');

-- Work & Job Tips
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Work & Job Tips')
WHERE LOWER(name) LIKE '%jobtip%'
   OR LOWER(name) LIKE '%job tip%'
   OR LOWER(name) LIKE '%worktip%'
   OR LOWER(name) LIKE '%work tip%'
   OR LOWER(name) LIKE '%careertip%'
   OR LOWER(name) IN ('jobtips', 'worktips', 'jobsearch', 'hiring', 'contratacion');

-- Strategy & Thinking
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Strategy & Thinking')
WHERE LOWER(name) LIKE '%strateg%'
   OR LOWER(name) LIKE '%thinking%'
   OR LOWER(name) LIKE '%pensar%'
   OR LOWER(name) LIKE '%analysis%'
   OR LOWER(name) LIKE '%analisis%'
   OR LOWER(name) IN ('strategy', 'strategic', 'planning', 'planificacion', 'decision', 'decisiones');

-- News & Current Events
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'News & Current Events')
WHERE LOWER(name) LIKE '%news%'
   OR LOWER(name) LIKE '%noticias%'
   OR LOWER(name) LIKE '%update%'
   OR LOWER(name) LIKE '%actualidad%'
   OR LOWER(name) IN ('breaking', 'current events', 'eventos');

-- Future & Trends (future, 2024, 2025, etc.)
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Future & Trends')
WHERE LOWER(name) LIKE '%future%'
   OR LOWER(name) LIKE '%futuro%'
   OR LOWER(name) LIKE '%2024%'
   OR LOWER(name) LIKE '%2025%'
   OR LOWER(name) LIKE '%prediction%'
   OR LOWER(name) LIKE '%prediccion%'
   OR LOWER(name) IN ('trends', 'tendencias', 'upcoming', 'next');

-- Money Talk (ingresos pasivos, passive income, etc.)
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Money Talk')
WHERE LOWER(name) LIKE '%ingreso%pasivo%'
   OR LOWER(name) LIKE '%passive%income%'
   OR LOWER(name) LIKE '%side%hustle%'
   OR LOWER(name) LIKE '%make%money%'
   OR LOWER(name) LIKE '%ganar%dinero%'
   OR LOWER(name) LIKE '%moneytok%'
   OR LOWER(name) LIKE '%moneytip%'
   OR LOWER(name) IN ('sidehustle', 'income', 'ingresos', 'wealth', 'riqueza');

-- ============================================================================
-- EXPAND EXISTING GROUPS WITH MORE PATTERNS
-- ============================================================================

-- Expand Value Investing
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Value Investing')
WHERE LOWER(name) LIKE '%value%school%'
   OR LOWER(name) LIKE '%berkshire%'
   OR LOWER(name) LIKE '%fondos%inversion%'
   OR LOWER(name) LIKE '%fondo%inversion%'
   AND group_id IS NULL;

-- Expand Programming with more terms
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Programming')
WHERE (LOWER(name) LIKE '%coder%'
   OR LOWER(name) LIKE '%engineer%'
   OR LOWER(name) LIKE '%engineering%'
   OR LOWER(name) LIKE '%cs%'
   OR LOWER(name) LIKE '%compsci%'
   OR LOWER(name) IN ('dev', 'devlife', 'coderlife', 'softwaredev', 'webdeveloper'))
   AND group_id IS NULL;

-- Expand AI & ChatGPT
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'AI & ChatGPT')
WHERE (LOWER(name) LIKE '%artificial%intelligence%'
   OR LOWER(name) LIKE '%llm%'
   OR LOWER(name) LIKE '%generative%ai%'
   OR LOWER(name) LIKE '%gpt4%'
   OR LOWER(name) LIKE '%gpt-4%'
   OR LOWER(name) LIKE '%gemini%'
   OR LOWER(name) LIKE '%copilot%')
   AND group_id IS NULL;

-- Expand Fitness with more variations
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Fitness')
WHERE (LOWER(name) LIKE '%fitlife%'
   OR LOWER(name) LIKE '%fitnessmotivation%'
   OR LOWER(name) LIKE '%fitfam%'
   OR LOWER(name) LIKE '%gymlife%'
   OR LOWER(name) LIKE '%gymmotivation%'
   OR LOWER(name) LIKE '%legday%'
   OR LOWER(name) LIKE '%gains%'
   OR LOWER(name) LIKE '%lifting%')
   AND group_id IS NULL;

-- Expand Entrepreneurship
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Entrepreneurship')
WHERE (LOWER(name) LIKE '%businesstok%'
   OR LOWER(name) LIKE '%smallbusiness%'
   OR LOWER(name) LIKE '%pequenonegocio%'
   OR LOWER(name) LIKE '%pyme%'
   OR LOWER(name) LIKE '%sme%')
   AND group_id IS NULL;

-- Expand Personal Finance
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Personal Finance')
WHERE (LOWER(name) LIKE '%moneysaving%'
   OR LOWER(name) LIKE '%budgeting%'
   OR LOWER(name) LIKE '%financetok%'
   OR LOWER(name) LIKE '%debtfree%'
   OR LOWER(name) LIKE '%savemoney%')
   AND group_id IS NULL;

-- Expand Motivation
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Motivation')
WHERE (LOWER(name) LIKE '%motivationtok%'
   OR LOWER(name) LIKE '%motivational%'
   OR LOWER(name) LIKE '%successmindset%'
   OR LOWER(name) LIKE '%keepgoing%'
   OR LOWER(name) LIKE '%dontgiveup%'
   OR LOWER(name) LIKE '%youcandoit%')
   AND group_id IS NULL;

-- Expand Books & Reading
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Books & Reading')
WHERE (LOWER(name) LIKE '%mustread%'
   OR LOWER(name) LIKE '%bookworm%'
   OR LOWER(name) LIKE '%readmore%'
   OR LOWER(name) LIKE '%bookreview%'
   OR LOWER(name) LIKE '%booksummary%')
   AND group_id IS NULL;

-- Expand Stock Market
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Stock Market')
WHERE (LOWER(name) LIKE '%stockmarket%'
   OR LOWER(name) LIKE '%wallstreet%'
   OR LOWER(name) LIKE '%daytrading%'
   OR LOWER(name) LIKE '%swingtrading%'
   OR LOWER(name) LIKE '%stocktips%'
   OR LOWER(name) LIKE '%investingtips%')
   AND group_id IS NULL;

-- Expand Crypto
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Crypto')
WHERE (LOWER(name) LIKE '%cryptotok%'
   OR LOWER(name) LIKE '%cryptonews%'
   OR LOWER(name) LIKE '%altseason%'
   OR LOWER(name) LIKE '%hodl%'
   OR LOWER(name) LIKE '%solana%'
   OR LOWER(name) LIKE '%cardano%')
   AND group_id IS NULL;

-- ============================================================================
-- GENERIC PATTERNS FOR COMMON TikTok FORMATS
-- ============================================================================

-- Catch all "*tok" patterns that are career/business related
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Career Advice')
WHERE (LOWER(name) LIKE '%careertok%'
   OR LOWER(name) LIKE '%corporatetok%'
   OR LOWER(name) LIKE '%worktok%'
   OR LOWER(name) LIKE '%officetok%'
   OR LOWER(name) LIKE '%9to5%')
   AND group_id IS NULL;

-- Catch all "*tok" patterns that are finance related
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE name = 'Personal Finance')
WHERE (LOWER(name) LIKE '%fintok%'
   OR LOWER(name) LIKE '%finanztok%')
   AND group_id IS NULL;

-- ============================================================================
-- RECALCULATE COUNTS
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

-- Check coverage improvement:
-- SELECT
--     COUNT(*) FILTER (WHERE group_id IS NOT NULL) as tags_with_group,
--     COUNT(*) as total_tags,
--     ROUND(100.0 * COUNT(*) FILTER (WHERE group_id IS NOT NULL) / COUNT(*), 1) as coverage_pct
-- FROM tags;

-- Check new groups:
-- SELECT name, tag_count, video_count FROM tag_groups WHERE sort_order >= 48 ORDER BY video_count DESC;

-- Top unassigned tags remaining:
-- SELECT name, video_count FROM tags WHERE group_id IS NULL ORDER BY video_count DESC LIMIT 30;
