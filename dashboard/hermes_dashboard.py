#!/usr/bin/env python3
"""
Hermes 跨境核价面板 v4.0
1688 → Mercado Libre · 菜鸟运费 · 反向定价 · 多站对比 · AI聊天
"""
import streamlit as st
import requests, json, time as _time
from datetime import datetime

st.set_page_config(page_title="Hermes 跨境核价", page_icon="🛒", layout="wide", initial_sidebar_state="collapsed")

# ─── Data ──────────────────────────────────────
COUNTRIES = {
    "MX":{"name":"México","flag":"🇲🇽","currency":"MXN","symbol":"MX$"},
    "BR":{"name":"Brasil","flag":"🇧🇷","currency":"BRL","symbol":"R$"},
    "CO":{"name":"Colombia","flag":"🇨🇴","currency":"COP","symbol":"COL$"},
    "CL":{"name":"Chile","flag":"🇨🇱","currency":"CLP","symbol":"CLP$"},
    "AR":{"name":"Argentina","flag":"🇦🇷","currency":"ARS","symbol":"ARS$"},
    "UY":{"name":"Uruguay","flag":"🇺🇾","currency":"UYU","symbol":"UYU$"},
}
CKS = ["MX","BR","CO","CL","AR","UY"]
SHIP_BK = [0,0.1,0.2,0.5,1.0,2.0,5.0]
BK_LBL = ["0-100g","100-200g","200-500g","500g-1kg","1-2kg","2-5kg"]
DEFAULT_SHIP = {
    "MX":[1.70,2.10,3.93,10.82,26.00,61.03],   # 菜鸟 <MXN299
    "BR":[1.70,2.40,3.90,10.76,26.05,50.10],   # 菜鸟 <BRL79
    "CO":[1.80,2.40,5.00,11.10,24.40,59.40],   # 菜鸟 <COP60000
    "CL":[1.20,1.20,1.60,4.56,18.00,51.00],     # 菜鸟 <CLP19990
    "AR":[5.00,5.00,6.00,10.00,18.50,56.67],    # 菜鸟 <ARS33000
    "UY":[3.00,3.50,4.50,6.00,8.00,11.00],      # 不变
}
FALLBACK_RATES = {"MXN":20.0,"BRL":5.5,"COP":4200,"CLP":950,"ARS":1450,"UYU":42,"CNY":7.3}
ML_CUT = 0.80; BUFFER = 0.50

# ─── Init ─────────────────────────────────────
for k,v in {
    "logged_in":False,"master_pwd":"fvv1123","exrates":{},
    "ship":{k:list(v) for k,v in DEFAULT_SHIP.items()},
    "chat":[{"role":"ai","text":"👋 靓仔你好！选站点→填数据，或直接问我问题。"}],
    "hist":[],"theme":"dark","api_key":"","api_model":"deepseek-chat",
    "api_url":"https://api.deepseek.com/v1/chat/completions",
    "last_ck":"MX","mode":"normal","profit_target":20.0,
}.items():
    if k not in st.session_state: st.session_state[k]=v

# ─── FX ────────────────────────────────────────
def fetch_rates():
    for url in ["https://open.er-api.com/v6/latest/USD","https://api.frankfurter.dev/latest?from=USD"]:
        for _ in range(2):
            try:
                r=requests.get(url,timeout=5).json()
                rt=r.get("rates",{})
                res={c:rt[c] for c in["MXN","BRL","COP","CLP","ARS","UYU","CNY"] if c in rt and rt[c]>0}
                if len(res)>=3:
                    res["fetched"]=datetime.now().strftime("%H:%M")
                    res["usd_cny"]=1.0/rt.get("CNY",7.25)
                    return res
                break
            except: _time.sleep(0.5)
    fb=dict(FALLBACK_RATES); fb["fetched"]=datetime.now().strftime("%H:%M")+"(备)"; fb["usd_cny"]=1.0/fb["CNY"]
    return fb

def fx_rate(ck):
    r=st.session_state.exrates; curr=COUNTRIES[ck]["currency"]
    if not r or curr not in r or r[curr]<=0: return None
    return 1.0/r[curr]

def usd_cny():
    r=st.session_state.exrates
    if not r: return None
    return r.get("usd_cny", None)

