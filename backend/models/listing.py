"""ML Listing - 上架管理"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from .database import Base


class Listing(Base):
    """已上架的Listing"""
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, nullable=False)  # 关联ML账号
    ml_item_id = Column(String(100), nullable=True, index=True)  # ML的item_id
    product_id = Column(Integer, nullable=True)  # 关联选品池

    # 商品信息
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    category_id = Column(String(100))
    price_local = Column(Float, nullable=False)  # ML当地售价
    currency = Column(String(10))
    stock = Column(Integer, default=1)
    condition = Column(String(20), default="new")  # new/used

    # 图片
    images = Column(Text)  # JSON array

    # 运费
    shipping_type = Column(String(50), default="cross_border")
    shipping_free = Column(Boolean, default=True)

    # 核价数据（存快照）
    sourcing_price_cny = Column(Float)  # 1688进货价(¥)
    freight_fee_cny = Column(Float)     # 货代费用(¥)
    cost_usd = Column(Float)            # 成本USD
    net_received_usd = Column(Float)    # ML到账USD
    estimated_profit_cny = Column(Float)  # 预估净利润(¥)
    profit_mode = Column(String(20))    # 使用的利润模式

    # 优化数据
    optimization_version = Column(Integer, default=0)
    last_optimized_at = Column(DateTime)

    # 状态
    status = Column(String(20), default="draft")  # draft/pending/active/paused/ended
    ml_status = Column(String(50))  # ML返回的状态
    listing_url = Column(String(1000))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    listed_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
