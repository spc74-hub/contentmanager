from fastapi import APIRouter, HTTPException
from supabase import create_client
from app.config import get_settings
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
settings = get_settings()

supabase = create_client(settings.supabase_url, settings.supabase_key)


class CategoryCreate(BaseModel):
    name: str
    icon: str
    color: str


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


@router.get("/")
async def get_categories():
    """Get all categories."""
    response = supabase.table("categories").select("*").order("id").execute()
    return response.data


@router.get("/{category_id}")
async def get_category(category_id: int):
    """Get a single category by ID."""
    response = supabase.table("categories").select("*").eq("id", category_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return response.data


@router.post("/")
async def create_category(category: CategoryCreate):
    """Create a new category."""
    response = supabase.table("categories").insert(category.model_dump()).execute()
    return response.data[0]


@router.put("/{category_id}")
async def update_category(category_id: int, category: CategoryUpdate):
    """Update a category."""
    update_data = {k: v for k, v in category.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("categories").update(update_data).eq("id", category_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return response.data[0]


@router.delete("/{category_id}")
async def delete_category(category_id: int):
    """Delete a category."""
    response = supabase.table("categories").delete().eq("id", category_id).execute()
    return {"deleted": True}
