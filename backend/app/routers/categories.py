from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.db.models import Category

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    icon: str
    color: str


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


def cat_to_dict(c: Category) -> dict:
    return {"id": c.id, "name": c.name, "icon": c.icon, "color": c.color, "created_at": c.created_at.isoformat() if c.created_at else None}


@router.get("/")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.id))
    return [cat_to_dict(c) for c in result.scalars().all()]


@router.get("/{category_id}")
async def get_category(category_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat_to_dict(cat)


@router.post("/")
async def create_category(category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    cat = Category(**category.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat_to_dict(cat)


@router.put("/{category_id}")
async def update_category(category_id: int, category: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    update_data = {k: v for k, v in category.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in update_data.items():
        setattr(cat, k, v)
    await db.commit()
    await db.refresh(cat)
    return cat_to_dict(cat)


@router.delete("/{category_id}")
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Category).where(Category.id == category_id))
    await db.commit()
    return {"deleted": True}