def ship_fee(ck,w):
    rates=st.session_state.ship.get(ck)
    if not rates: return 0.0
    if w is None or w<=0: return 0.0
    for i in range(len(SHIP_BK)-1):
        if SHIP_BK[i]<=w<SHIP_BK[i+1]:
            return rates[i] if i<len(rates) else 0.0
    return rates[-1] if rates else 0.0

def calc(ck,fp,wt,sr):
    xl=fx_rate(ck);xc=usd_cny()
    if not xl or not xc: return None,"no_fx"
    fusd=fp*xl;aml=fusd*ML_CUT;s=ship_fee(ck,wt)
    net=aml-s;src=sr*xc+BUFFER;p=net-src;m=(p/net*100) if net>0 else 0
    h={"fusd":fusd,"mlf":round(fusd-fusd*ML_CUT,2),"aml":aml,"sf":s,"net":net,"src":src,"p":p,"m":m,"ok":p>0}
    # Reverse calc: target selling price for given sourcing + weight
    # net = target_src + target_profit  →  aml = net + ship  →  fusd = aml / 0.80  →  fp = fusd / xl
    if p>0 and sr>0:
        # What price gives X% profit?
        for tgt_pct in [10,15,20,25,30]:
            tgt_p=src*(tgt_pct/100.0)
            need_net=src+tgt_p
            need_aml=need_net+s
            need_fusd=need_aml/ML_CUT
            need_fp=need_fusd/xl
            h[f"rb_{tgt_pct}"]=round(need_fp)
    return h,None

def calc_all(fp,wt,sr):
    results={}
    for ck in CKS:
        r,err=calc(ck,fp,wt,sr)
        results[ck]=r if r else None
    return results

