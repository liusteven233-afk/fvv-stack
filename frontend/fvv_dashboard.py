"""FVV Stack Dashboard - 美客多全流程运营系统"""
import sys, os, json, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import streamlit as st
import httpx
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="FVV Stack", page_icon="🛒", layout="wide")
API_URL = "http://127.0.0.1:8649"

# Session state defaults
if "pricing_result" not in st.session_state:
    st.session_state["pricing_result"] = None
if "api_ok" not in st.session_state:
    st.session_state["api_ok"] = None
if "last_refresh" not in st.session_state:
    st.session_state["last_refresh"] = None


def api_health():
    """带缓存的API健康检查"""
    now = time.time()
    if st.session_state["last_refresh"] is None or now - st.session_state["last_refresh"] > 10:
        try:
            r = httpx.get(f"{API_URL}/health", timeout=3)
            st.session_state["api_ok"] = r.status_code == 200
        except:
            st.session_state["api_ok"] = False
        st.session_state["last_refresh"] = now
    return st.session_state["api_ok"]


def api_get(path, timeout=5):
    if not api_health():
        return None
    try:
        r = httpx.get(f"{API_URL}{path}", timeout=timeout)
        if r.status_code != 200:
            st.toast(f"⚠️ API错误 ({path}): {r.status_code}", icon="⚠️")
            return None
        return r.json()
    except httpx.TimeoutException:
        st.toast(f"⏱️ API超时 ({path})", icon="⏱️")
        return None
    except Exception as e:
        st.toast(f"❌ API连接失败: {e}", icon="❌")
        return None


def api_post(path, data, timeout=5):
    if not api_health():
        return None
    try:
        r = httpx.post(f"{API_URL}{path}", json=data, timeout=timeout)
        if r.status_code != 200:
            try:
                detail = r.json().get("detail", r.text)
            except:
                detail = r.text
            st.toast(f"⚠️ API错误 ({path}): {detail}", icon="⚠️")
            return None
        return r.json()
    except httpx.TimeoutException:
        st.toast(f"⏱️ API超时 ({path})", icon="⏱️")
        return None
    except Exception as e:
        st.toast(f"❌ API连接失败: {e}", icon="❌")
        return None


# CSS
st.markdown("""
<style>
    .stApp { background: #0b0c0f; color: #e0e0e0; }
    .stButton button {
        background: linear-gradient(135deg, #FFE600, #FFC700) !important;
        color: #0b0c0f !important; font-weight: 600; border: none !important;
    }
    .stButton button:hover { opacity: 0.9; }
    h1, h2, h3 { color: #FFE600 !important; }
    .stTabs [data-baseweb="tab"] { color: #7a7f8c; }
    .stTabs [aria-selected="true"] { color: #FFE600 !important; }
    .stDataFrame { background: #1a1b23; }
    .stTextInput input, .stNumberInput input, .stSelectbox select {
        background: #1a1b23 !important; color: #e0e0e0 !important; border-color: #2a2b33 !important;
    }
    div[data-testid="stMetricValue"] { color: #FFE600 !important; }
    div[data-testid="stMetricLabel"] { color: #7a7f8c !important; }
</style>
""", unsafe_allow_html=True)

st.title("🛒 FVV Stack · 美客多运营系统")
st.caption("选品 → 核价 → 上架 → 优化 → 发货 → 售后")

# API状态指示器
api_status = api_health()
st.sidebar.markdown(f"**系统状态:** {'🟢 在线' if api_status else '🔴 离线'}")
if not api_status:
    st.sidebar.error("🔴 后端API未连接，Dashboard功能不可用")
    st.sidebar.info("请运行: `bash ~/fvv-stack/fvv.sh start`")
    st.warning("⏳ 等待后端启动...10秒后自动重试", icon="🔄")
    time.sleep(2)
    st.rerun()

tab_names = ["📊 总览", "🎯 选品池", "💰 核价", "📤 上架管理", "📦 采购/物流", "💬 售后中心", "🔧 ML账号"]
tabs = st.tabs(tab_names)


