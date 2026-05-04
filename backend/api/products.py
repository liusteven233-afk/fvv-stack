"""选品API - ML商品管理"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from models.database import get_db
from models.ml_account import MLProduct

router = APIRouter()


@router.get("/sourcing")
def list_sourcing_products(
    status: Optional[str] = None,
    site_id: Optional[str] = None,
    min_score: Optional[float] = None,
    sort_by: str = "opportunity_score",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """获取选品池"""
    query = db.query(MLProduct)
    if status:
        query = query.filter(MLProduct.status == status)
    if site_id:
        query = query.filter(MLProduct.site_id == site_id)
    if min_score:
        query = query.filter(MLProduct.opportunity_score >= min_score)

    # Sort
    sort_map = {
        "score": MLProduct.opportunity_score,
        "sales": MLProduct.sales_7d,
        "price": MLProduct.price,
        "date": MLProduct.listed_date,
    }
    order_col = sort_map.get(sort_by, MLProduct.opportunity_score)
    query = query.order_by(order_col.desc())

    total = query.count()
    products = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "products": [
            {
                "id": p.id,
                "ml_item_id": p.ml_item_id,
                "site_id": p.site_id,
                "title": p.title,
                "price": p.price,
                "currency": p.currency,
                "category_name": p.category_name,
                "sales_7d": p.sales_7d,
                "total_sales": p.total_sales,
                "days_since_listed": p.days_since_listed,
                "seller_name": p.seller_name,
                "images": p.images,
                "shipping_free": p.shipping_free,
                "competitor_count": p.competitor_count,
                "opportunity_score": p.opportunity_score,
                "profit_estimate": p.profit_estimate,
                "sourcing_price_1688": p.sourcing_price_1688,
                "sourcing_weight_kg": p.sourcing_weight_kg,
                "sourcing_url": p.sourcing_url,
                "status": p.status,
                "notes": p.notes,
                "created_at": p.created_at.isoformat(),
            }
            for p in products
        ],
    }


@router.post("/sourcing")
def add_sourcing_product(data: dict, db: Session = Depends(get_db)):
    """手动添加选品"""
    ml_item_id = data.get("ml_item_id")
    title = data.get("title")
    price = data.get("price")
    if not ml_item_id or not title or price is None:
        raise HTTPException(400, "ml_item_id, title, price 为必填字段")
    try:
        product = MLProduct(
            ml_item_id=ml_item_id,
            site_id=data.get("site_id", "MLM"),
            title=title,
            price=price,
            currency=data.get("currency", "MXN"),
            category_id=data.get("category_id"),
            category_name=data.get("category_name"),
            sales_7d=data.get("sales_7d", 0),
            total_sales=data.get("total_sales", 0),
            seller_name=data.get("seller_name"),
            images=data.get("images"),
            shipping_free=data.get("shipping_free", False),
            competitor_count=data.get("competitor_count", 0),
            opportunity_score=data.get("opportunity_score", 0),
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return {"id": product.id, "ml_item_id": product.ml_item_id}
    except Exception as e:
        db.rollback()
        if "UNIQUE constraint" in str(e) or "IntegrityError" in str(e):
            raise HTTPException(409, f"该商品已在选品池中: {ml_item_id}")
        raise HTTPException(500, f"添加选品失败: {str(e)}")


@router.put("/sourcing/{product_id}")
def update_sourcing_product(product_id: int, data: dict, db: Session = Depends(get_db)):
    """更新选品信息（如1688匹配结果）"""
    product = db.query(MLProduct).filter(MLProduct.id == product_id).first()
    if not product:
        raise HTTPException(404, "选品不存在")

    for key, value in data.items():
        if hasattr(product, key):
            setattr(product, key, value)

    db.commit()
    return {"ok": True}


@router.post("/sourcing/batch")
def batch_add_products(products: list[dict], db: Session = Depends(get_db)):
    """批量添加选品"""
    count = 0
    errors = 0
    try:
        for data in products:
            ml_item_id = data.get("ml_item_id")
            if not ml_item_id:
                errors += 1
                continue
            existing = db.query(MLProduct).filter(MLProduct.ml_item_id == ml_item_id).first()
            if existing:
                continue
            product = MLProduct(
                ml_item_id=ml_item_id,
                site_id=data.get("site_id", "MLM"),
                title=data.get("title", ""),
                price=data.get("price", 0),
                currency=data.get("currency", "MXN"),
                sales_7d=data.get("sales_7d", 0),
                total_sales=data.get("total_sales", 0),
                seller_name=data.get("seller_name"),
                opportunity_score=data.get("opportunity_score", 0),
            )
            db.add(product)
            count += 1
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"批量添加失败: {str(e)}")
    return {"added": count, "skipped": errors}