# ─── CSS (Linear-inspired) ─────────────────────
def css(t):
    d=t=="dark"
    if d:
        bg="#08090a";cb="rgba(255,255,255,0.02)";tc="#e8e8f0";sc="#8a8f98"
        bo="rgba(255,255,255,0.06)";ib="rgba(255,255,255,0.03)";hb="rgba(255,255,255,0.02)";sb="rgba(0,0,0,0.95)"
        ac="#FFE600";gr="#10b981";rd="#fb7185";bd="rgba(255,255,255,0.04)"
    else:
        bg="#f5f5f0";cb="rgba(255,255,255,0.9)";tc="#1a1a2e";sc="#62666d"
        bo="rgba(0,0,0,0.06)";ib="rgba(0,0,0,0.03)";hb="rgba(255,255,255,0.9)";sb="rgba(255,255,255,0.95)"
        ac="#e6c200";gr="#059669";rd="#dc2626";bd="rgba(0,0,0,0.04)"
    fn="'Inter','system-ui','-apple-system','Segoe UI',sans-serif"
    return f"""<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    *{{font-family:{fn};font-feature-settings:'cv01','ss03'}}
    .stApp{{background:{bg};color:{tc};}}
    #MainMenu,header,footer,.stDeployButton,.viewerBadge{{display:none!important}}
    ::-webkit-scrollbar{{width:4px}}::-webkit-scrollbar-track{{background:{bg}}}::-webkit-scrollbar-thumb{{background:{'#333' if d else '#bbb'};border-radius:2px}}
    h1,h2,h3,h4,h5,h6{{letter-spacing:-0.02em;font-weight:500}}
    .hd{{background:{hb};border-bottom:1px solid {bo};padding:0.6rem 0 0.3rem;margin-bottom:0.6rem;letter-spacing:-0.02em}}
    .hd h1{{font-size:1.25rem;font-weight:600;color:{ac};margin:0}}
    .hd .s{{font-size:0.7rem;color:{sc};margin-top:1px}}
    .card{{background:{cb};border:1px solid {bo};border-radius:8px;padding:0.7rem 0.9rem;margin-bottom:0.6rem}}
    .card:hover{{background:{ib};border-color:{bd}}}
    .ct{{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.06em;color:{sc};margin-bottom:0.4rem;font-weight:500}}
    .m{{background:{cb};border:1px solid {bd};border-radius:6px;padding:0.4rem 0.5rem;text-align:center}}
    .m .l{{font-size:0.55rem;color:{sc};margin-bottom:0.1rem;text-transform:uppercase;letter-spacing:0.04em}}
    .m .v{{font-size:1rem;font-weight:600}}
    .tbl{{width:100%;border-collapse:separate;border-spacing:0;border-radius:6px;overflow:hidden;border:1px solid {bo};font-size:0.7rem}}
    .tbl th{{background:{ib};color:{sc};font-size:0.6rem;padding:0.3rem 0.5rem;font-weight:500;border-bottom:1px solid {bo};letter-spacing:0.03em}}
    .tbl td{{padding:0.3rem 0.5rem;border-bottom:1px solid {bd};color:{sc}}}
    .fx{{display:flex;gap:0.3rem;flex-wrap:wrap}}
    .fx span{{font-size:0.63rem;color:{sc};padding:0.1rem 0.4rem;border-radius:4px;background:{ib};border:1px solid {bd}}}
    .gd{{height:1px;background:linear-gradient(90deg,transparent,rgba(255,230,0,0.15),transparent);margin:0.3rem 0}}
    div[data-testid="stTextInput"] input,div[data-testid="stNumberInput"] input{{background:{ib}!important;border:1px solid {bo}!important;border-radius:6px!important;color:{tc}!important;font-size:0.8rem!important}}
    div[data-testid="stTextInput"] input:focus,div[data-testid="stNumberInput"] input:focus{{border-color:{ac}!important;box-shadow:0 0 0 1px {ac}33!important}}
    div[data-testid="stSelectbox"] div[data-baseweb="select"]{{background:{ib}!important;border:1px solid {bo}!important;border-radius:6px!important}}
    .stButton button{{background:linear-gradient(135deg,{ac},{ac}dd)!important;color:#08090a!important;font-weight:600!important;border:none!important;border-radius:6px!important;padding:0.2rem 0.8rem!important;font-size:0.72rem!important;letter-spacing:-0.01em}}
    .stButton button:hover{{box-shadow:0 2px 12px rgba(255,230,0,0.2)!important;transform:translateY(-0.5px);transition:all 0.15s}}
    .stChatInput{{border:1px solid {bo}!important;border-radius:8px!important;font-size:0.8rem!important}}
    .stChatInput:focus-within{{border-color:{ac}!important;box-shadow:0 0 0 1px {ac}22!important}}
    .sb{{position:fixed;bottom:0;left:0;right:0;background:{sb};backdrop-filter:blur(12px);border-top:1px solid {bo};padding:0.2rem 1.5rem;display:flex;justify-content:space-between;font-size:0.58rem;color:{sc};z-index:100}}
    .stTabs [data-baseweb="tab-list"]{{gap:0;background:{ib};border-radius:6px;border:1px solid {bo};padding:2px}}
    .stTabs [data-baseweb="tab"]{{font-size:0.7rem;font-weight:500;color:{sc};padding:0.2rem 0.6rem;border-radius:4px}}
    .stTabs [aria-selected="true"]{{background:{cb}!important;color:{ac}!important}}
    div[data-testid="stRadio"] label{{font-size:0.72rem!important;color:{sc}!important}}
    .pr{{font-size:0.82rem;color:{tc};line-height:1.6}}
    .pr .g{{color:{gr};font-weight:600}}
    .pr .r{{color:{rd};font-weight:600}}
    .pr .y{{color:{ac};font-weight:600}}
    .btd{{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px}}
    .btd button{{font-size:0.65rem!important;padding:0.15rem 0.5rem!important}}
    </style>"""

def country_btns():
    ck=st.session_state.get("_ck","MX")
    cos=st.columns(6)
    for i,k in enumerate(CKS):
        with cos[i]:
            ci=COUNTRIES[k]
            if st.button(f"{ci['flag']} {ci['name']}",key=f"ck_{k}",use_container_width=True,
                        type="primary" if ck==k else "secondary"):
                st.session_state["_ck"]=k;st.rerun()
    return st.session_state.get("_ck","MX")