# ===== Tab 1: 总览 =====
with tabs[0]:
    st.header("📊 运营总览")

    products = api_get("/api/products/sourcing?limit=5")
    listings = api_get("/api/listings?limit=5")
    after = api_get("/api/after-sales/stats")
    purchases = api_get("/api/orders/purchases?limit=5")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("选品池", products.get("total", 0) if products else "?")
    col2.metric("已上架", listings.get("total", 0) if listings else "?")
    col3.metric("待处理售后", after.get("open", 0) if after else "?")
    col4.metric("采购记录", purchases.get("total", 0) if purchases else "?")

    st.info("💡 使用Chrome扩展采集ML商品→侧面板核价→Dashboard上架→记录采购与售后")

# ===== Tab 2: 选品池 =====
with tabs[1]:
    st.header("🎯 选品池")
    st.caption("从ML前端提取的潜力商品，按机会评分排序。用Chrome扩展自动采集")

    col_f1, col_f2 = st.columns([3, 1])
    products = api_get("/api/products/sourcing?limit=50")
    if products and products.get("products"):
        df = pd.DataFrame(products["products"])
        display_cols = ["title", "price", "currency", "sales_7d", "opportunity_score", "site_id", "status"]
        available = [c for c in display_cols if c in df.columns]
        if available:
            ren = {"title": "商品名", "price": "售价", "currency": "币种", "sales_7d": "7天销量",
                   "opportunity_score": "评分", "site_id": "站点", "status": "状态"}
            df = df[available].rename(columns={k: v for k, v in ren.items() if k in available})
            st.dataframe(df, use_container_width=True, hide_index=True)
        st.caption(f"共 {products['total']} 条")
    else:
        st.info("打开ML商品详情页自动采集，或通过Chrome扩展手动采集")

# ===== Tab 3: 核价 =====
with tabs[2]:
    st.header("💰 核价计算")
    st.caption("成本 = 1688进货价 + 国内运费 + 货代费用")

    col1, col2 = st.columns([1, 2])
    with col1:
        sourcing = st.number_input("1688进货价 (¥)", min_value=0.0, step=1.0, format="%.2f", key="d_source")
        weight = st.number_input("重量 (kg)", min_value=0.0, value=0.3, step=0.1, format="%.2f", key="d_weight")
        freight = st.number_input("货代费用 (¥)", min_value=0.0, step=1.0, format="%.2f", key="d_freight")
        cost_cny = sourcing + freight
        st.metric("总成本 (¥)", f"{cost_cny:.2f}")

        profit_mode = st.selectbox("利润模式", ["profit_value", "sale_price", "target_margin"],
            format_func=lambda x: {"profit_value": "利润值 (¥)", "sale_price": "售价利润率 (%)", "target_margin": "目标毛利率 (%)"}[x],
            key="d_mode")

        if profit_mode == "profit_value":
            profit_val = st.number_input("目标利润 (¥)", min_value=0.0, value=10.0, step=5.0, key="d_pv")
            margin_val = 20
        else:
            profit_val = 10
            margin_val = st.number_input("目标利润率 (%)", min_value=0, value=20, step=5, key="d_mv")

        sites = st.multiselect("计算站点", ["MLM", "MLB", "MLC", "MCO", "MLA", "MLU"],
            default=["MLM", "MLB", "MLC", "MCO", "MLA", "MLU"], key="d_sites")

        if st.button("📊 计算全部", key="btn_calc"):
            result = api_post("/api/pricing/calculate", {
                "sourcing_cny": sourcing, "weight_kg": weight, "freight_fee_cny": freight,
                "profit_mode": profit_mode, "profit_value": profit_val, "target_margin": margin_val,
                "sites": sites,
            })
            st.session_state["pricing_result"] = result

    with col2:
        result = st.session_state.get("pricing_result")
        if result and result.get("results"):
            rows = []
            for r in result["results"]:
                rows.append({
                    "国家": r["country"], "售价": f"{r['currency']} {r['sale_local']:,.2f}",
                    "运费": f"${r['ship_usd']:.2f}", "到账": f"${r['net_usd']:.2f}",
                    "利润(¥)": f"¥{r['profit_cny']:.2f}", "利润率": f"{r['margin_pct']}%",
                })
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
            st.caption(f"模式: {result['mode']} | 成本: ¥{cost_cny:.2f}")

