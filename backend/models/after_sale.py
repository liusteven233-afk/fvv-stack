"""After Sales - 售后管理"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from .database import Base


class AfterSale(Base):
    """售后单 - 多账号统一管理"""
    __tablename__ = "after_sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, nullable=False)  # ML账号
    order_id = Column(Integer, nullable=True)
    ml_order_id = Column(String(100))

    # 售后类型
    type = Column(String(30), default="message")  # message/question/return/dispute/complaint
    status = Column(String(30), default="open")  # open/processing/resolved/closed

    # 买家
    buyer_id = Column(Integer)
    buyer_nickname = Column(String(200))

    # 内容
    subject = Column(String(500), default="")
    content = Column(Text, default="")
    last_reply_at = Column(DateTime)

    # 回复
    total_replies = Column(Integer, default=0)
    my_replies = Column(Integer, default=0)
    last_reply_content = Column(Text)
    resolved_by = Column(String(50))  # auto / manual

    # 时效
    response_time_mins = Column(Integer)  # 首次响应时间
    resolution_time_mins = Column(Integer)  # 解决时间
    is_overdue = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