# ─── Calculator ─────────────────────────────
def render_calc():
    ck=country_btns();ci=COUNTRIES[ck]
    scs="#8a8f98" if st.session_state.theme=="dark" else "#62666d"
    r=st.session_state.exrates;curr=ci["currency"];fx_ok=r and curr in r and r[curr]>0
    rates=st.session_state.ship.get(ck)
    if not rates: rates=[0]*6

    st.markdown(f'<div class="card">',unsafe_allow_html=True)
    st.markdown(f'<div class="ct">🧮 {ci["flag"]} {ci["name"]} · 核价</div>',unsafe_allow_html=True)
    if not fx_ok: st.warning("⚠️ 汇率未加载，点刷新",icon="💱")
    else: st.caption(f"💱 1 USD = {r[curr]:,.2f} {curr} · CNY {r.get('CNY',0):,.4f}")

    # Mode switch
    cm1,cm2=st.columns([1,3])
    with cm1:
        mode_map={"标准":"normal","反向":"reverse","对比":"compare"}
        cur_mode=st.session_state.get("mode","normal")
        cur_label=[k for k,v in mode_map.items() if v==cur_mode][0]
        m=st.radio("模式",["标准","反向","对比"],horizontal=True,label_visibility="collapsed",
                   index=["标准","反向","对比"].index(cur_label),key="mode_sel")
        st.session_state.mode=mode_map.get(m,"normal")

    if m=="标准":
        c1,c2=st.columns(2)
        with c1:
            fp=st.number_input(f"售价 ({ci['symbol']})",0.0,value=0.0,step=100.0,format="%.2f",key=f"fp_{ck}")
            wt=st.number_input("📦重量(kg)",0.0,30.0,value=0.3,step=0.1,format="%.2f",key=f"wt_{ck}")
        with c2:
            sr=st.number_input("🏭货源价 ¥",0.0,value=0.0,step=10.0,format="%.2f",key=f"sr_{ck}")
            # Auto-fill last scrape
        cb1,cb2=st.columns([1,1])
        with cb1:
            if st.button("🚀 计算",type="primary",use_container_width=True,key="cm"):
                if fp<=0 or sr<=0 or wt<=0: st.info("请填全数据")
                elif not fx_ok: st.error("❌ 汇率未加载")
                else:
                    res,err=calc(ck,fp,wt,sr)
                    if err: st.error("❌ 汇率异常")
                    else: show_res(res,ci,ck)

    elif m=="反向":
        st.caption("💡 输入数据，反推需要卖多少钱")
        c1,c2=st.columns(2)
        with c1:
            wt2=st.number_input("📦重量(kg)",0.0,30.0,value=0.3,step=0.1,format="%.2f",key=f"rw_{ck}")
        with c2:
            sr2=st.number_input("🏭货源价 ¥",0.0,value=0.0,step=10.0,format="%.2f",key=f"rs_{ck}")
        tgts=st.slider("🎯 目标利润率",5,50,20,5,key=f"rt_{ck}",format="%d%%")
        tgt_profit_usd=st.number_input("💵 净利润(USD)",0.0,1000.0,value=0.0,step=1.0,format="%.2f",key=f"rp_{ck}")
        cb1,cb2=st.columns(2)
        with cb1:
            if st.button("📊 反向定价",type="primary",use_container_width=True,key="rev_calc"):
                if sr2<=0 or wt2<=0: st.info("请填全数据")
                elif not fx_ok: st.error("❌ 汇率未加载")
                else:
                    xl=fx_rate(ck);xc=usd_cny()
                    need_net=sr2*xc+BUFFER+(sr2*xc)*(tgts/100.0)
                    need_aml=need_net+ship_fee(ck,wt2)
                    need_fusd=need_aml/ML_CUT
                    need_fp=need_fusd/xl
                    st.markdown(f'<div class="pr">🎯 目标 <b>{tgts}%</b> 利润 → 需售价 <span class="y"><b>{ci["symbol"]}{need_fp:,.0f}</b></span><br>'
                               f'📊 相当于 USD ${need_fusd:.2f} | 到账 ${need_net:.2f} | 运费 ${ship_fee(ck,wt2):.2f}</div>',
                               unsafe_allow_html=True)
        with cb2:
            if st.button("📊 反向(按利润)",type="primary",use_container_width=True,key="rev_profit_calc"):
                if sr2<=0 or wt2<=0: st.info("请填全数据")
                elif not fx_ok: st.error("❌ 汇率未加载")
                elif tgt_profit_usd<=0: st.info("请输入净利润(USD)")
                else:
                    xl=fx_rate(ck);xc=usd_cny()
                    src_usd=sr2*xc+BUFFER
                    need_net=src_usd+tgt_profit_usd
                    need_aml=need_net+ship_fee(ck,wt2)
                    need_fusd=need_aml/ML_CUT
                    need_fp=need_fusd/xl
                    st.markdown(f'<div class="pr">🎯 目标净利润 <b>${tgt_profit_usd:.2f}</b> USD → 需售价 <span class="y"><b>{ci["symbol"]}{need_fp:,.0f}</b></span><br>'
                               f'📊 相当于 USD ${need_fusd:.2f} | 到账 ${need_net:.2f} | 运费 ${ship_fee(ck,wt2):.2f} | 货源(含缓冲) ${src_usd:.2f}</div>',
                               unsafe_allow_html=True)

    else:  # compare
        st.caption("💡 输入统一数据，对比6站点利润")
        c1,c2=st.columns(2)
        with c1:
            fp3=st.number_input("售价(USD)",0.0,value=0.0,step=50.0,format="%.2f",key="cfp")
            wt3=st.number_input("📦重量(kg)",0.0,30.0,value=0.3,step=0.1,format="%.2f",key="cwt")
        with c2:
            sr3=st.number_input("🏭货源价 ¥",0.0,value=0.0,step=10.0,format="%.2f",key="csr")
        if st.button("🌍 全站对比",type="primary",use_container_width=True,key="cc"):
            if fp3<=0 or sr3<=0 or wt3<=0: st.info("请填全数据")
            else:
                xc=usd_cny()
                if not xc: st.error("汇率未加载"); return
                html='<table class="tbl"><tr><th>站点</th><th>佣金(USD)</th><th>运费(USD)</th><th>利润(USD)</th><th>利润率</th><th>结论</th></tr>'
                for k in CKS:
                    xl=fx_rate(k)
                    if not xl: continue
                    s=ship_fee(k,wt3)
                    net=fp3*(1-0.20)-s;src=sr3*xc+BUFFER;p=net-src;m=(p/net*100) if net>0 else 0
                    ok="✅" if p>0 else "❌"
                    cl="g" if p>0 else "r"
                    html+=f'<tr><td>{COUNTRIES[k]["flag"]}</td><td>${fp3*0.20:.2f}</td><td>${s:.2f}</td><td class="{cl}">${p:.2f}</td><td class="{cl}">{m:+.1f}%</td><td>{ok}</td></tr>'
                html+="</table>"
                st.markdown(html,unsafe_allow_html=True)
                best=max([(calc(k,fp3,wt3,sr3)[0],k) for k in CKS],key=lambda x:x[0]["p"] if x[0] else -999)
                st.success(f"🏆 最佳站点: {COUNTRIES[best[1]]['flag']} {COUNTRIES[best[1]]['name']}  利润 ${best[0]['p']:.2f}")

    # Shipping table
    with st.expander(f"🚚 {ci['flag']} 运费表"):
        ship='<table class="tbl"><tr><th>重量</th>'
        for lbl in BK_LBL: ship+=f"<th>{lbl}</th>"
        ship+="</tr><tr><td>运费(USD)</td>"
        for i,v in enumerate(rates):
            ship+=f'<td>${v:.2f}</td>' if i<len(rates) else "<td>-</td>"
        ship+="</tr></table>"
        st.markdown(ship,unsafe_allow_html=True)
    st.markdown('</div>',unsafe_allow_html=True)