# ===== Tab 4: 上架管理 =====
with tabs[3]:
    st.header("📤 上架管理")
    col1, col2 = st.columns([2, 1])
    with col2:
        st.subheader("新建上架")
        lst_title = st.text_input("标题", key="lst_t")
        lst_desc = st.text_area("描述", key="lst_d", height=100)
        lst_cat = st.text_input("类目ID", key="lst_c")
        lst_price = st.number_input("当地售价", min_value=0.0, key="lst_p", step=1.0)
        lst_stock = st.number_input("库存", min_value=1, value=10, key="lst_s")
        # 账号选择
        accounts = api_get("/api/ml/auth/accounts")
        account_opts = {}
        if accounts and isinstance(accounts, list):
            for a in accounts:
                account_opts[f"{a.get('nickname','?')} ({a.get('site_id','?')})"] = a["id"]
        lst_account = st.selectbox("ML账号", list(account_opts.keys()) if account_opts else ["无账号"],
            key="lst_acc") if account_opts else st.text_input("ML账号ID", value="1", key="lst_acc")
        lst_acc_id = account_opts.get(lst_account, 1) if account_opts else 1
        # 根据选择的账号自动推导币种
        SITE_CURRENCY = {"MLM":"MXN","MLB":"BRL","MLC":"CLP","MCO":"COP","MLA":"ARS","MLU":"UYU"}
        lst_site = next((k for k in account_opts if account_opts[k] == lst_acc_id), "MLM").split("(")[-1].rstrip(")") if account_opts else "MLM"
        lst_currency = SITE_CURRENCY.get(lst_site, "MXN")
        if st.button("💾 保存草稿", key="btn_save"):
            r = api_post("/api/listings/create", {
                "account_id": lst_acc_id, "title": lst_title, "description": lst_desc,
                "category_id": lst_cat, "price_local": lst_price, "currency": lst_currency, "stock": lst_stock,
            })
            if r: st.success(f"✅ 草稿已保存 (ID: {r.get('id')})")
            else: st.error("❌ 保存失败，请检查API连接和输入")

    with col1:
        st.subheader("已保存Listing")
        listings = api_get("/api/listings?limit=30")
        if listings and listings.get("listings"):
            df = pd.DataFrame(listings["listings"])
            cols = ["id", "title", "price_local", "currency", "status", "estimated_profit_cny"]
            available = [c for c in cols if c in df.columns]
            if available:
                ren = {"id": "ID", "title": "商品", "price_local": "售价", "currency": "币种",
                       "status": "状态", "estimated_profit_cny": "预估利润"}
                df = df[available].rename(columns={k: v for k, v in ren.items() if k in available})
                st.dataframe(df, use_container_width=True, hide_index=True)

