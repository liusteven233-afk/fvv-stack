"""上架管理API"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from models.database import get_db
from models.listing import Listing
from models.ml_account import MLProduct
from services.ml_service import MLService

router = APIRouter()


@router.get("")
def list_listings(
    status: Optional[str] = None,
    account_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """获取所有listing"""
    query = db.query(Listing)
    if status:
        query = query.filter(Listing.status == status)
    if account_id:
        query = query.filter(Listing.account_id == account_id)
    query = query.order_by(Listing.updated_at.desc())

    total = query.count()
    listings = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "listings": [
            {
                "id": l.id,
                "account_id": l.account_id,
                "ml_item_id": l.ml_item_id,
                "title": l.title,
                "price_local": l.price_local,
                "currency": l.currency,
                "stock": l.stock,
                "status": l.status,
                "ml_status": l.ml_status,
                "cost_usd": l.cost_usd,
                "net_received_usd": l.net_received_usd,
                "estimated_profit_cny": l.estimated_profit_cny,
                "listing_url": l.listing_url,
                "optimization_version": l.optimization_version,
                "created_at": l.created_at.isoformat(),
                "listed_at": l.listed_at.isoformat() if l.listed_at else None,
            }
            for l in listings
        ],
    }


@router.post("/create")
async def create_listing(data: dict, db: Session = Depends(get_db)):
    """创建新的listing（先存草稿，再上架到ML）"""
    account_id = data.get("account_id")
    title = data.get("title")
    price_local = data.get("price_local")
    if not account_id or not title or price_local is None:
        raise HTTPException(400, "account_id, title, price_local 为必填字段")
    try:
        listing = Listing(
            account_id=account_id,
            product_id=data.get("product_id"),
            title=title,
            description=data.get("description", ""),
            category_id=data.get("category_id"),
            price_local=price_local,
            currency=data.get("currency", "MXN"),
            stock=data.get("stock", 1),
            images=data.get("images", ""),
            shipping_type=data.get("shipping_type", "cross_border"),
            shipping_free=data.get("shipping_free", True),
            sourcing_price_cny=data.get("sourcing_price_cny"),
            freight_fee_cny=data.get("freight_fee_cny"),
            cost_usd=data.get("cost_usd"),
            net_received_usd=data.get("net_received_usd"),
            estimated_profit_cny=data.get("estimated_profit_cny"),
            profit_mode=data.get("profit_mode"),
            status="draft",
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return {"id": listing.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"创建listing失败: {str(e)}")


@router.post("/{listing_id}/publish")
async def publish_listing(listing_id: int, db: Session = Depends(get_db)):
    """发布listing到ML"""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing不存在")

    # Build ML API payload
    images_list = []
    if listing.images:
        images_list = [
            {"source": img.strip()}
            for img in listing.images.split("\n")
            if img.strip()
        ]

    ml_data = {
        "title": listing.title,
        "category_id": listing.category_id,
        "price": listing.price_local,
        "currency_id": listing.currency,
        "available_quantity": listing.stock,
        "condition": listing.condition,
        "listing_type_id": "gold_special",
        "description": {"plain_text": listing.description},
        "shipping": {
            "mode": "me2",
            "free_shipping": listing.shipping_free,
            "local_pick_up": False,
        },
        "pictures": images_list,
    }

    try:
        result = await MLService.create_listing(listing.account_id, ml_data)
        listing.ml_item_id = result.get("id")
        listing.ml_status = result.get("status")
        listing.status = "pending"
        listing.listing_url = result.get("permalink", "")
        listing.listed_at = datetime.utcnow()
        db.commit()
        return {"ok": True, "ml_item_id": listing.ml_item_id, "url": listing.listing_url}
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"上架失败: {str(e)}")


@router.put("/{listing_id}")
def update_listing(listing_id: int, data: dict, db: Session = Depends(get_db)):
    """更新listing草稿"""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing不存在")

    for key, value in data.items():
        if hasattr(listing, key):
            setattr(listing, key, value)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"更新失败: {str(e)}")
    return {"ok": True}


@router.post("/{listing_id}/optimize-description")
def optimize_description(listing_id: int, description: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """更新优化后的描述"""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing不存在")

    listing.description = description
    listing.optimization_version = (listing.optimization_version or 0) + 1
    listing.last_optimized_at = datetime.utcnow()
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"更新优化描述失败: {str(e)}")
    return {"ok": True, "version": listing.optimization_version}
