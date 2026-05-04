"""核价API - 复用fvv引擎"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
import json

router = APIRouter()

# ===== 汇率 =====
DEFAULT_FX = {
    "usd_cny": 0.138,  # 1 CNY = 0.138 USD
    "MXN": 0.049,      # 1 MXN = 0.049 USD
    "BRL": 0.174,      # 1 BRL = 0.174 USD
    "COP": 0.00023,    # 1 COP = 0.00023 USD
    "CLP": 0.00107,    # 1 CLP = 0.00107 USD
    "ARS": 0.00105,    # 1 ARS = 0.00105 USD
    "UYU": 0.024,      # 1 UYU = 0.024 USD
}

COUNTRIES = {
    "MLM": {"name": "México", "currency": "MXN", "comm": 0.175},
    "MLB": {"name": "Brasil", "currency": "BRL", "comm": 0.17},
    "MLC": {"name": "Chile", "currency": "CLP", "comm": 0.165},
    "MCO": {"name": "Colombia", "currency": "COP", "comm": 0.17},
    "MLA": {"name": "Argentina", "currency": "ARS", "comm": 0.18},
    "MLU": {"name": "Uruguay", "currency": "UYU", "comm": 0.16},
}

SHIP_RAW = {
    "MLM": [[0.1,4.0,1.7],[0.2,5.4,2.1],[0.3,6.8,2.9],[0.4,8.5,3.9],[0.5,9.9,5.0],[0.6,11.8,6.9],[0.7,13.4,8.9],[0.8,14.8,10.7],[0.9,16.3,13.8],[1.0,17.3,13.8],[1.5,21.8,21.8],[2.0,30.2,30.2],[2.5,51.8,51.8],[3.0,51.8,51.8]],
    "MLB": [[0.1,5.1,1.7],[0.2,6.2,2.4],[0.3,9.3,2.9],[0.4,9.6,4.1],[0.5,12.2,4.7],[0.6,12.7,6.8],[0.7,15.0,9.0],[0.8,15.2,10.0],[0.9,18.0,12.0],[1.0,18.5,16.0],[1.5,22.5,22.5],[2.0,29.6,29.6],[2.5,44.7,44.7]],
    "MCO": [[0.1,4.1,1.8],[0.2,5.5,2.4],[0.3,6.8,3.5],[0.4,8.8,5.0],[0.5,9.4,6.5],[0.6,11.9,8.2],[0.7,12.7,9.5],[0.8,13.3,10.5],[0.9,14.1,12.5],[1.0,14.8,14.8],[1.5,20.5,20.5],[2.0,28.3,28.3],[2.5,47.5,45.0],[3.0,47.5,45.0]],
    "MLC": [[0.1,4.0,1.2],[0.2,5.0,1.2],[0.3,6.4,1.2],[0.4,7.9,1.8],[0.5,9.1,1.8],[0.6,10.0,3.6],[0.7,11.2,3.6],[0.8,11.8,3.6],[0.9,13.3,6.0],[1.0,14.0,6.0],[1.5,18.5,12.0],[2.0,25.1,24.0],[2.5,46.1,36.0],[3.0,46.1,36.0]],
    "MLA": [[0.1,12.4,5.0],[0.2,13.6,5.0],[0.3,15.0,5.0],[0.4,16.3,5.0],[0.5,17.7,8.0],[0.6,19.0,8.0],[0.7,20.3,9.0],[0.8,21.7,9.0],[0.9,23.0,12.0],[1.0,24.3,12.0],[1.5,28.0,12.0],[2.0,35.1,25.0],[2.5,41.6,35.0],[3.0,48.2,45.0]],
    "MLU": [[0.1,8.31,8.31],[0.2,10.2,10.2],[0.3,11.91,11.91],[0.4,13.78,13.78],[0.5,15.68,15.68],[0.6,18.71,18.71],[0.7,20.62,20.62],[0.8,22.51,22.51],[0.9,24.40,24.40],[1.0,26.28,26.28],[1.5,32.09,32.09],[2.0,42.68,42.68]],
}

SHIP_THRESHOLD = {"MLM": 299, "MLB": 79, "MLC": 19990, "MCO": 60000, "MLA": 33000, "MLU": 1200}


def get_ship_fee(site_id: str, weight_kg: float, local_price: float) -> float:
    """获取运费 (local_price为当地货币)"""
    rates = SHIP_RAW.get(site_id, [])
    if not rates:
        return 0.0
    for limit, above, below in rates:
        if weight_kg <= limit:
            return below if local_price < SHIP_THRESHOLD.get(site_id, 0) else above
    last = rates[-1]
    return last[2] if local_price < SHIP_THRESHOLD.get(site_id, 0) else last[1]


@router.post("/calculate")
def calculate_pricing(data: dict):
    """核价计算 - 支持多模式"""
    sourcing_cny = data.get("sourcing_cny", 0)  # 1688进货价(¥)
    weight_kg = data.get("weight_kg", 0.3)
    freight_fee_cny = data.get("freight_fee_cny", 0)  # 货代费用(¥)
    profit_mode = data.get("profit_mode", "profit_value")  # 利润模式
    profit_value = data.get("profit_value", 10)  # 目标利润值¥
    target_margin = data.get("target_margin", 20)  # 目标利润率%
    sale_price = data.get("sale_price", 0)  # 售价(手动输入)

    VALID_MODES = ["profit_value", "target_margin", "sale_price"]
    if profit_mode not in VALID_MODES:
        raise HTTPException(400, f"无效的利润模式: {profit_mode}，可选: {', '.join(VALID_MODES)}")
    site_ids = data.get("sites", ["MLM", "MLB", "MLC", "MCO", "MLA", "MLU"])
    fx_rates = data.get("fx_rates", DEFAULT_FX)

    cost_cny = sourcing_cny + freight_fee_cny
    usd_cny_rate = fx_rates.get("usd_cny", 0.138)
    if usd_cny_rate <= 0:
        usd_cny_rate = 0.138
    cost_usd = cost_cny * usd_cny_rate

    results = []
    for site_id in site_ids:
        country = COUNTRIES.get(site_id)
        if not country:
            continue

        c = country
        curr = c["currency"]
        fx_rate = fx_rates.get(curr, 0)
        comm = c["comm"]

        if profit_mode == "profit_value":
            # 利润值模式: 到账 = 成本 + 利润
            need_net = cost_usd + profit_value * usd_cny_rate
            # 先假设高价运费
            ship = get_ship_fee(site_id, weight_kg, 999999)
            comm_rate = 1 - comm
            if comm_rate <= 0:
                comm_rate = 0.01
            sale = (need_net + ship) / comm_rate
            sale_local = sale / fx_rate if fx_rate > 0 else 999999
            ship2 = get_ship_fee(site_id, weight_kg, sale_local)
            if ship2 < ship:
                ship = ship2
                sale = (need_net + ship) / comm_rate
            net = need_net
            margin = (net - cost_usd) / net * 100 if net > 0 else 0

        elif profit_mode == "sale_margin":
            # 售价利润率模式: 用户指定售价，按实际售价计算利润率
            if sale_price <= 0:
                continue
            sale_local = sale_price
            sale = sale_local * fx_rate
            ship = get_ship_fee(site_id, weight_kg, sale_local)
            net = sale * (1 - comm) - ship
            margin = (net - cost_usd) / sale * 100 if sale > 0 else 0

        elif profit_mode == "net_margin":
            # 目标毛利率模式: 到账利润率
            target = target_margin / 100
            if target >= 1:
                continue
            need_net = cost_usd / (1 - target)
            ship = get_ship_fee(site_id, weight_kg, 999999)
            comm_rate = 1 - comm
            if comm_rate <= 0:
                comm_rate = 0.01
            sale = (need_net + ship) / comm_rate
            sale_local = sale / fx_rate if fx_rate > 0 else 999999
            ship2 = get_ship_fee(site_id, weight_kg, sale_local)
            if ship2 < ship:
                ship = ship2
                sale = (need_net + ship) / comm_rate
            net = need_net
            margin = target_margin

        else:
            continue

        profit_usd = net - cost_usd
        profit_cny = profit_usd / usd_cny_rate if usd_cny_rate > 0 else 0

        sale_local = sale / fx_rate if fx_rate > 0 else 0
        results.append({
            "site_id": site_id,
            "country": c["name"],
            "currency": curr,
            "sale_local": round(sale_local, 2),
            "sale_usd": round(sale, 2),
            "ship_usd": round(ship, 2),
            "comm_rate": comm,
            "net_usd": round(net, 2),
            "cost_usd": round(cost_usd, 2),
            "cost_cny": round(cost_cny, 2),
            "profit_usd": round(profit_usd, 2),
            "profit_cny": round(profit_cny, 2),
            "margin_pct": round(margin, 1),
        })

    return {
        "mode": profit_mode,
        "fx_rates": fx_rates,
        "results": results,
    }


@router.get("/fx")
def get_fx_rates():
    """获取当前汇率"""
    return DEFAULT_FX


@router.get("/shipping/{site_id}")
def get_shipping_rates(site_id: str, weight_kg: float = 0.5, local_price: float = 500):
    """获取某个站点的运费"""
    if site_id not in SHIP_RAW:
        raise HTTPException(404, f"不支持的站点: {site_id}")
    ship = get_ship_fee(site_id, weight_kg, local_price)
    threshold = SHIP_THRESHOLD.get(site_id, 0)
    return {
        "site_id": site_id,
        "weight_kg": weight_kg,
        "shipping_usd": round(ship, 2),
        "threshold": threshold,
        "use_below_price": local_price < threshold,
    }
