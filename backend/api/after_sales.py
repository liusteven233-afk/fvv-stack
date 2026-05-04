"""售后管理API - 多账号统一管理"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from models.database import get_db
from models.after_sale import AfterSale
from services.ml_service import MLService

router = APIRouter()


@router.get("")
def list_after_sales(
    account_id: Optional[int] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """售后列表 - 跨账号统一视图"""
    query = db.query(AfterSale)
    if account_id:
        query = query.filter(AfterSale.account_id == account_id)
    if type:
        query = query.filter(AfterSale.type == type)
    if status:
        query = query.filter(AfterSale.status == status)
    if is_overdue is not None:
        query = query.filter(AfterSale.is_overdue == is_overdue)
    query = query.order_by(AfterSale.created_at.desc())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "id": a.id,
                "account_id": a.account_id,
                "type": a.type,
                "status": a.status,
                "subject": a.subject,
                "content": a.content[:200] if a.content else "",
                "buyer_nickname": a.buyer_nickname,
                "total_replies": a.total_replies,
                "my_replies": a.my_replies,
                "response_time_mins": a.response_time_mins,
                "is_overdue": a.is_overdue,
                "created_at": a.created_at.isoformat(),
            }
            for a in items
        ],
    }


@router.get("/stats")
def after_sales_stats(db: Session = Depends(get_db)):
    """售后统计概览"""
    total = db.query(AfterSale).count()
    open_count = db.query(AfterSale).filter(AfterSale.status == "open").count()
    overdue_count = db.query(AfterSale).filter(AfterSale.is_overdue == True).count()

    type_stats = {}
    for t in ["message", "question", "return", "dispute", "complaint"]:
        count = db.query(AfterSale).filter(AfterSale.type == t).count()
        if count > 0:
            type_stats[t] = count

    return {
        "total": total,
        "open": open_count,
        "overdue": overdue_count,
        "by_type": type_stats,
    }


@router.post("")
def create_after_sale(data: dict, db: Session = Depends(get_db)):
    """手动添加售后单"""
    account_id = data.get("account_id")
    if not account_id:
        raise HTTPException(400, "account_id 是必填字段")
    ticket = AfterSale(
        account_id=account_id,
        order_id=data.get("order_id"),
        ml_order_id=data.get("ml_order_id"),
        type=data.get("type", "message"),
        status="open",
        subject=data.get("subject", ""),
        content=data.get("content", ""),
        buyer_id=data.get("buyer_id"),
        buyer_nickname=data.get("buyer_nickname"),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id}


@router.put("/{ticket_id}/resolve")
def resolve_ticket(ticket_id: int, resolution: str = None, db: Session = Depends(get_db)):
    """标记售后为已解决"""
    ticket = db.query(AfterSale).filter(AfterSale.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "售后单不存在")
    ticket.status = "resolved"
    ticket.resolved_at = datetime.utcnow()
    ticket.resolved_by = "auto"
    if resolution:
        ticket.last_reply_content = resolution
    db.commit()
    return {"ok": True}


@router.post("/{account_id}/sync-questions")
async def sync_questions(account_id: int, db: Session = Depends(get_db)):
    """从ML同步买家提问到售后"""
    try:
        questions = await MLService.get_questions(account_id)
        count = 0
        for q in questions:
            existing = db.query(AfterSale).filter(
                AfterSale.account_id == account_id,
                AfterSale.subject == str(q.get("id")),
            ).first()
            if existing:
                continue
            ticket = AfterSale(
                account_id=account_id,
                type="question",
                status="open",
                subject=f"提问: {q.get('text', '')[:100]}",
                content=q.get("text", ""),
                buyer_id=q.get("buyer_id"),
                created_at=datetime.utcnow(),
            )
            db.add(ticket)
            count += 1
        db.commit()
        return {"synced": count}
    except Exception as e:
        raise HTTPException(400, f"同步失败: {str(e)}")


@router.post("/{account_id}/answer-question/{question_id}")
async def answer_question_from_after_sales(
    account_id: int,
    question_id: int,
    answer: str,
):
    """从售后面板回答问题"""
    try:
        result = await MLService.answer_question(account_id, question_id, answer)
        return result
    except Exception as e:
        raise HTTPException(400, f"回答失败: {str(e)}")
