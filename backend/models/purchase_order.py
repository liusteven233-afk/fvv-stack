"""Order & Purchase Order - 订单/采购/物流"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from .database import Base


class Order(Base):
    """ML订单"""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, nullable=False)
    ml_order_id = Column(String(100), unique=True, nullable=False, index=True)
    ml_item_id = Column(String(100))
    listing_id = Column(Integer, nullable=True)

    # 订单信息
    title = Column(String(500))
    quantity = Column(Integer, default=1)
    unit_price_local = Column(Float)
    total_price_local = Column(Float)
    currency = Column(String(10))

    # ML物流
    ml_shipment_id = Column(String(100))  # ML物流ID
    ml_tracking_number = Column(String(200))  # ML物流单号

    # 到账
    net_received_usd = Column(Float)  # ML到账(USD)
    net_received_local = Column(Float)  # ML到账(当地货币)
    commission_rate = Column(Float)  # 实际佣金率
    shipping_fee_usd = Column(Float)  # 实际运费

    # 买家
    buyer_id = Column(Integer)
    buyer_nickname = Column(String(200))

    # 状态
    status = Column(String(30))  # paid/shipped/delivered/cancelled/returned

    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)


class PurchaseOrder(Base):
    """采购记录 - 1688订单"""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, nullable=True, index=True)  # 关联ML订单
    listing_id = Column(Integer, nullable=True)  # 关联listing

    # 1688订单信息
    order_1688_number = Column(String(100), index=True)  # 1688订单号
    tracking_1688_number = Column(String(200))  # 1688物流单号（国内段）
    supplier_name = Column(String(200))  # 供应商名称
    supplier_url = Column(String(1000))  # 1688链接

    # 成本明细
    sourcing_price_cny = Column(Float)  # 1688进货价(实际下单价) ¥
    domestic_shipping_cny = Column(Float, default=0)  # 国内运费 ¥
    freight_forwarder_fee_cny = Column(Float, default=0)  # 货代费用 ¥

    # 物流信息
    cross_border_carrier = Column(String(100))  # 跨境物流商
    cross_border_tracking = Column(String(200))  # 跨境物流单号
    last_mile_tracking = Column(String(200))  # 最后一公里单号

    # 财务
    cost_cny = Column(Float)  # 总成本(¥) = sourcing + domestic + forwarder
    net_received_usd = Column(Float)  # ML到账(USD)
    profit_usd = Column(Float)  # 净收益(USD) = net_received - cost
    profit_cny = Column(Float)  # 净收益(¥)
    fx_rate = Column(Float)  # 汇率快照

    # 对价 (对比核价预估)
    estimated_profit_cny = Column(Float)  # 核价时预估利润
    profit_variance_cny = Column(Float)  # 利润差异(正=比预估多)

    # 状态
    status = Column(String(20), default="pending")  # pending/purchased/shipped/received/completed
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    purchased_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