def show_res(r,ci,ck):
    st.markdown('<div class="gd"></div>',unsafe_allow_html=True)
    cl="g" if r["ok"] else "r"
    c1,c2,c3,c4,c5=st.columns(5)
    with c1: st.markdown(f'<div class="m"><div class="l">净收入(USD)</div><div class="v">${r["net"]:.2f}</div></div>',unsafe_allow_html=True)
    with c2: st.markdown(f'<div class="m"><div class="l">运费(USD)</div><div class="v">${r["sf"]:.2f}</div></div>',unsafe_allow_html=True)
    with c3: st.markdown(f'<div class="m"><div class="l">💰 利润</div><div class="v" style="color:{"#10b981" if r["ok"] else "#fb7185"}">${r["p"]:.2f}</div></div>',unsafe_allow_html=True)
    with c4: st.markdown(f'<div class="m"><div class="l">利润率</div><div class="v" style="color:{"#10b981" if r["ok"] else "#fb7185"}">{r["m"]:+.1f}%</div></div>',unsafe_allow_html=True)
    with c5: st.markdown(f'<div class="m"><div class="l">结论</div><div class="v" style="font-size:0.85rem;color:{"#10b981" if r["ok"] else "#fb7185"}">{"✅可做" if r["ok"] else "❌不可做"}</div></div>',unsafe_allow_html=True)

    # Reverse price hints
    rp_hints=[]
    for pct in [10,15,20,25,30]:
        k=f"rb_{pct}"
        if k in r:
            rp_hints.append(f'{pct}%利→{ci["symbol"]}{r[k]:,.0f}')
    if rp_hints:
        st.caption("🎯 反向定价参考: " + " | ".join(rp_hints))

    with st.expander("📋 详细分解",expanded=True):
        st.markdown(f'<div class="pr">'
                   f'💵 售价 {ci["symbol"]}${r["fusd"]/fx_rate(ck):,.2f} → USD ${r["fusd"]:.2f}<br>'
                   f'📉 ML佣金(20%): ${r["mlf"]:.2f} | 运费: ${r["sf"]:.2f}<br>'
                   f'📥 到账: ${r["net"]:.2f} | 货源(含缓冲): ${r["src"]:.2f}<br>'
                   f'{"✅" if r["ok"] else "❌"} <span class="{"g" if r["ok"] else "r"}">利润 ${r["p"]:.2f} · 利润率 {r["m"]:+.1f}%</span>'
                   f'</div>',unsafe_allow_html=True)

    st.session_state.hist.append({
        "time":datetime.now().strftime("%H:%M"),"country":ck,
        "front":r["fusd"]/fx_rate(ck),"sourcing":(r["src"]-0.5)/usd_cny(),
        "profit":r["p"],"margin":r["m"],"ok":r["ok"]
    })

