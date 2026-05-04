"""订单 & 采购记录API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from models.database import get_db
from models.purchase_order import Order, PurchaseOrder

router = APIRouter()


@router.get("")
def list_orders(
    account_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """订单列表"""
    query = db.query(Order)
    if account_id:
        query = query.filter(Order.account_id == account_id)
    if status:
        query = query.filter(Order.status == status)
    query = query.order_by(Order.created_at.desc())

    total = query.count()
    orders = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "orders": [
            {
                "id": o.id,
                "ml_order_id": o.ml_order_id,
                "title": o.title,
                "quantity": o.quantity,
                "total_price_local": o.total_price_local,
                "currency": o.currency,
                "ml_shipment_id": o.ml_shipment_id,
                "ml_tracking_number": o.ml_tracking_number,
                "net_received_usd": o.net_received_usd,
                "status": o.status,
                "paid_at": o.paid_at.isoformat() if o.paid_at else None,
                "shipped_at": o.shipped_at.isoformat() if o.shipped_at else None,
            }
            for o in orders
        ],
    }


@router.get("/purchases")
def list_purchases(
    order_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """采购记录列表"""
    query = db.query(PurchaseOrder)
    if order_id:
        query = query.filter(PurchaseOrder.order_id == order_id)
    if status:
        query = query.filter(PurchaseOrder.status == status)
    query = query.order_by(PurchaseOrder.created_at.desc())

    total = query.count()
    purchases = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "purchases": [
            {
                "id": p.id,
                "order_id": p.order_id,
                "order_1688_number": p.order_1688_number,
                "tracking_1688_number": p.tracking_1688_number,
                "supplier_name": p.supplier_name,
                "sourcing_price_cny": p.sourcing_price_cny,
                "domestic_shipping_cny": p.domestic_shipping_cny,
                "freight_forwarder_fee_cny": p.freight_forwarder_fee_cny,
                "cost_cny": p.cost_cny,
                "net_received_usd": p.net_received_usd,
                "profit_usd": p.profit_usd,
                "profit_cny": p.profit_cny,
                "estimated_profit_cny": p.estimated_profit_cny,
                "profit_variance_cny": p.profit_variance_cny,
                "cross_border_carrier": p.cross_border_carrier,
                "cross_border_tracking": p.cross_border_tracking,
                "last_mile_tracking": p.last_mile_tracking,
                "status": p.status,
                "notes": p.notes,
                "created_at": p.created_at.isoformat(),
            }
            for p in purchases
        ],
    }


@router.post("/purchases")
def create_purchase(data: dict, db: Session = Depends(get_db)):
    """新建采购记录"""
    # 自动计算
    sourcing_cny = data.get("sourcing_price_cny", 0)
    domestic_cny = data.get("domestic_shipping_cny", 0)
    forwarder_cny = data.get("freight_forwarder_fee_cny", 0)

    cost_cny = sourcing_cny + domestic_cny + forwarder_cny
    net_received = data.get("net_received_usd", 0)
    fx_rate = data.get("fx_rate", 7.25)  # 默认汇率

    profit_usd = net_received - (cost_cny / fx_rate) if fx_rate > 0 else 0
    profit_cny = profit_usd * fx_rate

    estimated = data.get("estimated_profit_cny")
    profit_variance = profit_cny - estimated if estimated else None

    purchase = PurchaseOrder(
        order_id=data.get("order_id"),
        listing_id=data.get("listing_id"),
        order_1688_number=data.get("order_1688_number", ""),
        tracking_1688_number=data.get("tracking_1688_number", ""),
        supplier_name=data.get("supplier_name", ""),
        supplier_url=data.get("supplier_url", ""),
        sourcing_price_cny=sourcing_cny,
        domestic_shipping_cny=domestic_cny,
        freight_forwarder_fee_cny=forwarder_cny,
        cost_cny=round(cost_cny, 2),
        net_received_usd=net_received,
        profit_usd=round(profit_usd, 2),
        profit_cny=round(profit_cny, 2),
        estimated_profit_cny=estimated,
        profit_variance_cny=round(profit_variance, 2) if profit_variance is not None else None,
        fx_rate=fx_rate,
        cross_border_carrier=data.get("cross_border_carrier", ""),
        cross_border_tracking=data.get("cross_border_tracking", ""),
        last_mile_tracking=data.get("last_mile_tracking", ""),
        status=data.get("status", "pending"),
        notes=data.get("notes", ""),
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return {
        "id": purchase.id,
        "cost_cny": purchase.cost_cny,
        "profit_cny": purchase.profit_cny,
        "estimated_profit_cny": purchase.estimated_profit_cny,
        "profit_variance_cny": purchase.profit_variance_cny,
    }


@router.put("/purchases/{purchase_id}")
def update_purchase(purchase_id: int, data: dict, db: Session = Depends(get_db)):
    """更新采购记录"""
    purchase = db.query(PurchaseOrder).filter(PurchaseOrder.id == purchase_id).first()
    if not purchase:
        raise HTTPException(404, "采购记录不存在")

    for key, value in data.items():
        if hasattr(purchase, key) and key != "id":
            setattr(purchase, key, value)

    # 重新计算成本+利润
    purchase.cost_cny = purchase.sourcing_price_cny + purchase.domestic_shipping_cny + purchase.freight_forwarder_fee_cny
    fx = purchase.fx_rate or 7.25
    purchase.profit_usd = round(purchase.net_received_usd - (purchase.cost_cny / fx), 2)
    purchase.profit_cny = round(purchase.profit_usd * fx, 2)
    if purchase.estimated_profit_cny:
        purchase.profit_variance_cny = round(purchase.profit_cny - purchase.estimated_profit_cny, 2)

    db.commit()
    return {
        "ok": True,
        "cost_cny": purchase.cost_cny,
        "profit_cny": purchase.profit_cny,
        "estimated_profit_cny": purchase.estimated_profit_cny,
        "profit_variance_cny": purchase.profit_variance_cny,
    }
