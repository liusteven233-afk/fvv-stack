"""ML API - 通用ML数据接口"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.ml_account import MLAccount
from services.ml_service import MLService

router = APIRouter()


@router.get("/{account_id}/orders")
async def list_orders(account_id: int, status: str = None, db: Session = Depends(get_db)):
    """获取订单列表"""
    account = db.query(MLAccount).filter(MLAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "账号不存在")
    filters = {}
    if status:
        filters["order.status"] = status
    try:
        orders = await MLService.get_orders(account_id, filters)
        return orders
    except Exception as e:
        raise HTTPException(400, f"获取订单失败: {str(e)}")


@router.get("/{account_id}/questions")
async def list_questions(account_id: int, item_id: str = None, db: Session = Depends(get_db)):
    """获取提问列表"""
    try:
        questions = await MLService.get_questions(account_id, item_id)
        return questions
    except Exception as e:
        raise HTTPException(400, f"获取提问失败: {str(e)}")


@router.post("/{account_id}/questions/{question_id}/answer")
async def answer_question(account_id: int, question_id: int, answer_text: str):
    """回答问题"""
    try:
        result = await MLService.answer_question(account_id, question_id, answer_text)
        return result
    except Exception as e:
        raise HTTPException(400, f"回答失败: {str(e)}")


@router.get("/{account_id}/orders/{order_id}/messages")
async def get_conversation(account_id: int, order_id: str):
    """获取订单对话"""
    try:
        messages = await MLService.get_messages(account_id, order_id)
        return messages
    except Exception as e:
        raise HTTPException(400, f"获取消息失败: {str(e)}")


@router.post("/{account_id}/orders/{order_id}/messages")
async def send_message(account_id: int, order_id: str, text: str):
    """发送消息"""
    try:
        result = await MLService.send_message(account_id, order_id, text)
        return result
    except Exception as e:
        raise HTTPException(400, f"发送失败: {str(e)}")


@router.post("/{account_id}/items")
async def create_listing(account_id: int, listing_data: dict):
    """创建listing"""
    try:
        result = await MLService.create_listing(account_id, listing_data)
        return result
    except Exception as e:
        raise HTTPException(400, f"上架失败: {str(e)}")


@router.put("/{account_id}/items/{item_id}")
async def update_listing(account_id: int, item_id: str, update_data: dict):
    """更新listing"""
    try:
        result = await MLService.update_listing(account_id, item_id, update_data)
        return result
    except Exception as e:
        raise HTTPException(400, f"更新失败: {str(e)}")


@router.put("/{account_id}/items/{item_id}/description")
async def update_description(account_id: int, item_id: str, description: str):
    """更新描述"""
    try:
        result = await MLService.update_description(account_id, item_id, description)
        return result
    except Exception as e:
        raise HTTPException(400, f"更新描述失败: {str(e)}")


@router.post("/{account_id}/upload-image")
async def upload_image(account_id: int, image_url: str):
    """上传图片到ML"""
    try:
        result = await MLService.upload_image(account_id, image_url)
        return result
    except Exception as e:
        raise HTTPException(400, f"上传图片失败: {str(e)}")


@router.get("/{account_id}/shipments/{shipment_id}")
async def get_shipment(account_id: int, shipment_id: str):
    """获取物流详情"""
    try:
        result = await MLService.get_shipment(account_id, shipment_id)
        return result
    except Exception as e:
        raise HTTPException(400, f"获取物流失败: {str(e)}")
