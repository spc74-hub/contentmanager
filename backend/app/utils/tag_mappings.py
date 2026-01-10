"""
Tag to Area mappings for video classification.

This module contains a comprehensive dictionary mapping common tags/hashtags
to their corresponding area IDs in the taxonomy system.

Areas:
1. Health & Fitness (Salud y Fitness)
2. Business & Career (Negocio y Carrera)
3. Money & Finances (Dinero y Finanzas)
4. Relationships (Relaciones)
5. Fun & Recreation (Ocio y Entretenimiento)
6. Physical Environment (Entorno Fisico)
7. Personal Growth (Crecimiento Personal)
8. Family & Friends (Familia y Amigos)
9. Charity & Legacy (Caridad y Legado)
10. Spiritual (Espiritual)
"""
from typing import Dict, List, Optional

# Comprehensive tag to area mappings (~130+ tags)
TAG_AREA_MAPPINGS: Dict[str, int] = {
    # ═══════════════════════════════════════════════════════════════════════
    # 1. HEALTH & FITNESS (Salud y Fitness)
    # ═══════════════════════════════════════════════════════════════════════
    # Exercise & Training
    'fitness': 1,
    'gym': 1,
    'workout': 1,
    'ejercicio': 1,
    'entrenamiento': 1,
    'training': 1,
    'crossfit': 1,
    'cardio': 1,
    'pesas': 1,
    'musculacion': 1,
    'hipertrofia': 1,
    'bodybuilding': 1,
    'calistenia': 1,
    'running': 1,
    'correr': 1,

    # Nutrition & Diet
    'nutricion': 1,
    'dieta': 1,
    'alimentacion': 1,
    'calorias': 1,
    'macros': 1,
    'proteina': 1,
    'protein': 1,
    'keto': 1,
    'ayuno': 1,
    'intermitente': 1,
    'ayunointermitente': 1,
    'lowcarb': 1,
    'vegano': 1,
    'vegetariano': 1,

    # Health & Wellness
    'salud': 1,
    'bienestar': 1,
    'wellness': 1,
    'health': 1,
    'healthy': 1,
    'saludable': 1,

    # Mind-Body
    'yoga': 1,
    'meditacion': 1,
    'mindfulness': 1,
    'estres': 1,
    'ansiedad': 1,
    'relajacion': 1,

    # Sleep & Recovery
    'sueno': 1,
    'dormir': 1,
    'descanso': 1,
    'recuperacion': 1,
    'sleep': 1,

    # Food & Recipes
    'recetas': 1,
    'cocina': 1,
    'comida': 1,
    'recetassaludables': 1,
    'mealprep': 1,

    # ═══════════════════════════════════════════════════════════════════════
    # 2. BUSINESS & CAREER (Negocio y Carrera)
    # ═══════════════════════════════════════════════════════════════════════
    # Entrepreneurship
    'emprendimiento': 2,
    'emprender': 2,
    'startup': 2,
    'negocio': 2,
    'negocios': 2,
    'business': 2,
    'empresa': 2,
    'empresario': 2,
    'emprendedor': 2,
    'pyme': 2,
    'entrepreneur': 2,

    # Marketing & Sales
    'marketing': 2,
    'ventas': 2,
    'sales': 2,
    'ecommerce': 2,
    'amazon': 2,
    'dropshipping': 2,
    'ads': 2,
    'publicidad': 2,
    'branding': 2,
    'socialmedia': 2,
    'redessociales': 2,
    'contenido': 2,
    'copywriting': 2,

    # Career & Employment
    'freelance': 2,
    'autonomo': 2,
    'trabajo': 2,
    'carrera': 2,
    'profesional': 2,
    'linkedin': 2,
    'cv': 2,
    'curriculum': 2,
    'entrevista': 2,
    'empleo': 2,
    'remotework': 2,
    'trabajoremoto': 2,

    # Technology & AI
    'ia': 2,
    'chatgpt': 2,
    'inteligenciaartificial': 2,
    'ai': 2,
    'openai': 2,
    'machinelearning': 2,
    'automation': 2,
    'automatizacion': 2,

    # Programming & Tech
    'programacion': 2,
    'codigo': 2,
    'code': 2,
    'developer': 2,
    'tech': 2,
    'software': 2,
    'python': 2,
    'javascript': 2,
    'webdev': 2,
    'nocode': 2,

    # Productivity & Management
    'notion': 2,
    'productividad': 2,
    'productivity': 2,
    'organizacion': 2,
    'gestion': 2,
    'liderazgo': 2,
    'management': 2,
    'equipo': 2,
    'leadership': 2,

    # ═══════════════════════════════════════════════════════════════════════
    # 3. MONEY & FINANCES (Dinero y Finanzas)
    # ═══════════════════════════════════════════════════════════════════════
    # Investing
    'inversiones': 3,
    'inversion': 3,
    'invertir': 3,
    'invertirenbolsa': 3,
    'investing': 3,
    'invest': 3,

    # Stock Market
    'acciones': 3,
    'bolsa': 3,
    'trading': 3,
    'stocks': 3,
    'mercado': 3,
    'stockmarket': 3,
    'daytrading': 3,
    'trader': 3,

    # Personal Finance
    'finanzas': 3,
    'dinero': 3,
    'money': 3,
    'financiero': 3,
    'economia': 3,
    'personalfinance': 3,
    'finanzaspersonales': 3,

    # Saving & Budgeting
    'ahorro': 3,
    'ahorrar': 3,
    'presupuesto': 3,
    'deudas': 3,
    'budget': 3,
    'saving': 3,

    # Crypto
    'crypto': 3,
    'bitcoin': 3,
    'btc': 3,
    'ethereum': 3,
    'eth': 3,
    'criptomonedas': 3,
    'blockchain': 3,
    'web3': 3,
    'nft': 3,

    # ETFs & Index Funds
    'etf': 3,
    'etfs': 3,
    'fondos': 3,
    'fondosindexados': 3,
    'indexfunds': 3,
    'vanguard': 3,

    # Market Indices
    'sp500': 3,
    'nasdaq': 3,
    'nasdaq100': 3,
    'dowjones': 3,

    # Investment Concepts
    'dividendos': 3,
    'dividends': 3,
    'interescompuesto': 3,
    'compoundinterest': 3,
    'rentabilidad': 3,
    'pasiveincome': 3,
    'ingresos': 3,
    'ingresospasivos': 3,

    # Retirement
    'jubilacion': 3,
    'retiro': 3,
    'pension': 3,
    'rothira': 3,
    'retirement': 3,
    '401k': 3,

    # Famous Investors
    'warrenbuffett': 3,
    'charliemunger': 3,
    'valueinvesting': 3,
    'berkshire': 3,

    # Real Estate
    'inmobiliario': 3,
    'realestate': 3,
    'propiedades': 3,
    'inmuebles': 3,
    'alquileres': 3,

    # ═══════════════════════════════════════════════════════════════════════
    # 4. RELATIONSHIPS (Relaciones)
    # ═══════════════════════════════════════════════════════════════════════
    'relaciones': 4,
    'pareja': 4,
    'amor': 4,
    'love': 4,
    'dating': 4,
    'citas': 4,
    'comunicacion': 4,
    'conflictos': 4,
    'matrimonio': 4,
    'seduccion': 4,
    'atraccion': 4,
    'relationship': 4,
    'couple': 4,

    # ═══════════════════════════════════════════════════════════════════════
    # 5. FUN & RECREATION (Ocio y Entretenimiento)
    # ═══════════════════════════════════════════════════════════════════════
    # Entertainment
    'entretenimiento': 5,
    'diversion': 5,
    'ocio': 5,
    'humor': 5,
    'comedia': 5,
    'funny': 5,
    'memes': 5,

    # Music & Arts
    'musica': 5,
    'music': 5,
    'arte': 5,
    'art': 5,

    # Travel
    'viajes': 5,
    'travel': 5,
    'turismo': 5,
    'viajar': 5,
    'aventura': 5,

    # Gaming
    'gaming': 5,
    'videojuegos': 5,
    'juegos': 5,
    'gamer': 5,
    'esports': 5,

    # Movies & Series
    'peliculas': 5,
    'series': 5,
    'netflix': 5,
    'cine': 5,
    'movies': 5,

    # Sports
    'deportes': 5,
    'futbol': 5,
    'football': 5,
    'basketball': 5,
    'soccer': 5,

    # Hobbies
    'hobbies': 5,
    'manualidades': 5,
    'diy': 5,
    'crafts': 5,

    # ═══════════════════════════════════════════════════════════════════════
    # 6. PHYSICAL ENVIRONMENT (Entorno Fisico)
    # ═══════════════════════════════════════════════════════════════════════
    'casa': 6,
    'hogar': 6,
    'home': 6,
    'decoracion': 6,
    'decor': 6,
    'interiordesign': 6,
    'minimalismo': 6,
    'minimalist': 6,
    'limpieza': 6,
    'cleaning': 6,
    'orden': 6,
    'konmari': 6,
    'mudanza': 6,
    'moving': 6,
    'renta': 6,
    'alquiler': 6,

    # ═══════════════════════════════════════════════════════════════════════
    # 7. PERSONAL GROWTH (Crecimiento Personal)
    # ═══════════════════════════════════════════════════════════════════════
    # Self Development
    'desarrollopersonal': 7,
    'crecimientopersonal': 7,
    'superacion': 7,
    'selfimprovement': 7,
    'personalgrowth': 7,
    'selfdevelopment': 7,

    # Habits & Discipline
    'habitos': 7,
    'habits': 7,
    'disciplina': 7,
    'discipline': 7,
    'constancia': 7,
    'rutina': 7,
    'routine': 7,

    # Motivation & Mindset
    'motivacion': 7,
    'motivation': 7,
    'inspiracion': 7,
    'mentalidad': 7,
    'mindset': 7,
    'actitud': 7,

    # Learning & Education
    'libros': 7,
    'books': 7,
    'lectura': 7,
    'reading': 7,
    'aprendizaje': 7,
    'learning': 7,
    'educacion': 7,
    'education': 7,
    'conocimiento': 7,

    # Philosophy & Psychology
    'estoicismo': 7,
    'stoicism': 7,
    'filosofia': 7,
    'philosophy': 7,
    'psicologia': 7,
    'psychology': 7,

    # Goals & Purpose
    'metas': 7,
    'goals': 7,
    'objetivos': 7,
    'proposito': 7,
    'purpose': 7,

    # Confidence & Self-esteem
    'autoestima': 7,
    'confianza': 7,
    'confidence': 7,
    'seguridad': 7,

    # TikTok Learning Tags
    'tiktoklearningcampaign': 7,
    'aprendeentiktok': 7,
    'tiktoklearning': 7,

    # ═══════════════════════════════════════════════════════════════════════
    # 8. FAMILY & FRIENDS (Familia y Amigos)
    # ═══════════════════════════════════════════════════════════════════════
    'familia': 8,
    'family': 8,
    'hijos': 8,
    'kids': 8,
    'padres': 8,
    'parents': 8,
    'maternidad': 8,
    'motherhood': 8,
    'paternidad': 8,
    'fatherhood': 8,
    'crianza': 8,
    'parenting': 8,
    'bebes': 8,
    'babies': 8,
    'ninos': 8,
    'children': 8,
    'adolescentes': 8,
    'teens': 8,
    'amigos': 8,
    'friends': 8,
    'amistad': 8,
    'friendship': 8,
    'social': 8,

    # ═══════════════════════════════════════════════════════════════════════
    # 9. CHARITY & LEGACY (Caridad y Legado)
    # ═══════════════════════════════════════════════════════════════════════
    'voluntariado': 9,
    'volunteering': 9,
    'caridad': 9,
    'charity': 9,
    'donacion': 9,
    'donation': 9,
    'ayudar': 9,
    'helping': 9,
    'impacto': 9,
    'impact': 9,
    'legado': 9,
    'legacy': 9,
    'comunidad': 9,
    'community': 9,
    'nonprofit': 9,
    'ong': 9,

    # ═══════════════════════════════════════════════════════════════════════
    # 10. SPIRITUAL (Espiritual)
    # ═══════════════════════════════════════════════════════════════════════
    'espiritual': 10,
    'spiritual': 10,
    'espiritualidad': 10,
    'spirituality': 10,
    'fe': 10,
    'faith': 10,
    'religion': 10,
    'oracion': 10,
    'prayer': 10,
    'biblia': 10,
    'bible': 10,
    'dios': 10,
    'god': 10,
    'iglesia': 10,
    'church': 10,
    'cristiano': 10,
    'christian': 10,
    'sentido': 10,
    'trascendencia': 10,
}


def get_tag_area_mapping(tag: str) -> Optional[int]:
    """
    Get the area ID for a given tag.

    Args:
        tag: The tag to look up (case-insensitive)

    Returns:
        The area ID if found, None otherwise
    """
    return TAG_AREA_MAPPINGS.get(tag.lower().strip())


def get_all_tags_for_area(area_id: int) -> List[str]:
    """
    Get all tags that map to a specific area.

    Args:
        area_id: The area ID to look up

    Returns:
        List of tags that map to this area
    """
    return [tag for tag, aid in TAG_AREA_MAPPINGS.items() if aid == area_id]


def get_mappings_count_by_area() -> Dict[int, int]:
    """
    Get count of mapped tags per area.

    Returns:
        Dictionary with area_id -> count of tags
    """
    counts: dict[int, int] = {}
    for area_id in TAG_AREA_MAPPINGS.values():
        counts[area_id] = counts.get(area_id, 0) + 1
    return counts