def render_hist():
    if not st.session_state.hist: return
    st.markdown('<div class="card"><div class="ct">📋 本场记录</div>',unsafe_allow_html=True)
    h='<table class="tbl"><tr><th>时间</th><th>站</th><th>售价</th><th>货源</th><th>利润</th><th>%</th><th>结论</th></tr>'
    for e in st.session_state.hist[-10:]:
        f=COUNTRIES[e["country"]]["flag"];cl="g" if e["ok"] else "r"
        h+=f'<tr><td>{e["time"]}</td><td>{f}</td><td>${e["front"]:.2f}</td><td>¥{e["sourcing"]:.0f}</td><td class="{cl}">${e["profit"]:.2f}</td><td class="{cl}">{e["margin"]:+.1f}%</td><td>{"✅" if e["ok"] else "❌"}</td></tr>'
    h+="</table>"
    h+=f'<div style="font-size:0.6rem;color:{scs()};margin-top:4px">共 {len(st.session_state.hist)} 次计算</div>'
    st.markdown(h,unsafe_allow_html=True)
    if st.button("🗑️ 清除记录",key="clr_hist"):
        st.session_state.hist=[]
        st.rerun()
    st.markdown('</div>',unsafe_allow_html=True)

def scs():
    return "#8a8f98" if st.session_state.theme=="dark" else "#62666d"

def render_chat():
    sc="#8a8f98" if st.session_state.theme=="dark" else "#62666d"
    st.markdown('<div class="card">',unsafe_allow_html=True)
    st.markdown('<div class="ct">💬 AI助手</div>',unsafe_allow_html=True)
    key_set=bool(st.session_state.api_key)
    if not key_set:
        st.caption("⚠️ 去⚙️设置填入API密钥启用AI聊天")

    for m in st.session_state.chat[-10:]:
        u=m["role"]=="user"
        st.markdown(f'<div style="background:{"rgba(255,230,0,0.08)" if u else "rgba(255,255,255,0.03)"};border:1px solid {"rgba(255,230,0,0.12)" if u else "rgba(255,255,255,0.06)"};border-radius:{"10px 10px 3px 10px" if u else "10px 10px 10px 3px"};padding:0.35rem 0.6rem;margin:0.12rem 0;max-width:92%;{"margin-left:auto" if u else ""};color:{"#e8e8f0" if u else sc};font-size:0.78rem;white-space:pre-wrap;">{m["text"]}</div>',unsafe_allow_html=True)

    if p:=st.chat_input("输入问题..." if key_set else "先配置API密钥..."):
        st.session_state.chat.append({"role":"user","text":p})
        if key_set:
            with st.spinner("🤔"):
                reply=ai_chat(st.session_state.chat)
        else:
            reply="⚠️ 请在⚙️设置中填入API密钥后使用AI聊天"
        st.session_state.chat.append({"role":"ai","text":reply})
        st.rerun()
    st.markdown('</div>',unsafe_allow_html=True)

