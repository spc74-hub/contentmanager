"""
Seed script: creates tables, pgvector extension, and admin user.
Run with: python seed.py
"""
import asyncio
import os
import sys

# Add parent to path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db.session import engine, async_session_maker
from app.db.models import Base, User, Category, Area, Topic
from app.auth import get_password_hash


async def seed():
    # Create extension and tables
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    async with async_session_maker() as db:
        # Seed admin user
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "sergio.porcar@gmail.com"))
        if not result.scalar_one_or_none():
            admin = User(
                email="sergio.porcar@gmail.com",
                hashed_password=get_password_hash("changeme"),
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print("Admin user created: sergio.porcar@gmail.com / changeme")
        else:
            print("Admin user already exists.")

        # Seed default category (needed for foreign key)
        result = await db.execute(select(Category).where(Category.id == 1))
        if not result.scalar_one_or_none():
            db.add(Category(id=1, name="Sin categorizar", icon="HelpCircle", color="#6B7280"))
            await db.commit()
            print("Default category created.")

        # Seed areas (10 life areas)
        result = await db.execute(select(Area))
        if not result.scalars().first():
            areas_data = [
                (1, "Health & Fitness", "Salud y Fitness", "🏋️", "#22C55E", 1),
                (2, "Business & Career", "Negocio y Carrera", "💼", "#3B82F6", 2),
                (3, "Money & Finances", "Dinero y Finanzas", "💰", "#F59E0B", 3),
                (4, "Relationships", "Relaciones", "❤️", "#EC4899", 4),
                (5, "Fun & Recreation", "Ocio y Entretenimiento", "🎉", "#8B5CF6", 5),
                (6, "Physical Environment", "Entorno Fisico", "🏠", "#06B6D4", 6),
                (7, "Personal Growth", "Crecimiento Personal", "🧠", "#6366F1", 7),
                (8, "Family & Friends", "Familia y Amigos", "👨‍👩‍👧‍👦", "#F97316", 8),
                (9, "Charity & Legacy", "Caridad y Legado", "🎁", "#14B8A6", 9),
                (10, "Spiritual", "Espiritual", "🧘", "#A855F7", 10),
            ]
            for id_, name, name_es, icon, color, sort_order in areas_data:
                db.add(Area(id=id_, name=name, name_es=name_es, icon=icon, color=color, sort_order=sort_order))
            await db.commit()
            # Reset sequence
            await db.execute(text("SELECT setval('areas_id_seq', (SELECT COALESCE(MAX(id),0) FROM areas))"))
            await db.commit()
            print("Areas seeded (10 life areas).")

        # Seed topics
        result = await db.execute(select(Topic))
        if not result.scalars().first():
            topics_data = [
                (1, "Nutrition", "Nutricion"), (1, "Fitness & Exercise", "Fitness y Ejercicio"),
                (1, "Mental Wellness", "Bienestar Mental"), (1, "Food & Cooking", "Cocina y Recetas"),
                (1, "Sleep & Recovery", "Sueno y Recuperacion"),
                (2, "AI & ChatGPT", "IA y ChatGPT"), (2, "Productivity Tools", "Herramientas de Productividad"),
                (2, "Entrepreneurship", "Emprendimiento"), (2, "Marketing & Sales", "Marketing y Ventas"),
                (2, "Programming & Tech", "Programacion y Tecnologia"),
                (3, "Investing", "Inversion"), (3, "ETFs & Index Funds", "ETFs y Fondos Indexados"),
                (3, "Personal Finance", "Finanzas Personales"), (3, "Real Estate", "Inmobiliario"),
                (3, "Crypto", "Criptomonedas"),
                (4, "Dating & Romance", "Citas y Romance"), (4, "Communication", "Comunicacion"),
                (5, "Music", "Musica"), (5, "Travel", "Viajes"), (5, "Gaming", "Videojuegos"),
                (6, "Home & Decor", "Casa y Decoracion"), (6, "Organization", "Organizacion"),
                (7, "Learning & Education", "Aprendizaje y Educacion"), (7, "Habits & Routines", "Habitos y Rutinas"),
                (7, "Philosophy & Stoicism", "Filosofia y Estoicismo"), (7, "Psychology", "Psicologia"),
                (8, "Parenting", "Crianza"), (8, "Family Activities", "Actividades Familiares"),
                (9, "Giving & Philanthropy", "Donaciones y Filantropia"),
                (10, "Meditation", "Meditacion"), (10, "Religion & Faith", "Religion y Fe"),
            ]
            for area_id, name, name_es in topics_data:
                db.add(Topic(area_id=area_id, name=name, name_es=name_es))
            await db.commit()
            print(f"Topics seeded ({len(topics_data)} topics).")

    await engine.dispose()
    print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
