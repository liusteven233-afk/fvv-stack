"""ML Account - OAuth token management"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from .database import Base


class MLAccount(Base):
    __tablename__ = "ml_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nickname = Column(String(100), nullable=False, default="")  # 自定义名称
    site_id = Column(String(10), nullable=False)  # MLM/MLB/MLC/MCO/MLA/MLU
    user_id = Column(Integer, nullable=False)  # ML卖家ID

    # OAuth tokens
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    token_expires_at = Column(DateTime, nullable=False)
    client_id = Column(String(100), nullable=False, default="")
    client_secret = Column(String(200), nullable=False, default="")

    # Seller info
    seller_nickname = Column(String(200), default="")
    email = Column(String(200), default="")
    seller_score = Column(Float, default=0.0)
    listing_count = Column(Integer, default=0)
    active_listings = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MLProduct(Base):
    """ML选品池 - 从ML前端采集的商品"""
    __tablename__ = "ml_products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ml_item_id = Column(String(100), unique=True, nullable=False, index=True)
    site_id = Column(String(10), nullable=False)
    title = Column(String(500), nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False)

    # 分类
    category_id = Column(String(100))
    category_name = Column(String(200))

    # 销量数据
    sales_7d = Column(Integer, default=0)
    total_sales = Column(Integer, default=0)
    listed_date = Column(DateTime)
    days_since_listed = Column(Integer, default=0)

    # 卖家
    seller_name = Column(String(200))
    seller_id = Column(Integer)
    seller_type = Column(String(50))  # mercadolibre / premium / etc

    # 图片
    images = Column(Text)  # JSON array of URLs

    # 市场价格
    shipping_free = Column(Boolean, default=False)
    shipping_cost = Column(Float, default=0)

    # 竞争分析
    competitor_count = Column(Integer, default=0)
    top10_market_share = Column(Float, default=0.0)

    # 评分 (系统计算)
    opportunity_score = Column(Float, default=0.0)  # 选品机会评分
    profit_estimate = Column(Float, default=0.0)  # 预估利润
    sourcing_price_1688 = Column(Float, nullable=True)  # 1688匹配价格
    sourcing_weight_kg = Column(Float, nullable=True)  # 重量
    sourcing_url = Column(String(1000), nullable=True)  # 1688链接

    # 状态
    status = Column(String(20), default="pending")  # pending/sourcing/priced/listed/abandoned
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