def ai_chat(messages):
    key=st.session_state.api_key
    if not key: return "⚠️ 未配置API密钥"
    url=st.session_state.api_url
    model=st.session_state.api_model
    try:
        msgs=[{"role":"system","content":"你是Hermes跨境核价助手，帮助用户计算Mercado Libre跨境利润。回答简洁专业。"}]
        for m in messages[-10:]:
            role="assistant" if m["role"]=="ai" else "user"
            msgs.append({"role":role,"content":m["text"]})
        r=requests.post(url,json={"model":model,"messages":msgs,"max_tokens":512},
                       headers={"Authorization":f"Bearer {key}","Content-Type":"application/json"},timeout=15)
        data=r.json()
        if "choices" in data: return data["choices"][0]["message"]["content"]
        elif "error" in data: return f"❌ API错误: {data['error'].get('message','未知')}"
        return f"❌ 响应异常: {str(data)[:200]}"
    except Exception as e:
        return f"❌ 请求失败: {str(e)}"

def render_settings():
    with st.expander("⚙️ 设置"):
        st.markdown("**🤖 AI聊天配置**")
        ak=st.text_input("API密钥",type="password",value=st.session_state.api_key,key="ak_set",placeholder="sk-xxx...")
        am=st.text_input("模型名",value=st.session_state.api_model,key="am_set",help="deepseek-chat / gpt-4o-mini")
        au=st.text_input("API地址",value=st.session_state.api_url,key="au_set")
        if st.button("💾 保存AI配置",use_container_width=True,key="save_ai"):
            st.session_state.api_key=ak;st.session_state.api_model=am;st.session_state.api_url=au
            st.success("✅ 已保存");st.rerun()
        st.markdown("---")
        st.markdown("**🚚 运费表 (USD/件)**")
        for ck in CKS:
            ci=COUNTRIES[ck];st.markdown(f"**{ci['flag']} {ci['name']}**")
            cur=st.session_state.ship.get(ck,[0]*len(BK_LBL))
            cos=st.columns(len(BK_LBL));nv=[]
            for i,lbl in enumerate(BK_LBL):
                with cos[i]: nv.append(st.number_input(lbl,value=float(cur[i]) if i<len(cur) else 0,step=0.5,format="%.2f",key=f"s_{ck}_{i}",label_visibility="collapsed"))
            st.session_state.ship[ck]=nv
        st.markdown("---")
        st.markdown("**💱 汇率**")
        r=st.session_state.exrates
        if r and "fetched" in r:
            cos=st.columns(4)
            for i,c in enumerate(["MXN","BRL","COP"]): cos[i].caption(f"{c}: {r.get(c,0):,.2f}")
            for i,c in enumerate(["CLP","ARS","UYU"]): cos[i+1].caption(f"{c}: {r.get(c,0):,.2f}")
            st.caption(f"CNY: {r.get('CNY',0):,.4f} · {r['fetched']}")
        if st.button("🔄 刷新汇率",use_container_width=True,key="rs"):
            with st.spinner("获取中..."):
                nr=fetch_rates()
                if nr: st.session_state.exrates=nr;st.rerun()
                else: st.error("汇率API请求失败")

