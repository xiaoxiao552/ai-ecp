# -*- coding: utf-8 -*-
"""
三项 AI 能力轻量实现（遵守成果包降级契约：所有 AI 响应携带 degraded / degradeReason）。
- 智能客服 (CustomerServiceCapability)：知识库 RAG-lite + 受控业务工具调用；未命中则降级。
- 智能选品 (ProductSelectionCapability)：画像/行为召回 → 业务规则过滤 → 冷启动兜底。
- 智能组货 (BundleCompositionCapability)：生成搭配理由，库存/价格/毛利由业务校验，四维不全则降级为单品。
说明：本地以规则+模板模拟大模型网关(ILlmGateway)与向量检索(IVectorRetriever)，可直接替换为生产模型服务。
"""
import datetime
import json
import secrets


def _products_public(conn, limit=8, category_id=None, exclude_ids=None):
    sql = ("SELECT p.product_id, p.title, p.main_image, p.category_id, c.name AS category_name, "
           "(SELECT MIN(sale_price) FROM t_sku s WHERE s.product_id=p.product_id AND s.status=1) AS min_price, "
           "(SELECT MAX(sale_price) FROM t_sku s WHERE s.product_id=p.product_id AND s.status=1) AS max_price, "
           "(SELECT COALESCE(SUM(total_qty-locked_qty),0) FROM t_inventory i JOIN t_sku s ON s.sku_id=i.sku_id "
           "WHERE s.product_id=p.product_id) AS available "
           "FROM t_product p LEFT JOIN t_category c ON c.category_id=p.category_id "
           "WHERE p.status=1")
    args = []
    if category_id:
        sql += " AND p.category_id=?"
        args.append(category_id)
    if exclude_ids:
        sql += " AND p.product_id NOT IN (%s)" % ",".join("?" * len(exclude_ids))
        args.extend(exclude_ids)
    sql += " ORDER BY p.product_id DESC LIMIT ?"
    args.append(limit)
    rows = conn.execute(sql, args).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# 智能客服
