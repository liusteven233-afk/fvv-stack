"""ML Auth API - 多账号OAuth管理"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from models.database import get_db
from models.ml_account import MLAccount
from services.ml_service import MLService, SITES

router = APIRouter()


class AccountCreate(BaseModel):
    nickname: str = ""
    site_id: str = "MLM"
    client_id: str
    client_secret: str
    access_token: str = ""
    refresh_token: str = ""
    user_id: int = 0


class AccountUpdate(BaseModel):
    nickname: str = None
    client_id: str = None
    client_secret: str = None
    is_active: bool = None


@router.get("/sites")
def list_sites():
    """列出所有支持站点"""
    return SITES


@router.post("/accounts")
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    """手动添加ML账号"""
    account = MLAccount(
        nickname=data.nickname or f"{SITES.get(data.site_id, 'ML')}账号",
        site_id=data.site_id,
        user_id=data.user_id,
        client_id=data.client_id,
        client_secret=data.client_secret,
        access_token=data.access_token,
        refresh_token=data.refresh_token,
        token_expires_at=datetime.utcnow() + timedelta(hours=6),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return {"id": account.id, "nickname": account.nickname, "site_id": account.site_id}


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    """列出所有ML账号"""
    accounts = db.query(MLAccount).all()
    return [
        {
            "id": a.id,
            "nickname": a.nickname,
            "site_id": a.site_id,
            "user_id": a.user_id,
            "seller_nickname": a.seller_nickname,
            "is_active": a.is_active,
            "listings": a.active_listings,
            "last_sync": a.last_sync_at.isoformat() if a.last_sync_at else None,
        }
        for a in accounts
    ]


@router.get("/accounts/{account_id}")
def get_account(account_id: int, db: Session = Depends(get_db)):
    """获取账号详情"""
    account = db.query(MLAccount).filter(MLAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "账号不存在")
    return {
        "id": account.id,
        "nickname": account.nickname,
        "site_id": account.site_id,
        "user_id": account.user_id,
        "seller_nickname": account.seller_nickname,
        "email": account.email,
        "seller_score": account.seller_score,
        "listing_count": account.listing_count,
        "active_listings": account.active_listings,
        "is_active": account.is_active,
        "token_expires_at": account.token_expires_at.isoformat(),
        "last_sync": account.last_sync_at.isoformat() if account.last_sync_at else None,
        "created_at": account.created_at.isoformat(),
    }


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """删除账号"""
    account = db.query(MLAccount).filter(MLAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "账号不存在")
    db.delete(account)
    db.commit()
    return {"ok": True}


@router.post("/accounts/{account_id}/sync")
async def sync_account(account_id: int, db: Session = Depends(get_db)):
    """同步账号信息 - 从ML拉取卖家信息"""
    try:
        user_info = await MLService.get_user_info(account_id)
        account = db.query(MLAccount).filter(MLAccount.id == account_id).first()
        if account:
            account.seller_nickname = user_info.get("nickname", "")
            account.email = user_info.get("email", "")
            account.seller_score = user_info.get("seller_reputation", {}).get("level_id", 0)
            account.last_sync_at = datetime.utcnow()
            db.commit()
        return user_info
    except Exception as e:
        raise HTTPException(400, f"同步失败: {str(e)}")


@router.get("/accounts/{account_id}/categories")
async def get_categories(account_id: int, db: Session = Depends(get_db)):
    """获取账号对应站点的类目树"""
    account = db.query(MLAccount).filter(MLAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "账号不存在")
    try:
        categories = await MLService.get_categories(account.site_id)
        return categories[:50]  # 返回前50个
    except Exception as e:
        raise HTTPException(400, f"获取类目失败: {str(e)}")


@router.get("/categories/{category_id}/attributes")
async def get_attributes(category_id: str):
    """获取类目属性"""
    try:
        attrs = await MLService.get_category_attributes(category_id)
        return [
            {
                "id": a["id"],
                "name": a["name"],
                "required": a.get("required", False),
                "type": a.get("value_type", ""),
                "values": [
                    {"id": v["id"], "name": v["name"]}
                    for v in a.get("values", [])
                ],
            }
            for a in attrs
        ]
    except Exception as e:
        raise HTTPException(400, f"获取属性失败: {str(e)}")