def login_page():
    t=st.session_state.theme
    bg="#08090a" if t=="dark" else "#f5f5f0"
    cd="rgba(255,255,255,0.03)" if t=="dark" else "rgba(255,255,255,0.9)";sc="#8a8f98" if t=="dark" else "#62666d"
    bo="rgba(255,255,255,0.06)" if t=="dark" else "rgba(0,0,0,0.06)"
    ib="rgba(255,255,255,0.03)" if t=="dark" else "rgba(0,0,0,0.03)";tc="#e8e8f0" if t=="dark" else "#1a1a2e"
    _,c2,_=st.columns([6,0.5,0.01])
    with c2:
        if st.button("🌙" if t=="dark" else "☀️",key="lt"):
            st.session_state.theme="light" if t=="dark" else "dark";st.rerun()
    st.markdown(f"""
    <style>.lw{{min-height:90vh;display:flex;align-items:center;justify-content:center;background:{bg};}}
    .lb{{background:{cd};backdrop-filter:blur(12px);border:1px solid {bo};border-radius:12px;padding:2rem 2.5rem;width:360px;text-align:center;}}
    .lb h1{{color:#FFE600;font-size:1.4rem;margin-bottom:0.2rem;font-weight:600;letter-spacing:-0.02em}}
    .lb .s{{color:{sc};font-size:0.75rem;margin-bottom:1.2rem}}
    .lb input{{width:100%;padding:0.55rem 0.7rem;border-radius:6px;border:1px solid {bo};background:{ib};color:{tc};font-size:0.9rem;margin-bottom:0.7rem;outline:none;box-sizing:border-box;}}
    .lb input:focus{{border-color:#FFE600;box-shadow:0 0 0 1px rgba(255,230,0,0.2);}}</style>
    <div class="lw"><div class="lb"><h1>🔐 Hermes</h1><div class="s">1688 → Mercado Libre</div></div></div>""",unsafe_allow_html=True)
    pwd=st.text_input("",type="password",placeholder="输入密码",key="lp",label_visibility="collapsed")
    if st.button("🔓 登录",type="primary",use_container_width=True,key="lb"):
        if not pwd: st.error("请输入密码")
        elif pwd.strip()!=st.session_state.master_pwd: st.error("❌ 密码错误")
        else: st.session_state.logged_in=True;st.rerun()

# ─── Main ─────────────────────────────────────
def main_app():
    t=st.session_state.theme
    st.markdown(css(t),unsafe_allow_html=True)
    if not st.session_state.exrates or "fetched" not in st.session_state.exrates:
        with st.spinner("🌐 获取汇率..."):
            nr=fetch_rates()
            if nr: st.session_state.exrates=nr
    r=st.session_state.exrates;sc="#8a8f98" if t=="dark" else "#62666d"
    ch,ct,cc=st.columns([2.5,0.6,0.3])
    with ch:
        st.markdown(f'<div class="hd"><h1>🛒 Hermes 跨境核价</h1><div class="s">1688 → ML · 菜鸟运费 · 反向定价 · 多站对比</div></div>',unsafe_allow_html=True)
    with ct:
        if r and "fetched" in r:
            st.markdown(f'<div style="font-size:0.6rem;color:{sc};text-align:right;">💱 {r["fetched"]}<br><span class="bd" style="display:inline-block;background:rgba(255,230,0,0.1);border:1px solid rgba(255,230,0,0.2);border-radius:20px;padding:0.05rem 0.4rem;font-size:0.6rem;color:#FFE600;">实时</span></div>',unsafe_allow_html=True)
    with cc:
        if st.button("🌙" if t=="dark" else "☀️",key="tb"): st.session_state.theme="light" if t=="dark" else "dark";st.rerun()
    if r and "fetched" in r:
        its="".join(f'<span>{c} <b>{r.get(c,0):,.2f}</b></span>' for c in["MXN","BRL","COP","CLP","ARS","UYU"])
        its+=f'<span>CNY <b>{r.get("CNY",0):,.4f}</b></span>'
        st.markdown(f'<div class="fx">{its}</div>',unsafe_allow_html=True)
    lc,rc=st.columns([1,2.3])
    with lc: render_chat()
    with rc:
        render_calc()
        render_hist()
        render_settings()
    cnt=len(st.session_state.hist)
    ft=r.get("fetched","-") if r and "fetched" in r else "-"
    mode_icon = {"normal":"🧮","reverse":"📊","compare":"🌍"}.get(st.session_state.get("mode","normal"),"🧮")
    st.markdown(f'<div class="sb"><div>🟢 运行中</div><div>{mode_icon} {st.session_state.get("mode","标准")} | 💱 {ft} | {cnt} 次</div><div>v4.0</div></div>',unsafe_allow_html=True)
    st.markdown("<div style='height:2rem;'></div>",unsafe_allow_html=True)

if st.session_state.logged_in: main_app()
else: login_page()