# ---------------------------------------------------------------------------
def chat(conn, user_id, message, session_id=None):
    message = (message or "").strip()
    if not session_id:
        session_id = "sess_" + secrets.token_hex(12)
        conn.execute("INSERT INTO t_conversation(session_id,user_id,channel,status,started_at) VALUES (?,?,?,1,?)",
                     (session_id, user_id, "web", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.execute("INSERT INTO t_message(session_id,role,content,created_at) VALUES (?,?,?,?)",
                 (session_id, "user", message, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

    # 1) 知识库检索（RAG-lite：关键词命中）
    chunks = conn.execute("SELECT * FROM t_knowledge_chunk WHERE status=1").fetchall()
    hit = None
    for ch in chunks:
        kws = [k.strip() for k in (ch["keywords"] or "").split(",") if k.strip()]
        if any(k in message for k in kws) or (ch["title"] and ch["title"] in message):
            hit = ch
            break

    # 2) 业务事实：受控工具调用（订单/物流状态）
    if ("订单" in message or "物流" in message or "发货" in message) and user_id:
        order = conn.execute(
            "SELECT o.order_no, o.status, o.paid_at FROM t_order o WHERE o.user_id=? "
            "ORDER BY o.created_at DESC LIMIT 1", (user_id,)).fetchone()
        if order:
            from db import STATUS_ORDER
            content = (f"您最近的订单 {order['order_no']} 当前状态为「{STATUS_ORDER.get(order['status'],'未知')}」。"
                       "如已支付，商家发货后可在「我的订单」查看运单号。")
            _save_assistant(conn, session_id, content, 0.95)
            return {"sessionId": session_id, "content": content, "confidence": 0.95,
                    "degraded": False, "degradeReason": "", "source": "tool:order_status"}

    if hit:
        _save_assistant(conn, session_id, hit["content"], 0.92)
        return {"sessionId": session_id, "content": hit["content"], "confidence": 0.92,
                "degraded": False, "degradeReason": "", "source": f"knowledge:{hit['chunk_id']}"}

    # 3) 降级：未命中知识库且无对应业务工具
    content = ("您好，我是智选云智能客服。当前为演示模式（未接入生产大模型），"
               "可为您解答订单/物流状态，或回答已录入知识库的问题。如需人工，请描述具体订单号。")
    _save_assistant(conn, session_id, content, 0.30)
    return {"sessionId": session_id, "content": content, "confidence": 0.30,
            "degraded": True, "degradeReason": "未命中知识库且无对应业务工具(演示降级)", "source": "fallback"}


def _save_assistant(conn, session_id, content, confidence):
    conn.execute("INSERT INTO t_message(session_id,role,content,confidence,created_at) VALUES (?,?,?,?,?)",
                 (session_id, "assistant", content, confidence, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()


# ---------------------------------------------------------------------------
# 智能选品
# ---------------------------------------------------------------------------
def recommend(conn, user_id, scene="home"):
    # 画像/行为召回
    pref_cats = []
    if user_id:
        prof = conn.execute("SELECT prefer_category_json FROM t_user_profile WHERE user_id=?", (user_id,)).fetchone()
        if prof and prof["prefer_category_json"]:
            try:
                pref_cats = json.loads(prof["prefer_category_json"]) or []
            except Exception:
                pref_cats = []
        beh = conn.execute(
            "SELECT DISTINCT s.product_id FROM t_user_behavior b JOIN t_sku s ON s.sku_id=b.sku_id "
            "WHERE b.user_id=? ORDER BY b.occur_time DESC LIMIT 20", (user_id,)).fetchall()
        if beh and not pref_cats:
            prod_ids = [r["product_id"] for r in beh]
            cats = conn.execute("SELECT DISTINCT category_id FROM t_product WHERE product_id IN (%s)" %
                                ",".join("?" * len(prod_ids)), prod_ids).fetchall()
            pref_cats = [c["category_id"] for c in cats]

    items = []
    if pref_cats:
        for cid in pref_cats:
            items += _products_public(conn, limit=4, category_id=cid)
    strategy = "profile_recall"
    if not items:
        items = _products_public(conn, limit=8)
        strategy = "cold_start_popular"   # 冷启动兜底

    trace_id = "trace_" + secrets.token_hex(10)
    conn.execute("INSERT INTO t_recommend_log(user_id,scene,strategy_code,items_json,trace_id) VALUES (?,?,?,?,?)",
                 (user_id, scene, strategy, json.dumps([i["product_id"] for i in items], ensure_ascii=False), trace_id))
    conn.commit()
    return {"scene": scene, "strategyCode": strategy, "items": items,
            "degraded": False, "degradeReason": ""}


# ---------------------------------------------------------------------------
# 智能组货
# ---------------------------------------------------------------------------
def compose_bundle(conn, product_id):
    main = conn.execute("SELECT * FROM t_product WHERE product_id=?", (product_id,)).fetchone()
    if not main:
        return {"degraded": True, "degradeReason": "主商品不存在", "items": []}
    # 召回候选：同商家其他在售商品作为搭配件
    candidates = conn.execute(
        "SELECT product_id, title FROM t_product WHERE merchant_id=? AND product_id!=? AND status=1 LIMIT 6",
        (main["merchant_id"], product_id)).fetchall()
    picks = []
    total_price = 0.0
    total_cost = 0.0
    for c in candidates[:2]:
        sku = conn.execute(
            "SELECT s.sku_id, s.sale_price, i.total_qty, i.locked_qty FROM t_sku s "
            "LEFT JOIN t_inventory i ON i.sku_id=s.sku_id WHERE s.product_id=? AND s.status=1 "
            "ORDER BY s.sale_price ASC LIMIT 1", (c["product_id"],)).fetchone()
        if not sku:
            continue
        avail = (sku["total_qty"] or 0) - (sku["locked_qty"] or 0)
        price = float(sku["sale_price"] or 0)
        # 业务校验：库存可售、价格为正
        if avail <= 0 or price <= 0:
            continue
        picks.append({"productId": c["product_id"], "title": c["title"], "skuId": sku["sku_id"],
                      "price": price, "available": avail})
        total_price += price
        total_cost += price * 0.7  # 演示毛利估算

    main_sku = conn.execute(
        "SELECT sku_id, sale_price FROM t_sku WHERE product_id=? AND status=1 ORDER BY sale_price ASC LIMIT 1",
        (product_id,)).fetchone()
    main_price = float(main_sku["sale_price"] or 0) if main_sku else 0
    main_avail = 0
    if main_sku:
        inv = conn.execute("SELECT total_qty, locked_qty FROM t_inventory WHERE sku_id=?", (main_sku["sku_id"],)).fetchone()
        main_avail = (inv["total_qty"] - inv["locked_qty"]) if inv else 0

    bundle_price = main_price + total_price
    gross_rate = ((bundle_price - (main_price * 0.7 + total_cost)) / bundle_price) if bundle_price > 0 else 0

    # 四维校验：主商品可售 / 有搭配件 / 价格为正 / 毛利为正
    valid = main_avail > 0 and picks and bundle_price > 0 and gross_rate > 0
    if valid:
        reason = (f"以「{main['title']}」为主商品，搭配 {len(picks)} 件高关联配件，"
                  f"组合价 ¥{bundle_price:.2f}，预估毛利率 {gross_rate*100:.1f}%，"
                  f"库存与履约均满足，可提升客单价与连带率。")
        bid = conn.execute(
            "INSERT INTO t_bundle(main_product_id,scene_tag,bundle_price,gross_rate,strategy_code,reason) "
            "VALUES (?,?,?,?,?,?)",
            (product_id, "upsell", bundle_price, gross_rate, "llm_reason+rule_check", reason)).lastrowid
        for p in picks:
            conn.execute("INSERT INTO t_bundle_item(bundle_id,sku_id,role,quantity) VALUES (?,?,?,1)",
                         (bid, p["skuId"], "addon"))
        conn.commit()
        return {"degraded": False, "degradeReason": "", "strategyCode": "bundle_ok",
                "bundle": {"bundleId": bid, "mainProductId": product_id, "price": bundle_price,
                           "grossRate": round(gross_rate, 4), "reason": reason,
                           "items": [{"title": main["title"], "skuId": main_sku["sku_id"], "price": main_price, "role": "main"}] + picks}}
    # 降级：四维不全成立 → 单品推荐
    return {"degraded": True, "degradeReason": "库存/价格/毛利四维未同时成立，降级为单品推荐",
            "strategyCode": "single_fallback",
            "items": _products_public(conn, limit=4, exclude_ids=[product_id])}