# ===== Tab 5: 采购/物流 =====
with tabs[4]:
    st.header("📦 采购记录与物流追踪")
    st.caption("成本 = 1688进货价 + 国内运费 + 货代费用 | 净收益 = ML到账 - 成本")

    col1, col2 = st.columns([1, 1])
    with col1:
        with st.form("purchase_form"):
            st.subheader("新建采购记录")
            po_1688 = st.text_input("1688订单号")
            po_track = st.text_input("1688物流单号")
            po_supplier = st.text_input("供应商名称")
            po_sourcing = st.number_input("1688进货价 (¥)", min_value=0.0, step=1.0, format="%.2f")
            po_domestic = st.number_input("国内运费 (¥)", min_value=0.0, step=1.0, format="%.2f")
            po_forwarder = st.number_input("货代费用 (¥)", min_value=0.0, step=1.0, format="%.2f")
            po_net = st.number_input("ML到账 (USD)", min_value=0.0, step=0.5, format="%.2f")
            po_est = st.number_input("核价预估利润 (¥)", min_value=0.0, step=1.0, format="%.2f")
            po_cross = st.text_input("跨境物流单号")

            if st.form_submit_button("💾 保存"):
                calc_cost = po_sourcing + po_domestic + po_forwarder
                st.info(f"📊 总成本: ¥{calc_cost:.2f}")
                r = api_post("/api/orders/purchases", {
                    "order_1688_number": po_1688, "tracking_1688_number": po_track,
                    "supplier_name": po_supplier, "sourcing_price_cny": po_sourcing,
                    "domestic_shipping_cny": po_domestic, "freight_forwarder_fee_cny": po_forwarder,
                    "net_received_usd": po_net, "estimated_profit_cny": po_est,
                    "cross_border_tracking": po_cross,
                })
                if r:
                    v = r.get('profit_variance_cny')
                    var_str = f"¥{v:+.2f}" if v is not None else "¥? (无预估)"
                    st.success(f"✅ 净收益: ¥{r.get('profit_cny', 0):.2f} | 对价差异: {var_str}")
                else:
                    st.error("❌ 保存失败，请检查API连接和输入")

    with col2:
        st.subheader("采购记录列表")
        purchases = api_get("/api/orders/purchases?limit=20")
        if purchases and purchases.get("purchases"):
            rows = []
            for p in purchases["purchases"]:
                v = p.get("profit_variance_cny")
                rows.append({"单号": p.get("order_1688_number", ""), "成本(¥)": p.get("cost_cny", 0),
                             "净收益(¥)": p.get("profit_cny", 0), "对价差异": f"¥{v:+.2f}" if v is not None else "-",
                             "状态": p.get("status", "")})
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

# ===== Tab 6: 售后中心 =====
with tabs[5]:
    st.header("💬 售后中心 - 多账号统一管理")
    col1, col2 = st.columns([1, 3])
    with col1:
        stats = api_get("/api/after-sales/stats")
        if stats:
            st.metric("待处理", stats.get("open", 0))
            st.metric("超时", stats.get("overdue", 0))
            st.metric("总计", stats.get("total", 0))

    with col2:
        after_sales = api_get("/api/after-sales?limit=50")
        if after_sales and after_sales.get("items"):
            df = pd.DataFrame(after_sales["items"])
            cols = ["id", "type", "status", "subject", "buyer_nickname", "is_overdue"]
            available = [c for c in cols if c in df.columns]
            if available:
                ren = {"id": "ID", "type": "类型", "status": "状态", "subject": "主题",
                       "buyer_nickname": "买家", "is_overdue": "超时"}
                df = df[available].rename(columns={k: v for k, v in ren.items() if k in available})
                st.dataframe(df, use_container_width=True, hide_index=True)

# ===== Tab 7: ML账号管理 =====
with tabs[6]:
    st.header("🔧 ML多账号管理")
    col1, col2 = st.columns([1, 1])
    with col1:
        st.subheader("添加ML账号")
        with st.form("add_account"):
            nick = st.text_input("账号名称", "墨西哥店")
            site = st.selectbox("站点", ["MLM", "MLB", "MLC", "MCO", "MLA", "MLU"],
                format_func=lambda x: {"MLM":"墨西哥","MLB":"巴西","MLC":"智利","MCO":"哥伦比亚","MLA":"阿根廷","MLU":"乌拉圭"}[x])
            cid = st.text_input("Client ID")
            csec = st.text_input("Client Secret", type="password")
            if st.form_submit_button("添加"):
                r = api_post("/api/ml/auth/accounts", {"nickname": nick, "site_id": site, "client_id": cid, "client_secret": csec})
                if r: st.success(f"✅ 已添加 (ID: {r.get('id')})")
                else: st.error("❌ 添加失败，请检查Client ID/Secret是否正确")

    with col2:
        st.subheader("已添加账号")
        accounts = api_get("/api/ml/auth/accounts")
        if accounts:
            df = pd.DataFrame(accounts) if accounts else pd.DataFrame()
            if not df.empty:
                st.dataframe(df, use_container_width=True, hide_index=True)
            else:
                st.info("暂无账号")
        else:
            st.info("暂无账号")
