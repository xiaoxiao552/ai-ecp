# -*- coding: utf-8 -*-
"""
智选云 AI 电商在线售货系统 (AI-ECP) —— 后端服务入口
技术：Flask + 标准库 sqlite3（数据存储方案：SQLite 文件库，零外部依赖，可随站运行）。
接口遵循成果包 图 4-2(服务类图) / 图 4-10(下单支付时序) / 图 4-7(订单状态机)。
启动：python app.py  ->  http://127.0.0.1:5000
"""
import os
import json
import functools
import datetime
import secrets

from flask import Flask, request, jsonify, g, send_from_directory, Response
import db
import category_engine
import ai
import product_images

app = Flask(__name__, static_folder=None)
app.config["SECRET_KEY"] = "ai-ecp-dev-key"

BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")


# ----------------------------------------------------------------------------
# 鉴权
# ----------------------------------------------------------------------------
def get_token():
    h = request.headers.get("Authorization", "")
    if h.startswith("Bearer "):
        return h[7:]
    return None


@app.before_request
def load_user():
    g.user = None
    token = get_token()
    if token:
        conn = db.get_conn()
        try:
            g.user = db.user_by_token(conn, token)
        finally:
            conn.close()


def login_required(roles=None):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if not g.user:
                return jsonify({"error": "未登录或登录已过期"}), 401
            if roles and g.user["role"] not in roles:
                return jsonify({"error": "无权限执行该操作"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def public_product_view(conn, product_id):
    p = conn.execute("SELECT p.*, c.name AS category_name FROM t_product p "
                    "LEFT JOIN t_category c ON c.category_id=p.category_id WHERE p.product_id=?",
                    (product_id,)).fetchone()
    if not p:
        return None
    d = dict(p)
    skus = conn.execute("SELECT s.*, "
                        "(SELECT COALESCE(total_qty-locked_qty,0) FROM t_inventory i WHERE i.sku_id=s.sku_id) AS available "
                        "FROM t_sku s WHERE s.product_id=? ORDER BY s.sku_id", (product_id,)).fetchall()
    d["skus"] = [dict(s) for s in skus]
    # 属性值
    for s in d["skus"]:
        vals = conn.execute("SELECT v.attr_id, v.attr_value, a.attr_name, a.attr_code FROM t_sku_attr_value v "
                            "JOIN t_category_attr a ON a.attr_id=v.attr_id WHERE v.sku_id=?", (s["sku_id"],)).fetchall()
        s["attrValues"] = [dict(v) for v in vals]
    return d


# ----------------------------------------------------------------------------
# 静态前端
# ----------------------------------------------------------------------------
@app.route("/")
@app.route("/<path:path>")
def serve_frontend(path=""):
    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(full):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/img/product/<int:pid>")
def product_image(pid):
    """动态生成商品占位图（SVG），零外部依赖；后台新发布商品亦可获得图片。"""
    conn = db.get_conn()
    try:
        p = conn.execute(
            "SELECT p.title, c.name AS category_name FROM t_product p "
            "LEFT JOIN t_category c ON c.category_id=p.category_id WHERE p.product_id=?",
            (pid,)).fetchone()
    finally:
        conn.close()
    title = p["title"] if p else "商品"
    cat = p["category_name"] if p else "商品"
    svg = product_images.build_svg(pid, title, cat)
    return Response(svg, mimetype="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


# ----------------------------------------------------------------------------
# 鉴权接口
# ----------------------------------------------------------------------------
@app.post("/api/auth/register")
def register():
    data = request.get_json(force=True, silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    password = data.get("password") or ""
    nickname = (data.get("nickname") or "").strip() or mobile
    role = data.get("role", "consumer")
    if role not in ("consumer", "merchant", "admin"):
        role = "consumer"
    if len(mobile) < 6 or len(password) < 6:
        return jsonify({"error": "手机号与密码均至少 6 位"}), 400
    conn = db.get_conn()
    try:
        if conn.execute("SELECT 1 FROM t_user WHERE mobile=?", (mobile,)).fetchone():
            return jsonify({"error": "该手机号已注册"}), 409
        h = db.hash_password(password)
        uid = conn.execute(
            "INSERT INTO t_user(nickname,mobile,password_hash,role,member_level,created_at) VALUES (?,?,?,?,1,?)",
            (nickname, mobile, h, role, db.now())).lastrowid
        conn.execute("INSERT INTO t_user_profile(user_id,prefer_category_json,activity_score,updated_at) VALUES (?,?,0,?)",
                     (uid, json.dumps([], ensure_ascii=False), db.now()))
        token = db.create_session(conn, uid)
        user = db.get_user(conn, uid)
        return jsonify({"token": token, "user": _user_out(user)}), 201
    finally:
        conn.close()


@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    password = data.get("password") or ""
    conn = db.get_conn()
    try:
        user = conn.execute("SELECT * FROM t_user WHERE mobile=?", (mobile,)).fetchone()
        if not user or not db.verify_password(password, user["password_hash"]):
            return jsonify({"error": "手机号或密码错误"}), 401
        token = db.create_session(conn, user["user_id"])
        return jsonify({"token": token, "user": _user_out(user)})
    finally:
        conn.close()


@app.get("/api/auth/me")
@login_required()
def me():
    return jsonify({"user": _user_out(g.user)})


def _user_out(u):
    return {"userId": u["user_id"], "nickname": u["nickname"], "mobile": u["mobile"],
            "role": u["role"], "memberLevel": u["member_level"]}


# ----------------------------------------------------------------------------
# 品类（JSON 自定义）接口
# ----------------------------------------------------------------------------
@app.get("/api/categories")
def categories():
    conn = db.get_conn()
    try:
        return jsonify({"tree": category_engine.get_category_tree(conn)})
    finally:
        conn.close()


@app.post("/api/categories/import")
@login_required(roles=("merchant", "admin"))
def import_categories():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("json") or ""
    conn = db.get_conn()
    try:
        try:
            result = category_engine.import_category(conn, text, g.user["user_id"])
        except SyntaxError as e:
            return jsonify({"error": "JSON 语法错误", "detail": str(e)}), 400
        except ValueError as e:
            payload = e.args[0]
            return jsonify({"error": "品类结构校验未通过", "stage": payload.get("stage"),
                            "details": payload.get("errors")}), 422
        return jsonify({"message": "品类导入成功", **result}), 201
    finally:
        conn.close()


@app.get("/api/categories/<int:cid>/form")
def category_form(cid):
    conn = db.get_conn()
    try:
        form = category_engine.preview_form(conn, cid)
        if not form["fields"] and not form["categoryName"]:
            return jsonify({"error": "品类不存在"}), 404
        return jsonify(form)
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# 商品接口
# ----------------------------------------------------------------------------
@app.get("/api/products")
def list_products():
    keyword = (request.args.get("keyword") or "").strip()
    category_id = request.args.get("categoryId", type=int)
    min_price = request.args.get("minPrice", type=float)
    max_price = request.args.get("maxPrice", type=float)
    sort = request.args.get("sort", "new")
    conn = db.get_conn()
    try:
        sql = ("SELECT p.product_id, p.title, p.main_image, p.category_id, c.name AS category_name, "
               "(SELECT MIN(sale_price) FROM t_sku s WHERE s.product_id=p.product_id AND s.status=1) AS min_price, "
               "(SELECT MAX(sale_price) FROM t_sku s WHERE s.product_id=p.product_id AND s.status=1) AS max_price, "
               "(SELECT COALESCE(SUM(total_qty-locked_qty),0) FROM t_inventory i JOIN t_sku s ON s.sku_id=i.sku_id "
               "WHERE s.product_id=p.product_id) AS available "
               "FROM t_product p LEFT JOIN t_category c ON c.category_id=p.category_id WHERE p.status=1")
        args = []
        if keyword:
            sql += " AND (p.title LIKE ? OR p.product_id IN (SELECT product_id FROM t_sku WHERE spec_text LIKE ?))"
            args += [f"%{keyword}%", f"%{keyword}%"]
        if category_id:
            sql += " AND p.category_id=?"
            args.append(category_id)
        if min_price is not None:
            sql += " AND (SELECT MIN(sale_price) FROM t_sku s WHERE s.product_id=p.product_id AND s.status=1) >= ?"
            args.append(min_price)
        if max_price is not None:
            sql += " AND (SELECT MIN(sale_price) FROM t_sku s WHERE s.product_id=p.product_id AND s.status=1) <= ?"
            args.append(max_price)
        sql += " ORDER BY " + ("p.product_id DESC" if sort == "new" else "min_price ASC" if sort == "price_asc" else "min_price DESC")
        rows = conn.execute(sql, args).fetchall()
        return jsonify({"items": [dict(r) for r in rows]})
    finally:
        conn.close()


@app.get("/api/products/<int:pid>")
def product_detail(pid):
    conn = db.get_conn()
    try:
        d = public_product_view(conn, pid)
        if not d:
            return jsonify({"error": "商品不存在"}), 404
        # 智能组货预览（降级契约）
        bundle = ai.compose_bundle(conn, pid)
        return jsonify({"product": d, "bundle": bundle})
    finally:
        conn.close()


@app.post("/api/products")
@login_required(roles=("merchant", "admin"))
def create_product():
    data = request.get_json(force=True, silent=True) or {}
    title = (data.get("title") or "").strip()
    category_id = data.get("categoryId")
    skus = data.get("skus") or []
    if not title or not category_id or not skus:
        return jsonify({"error": "标题/品类/至少一个 SKU 为必填"}), 400
    conn = db.get_conn()
    try:
        pid = conn.execute("INSERT INTO t_product(merchant_id,category_id,title,main_image,status,created_at) VALUES (?,?,?,?,1,?)",
                           (g.user["user_id"], category_id, title, data.get("mainImage", ""), db.now())).lastrowid
        for sk in skus:
            sale = float(sk.get("salePrice", 0))
            market = float(sk.get("marketPrice") or sale)
            skid = conn.execute("INSERT INTO t_sku(product_id,spec_text,sale_price,market_price,status) VALUES (?,?,?,?,1)",
                                (pid, sk.get("specText", ""), sale, market)).lastrowid
            conn.execute("INSERT INTO t_inventory(sku_id,warehouse_id,total_qty,locked_qty,version) VALUES (?,1,?,0,0)",
                         (skid, int(sk.get("totalQty", 0))))
            for attr_code, val in (sk.get("attrValues") or {}).items():
                attr = conn.execute("SELECT attr_id FROM t_category_attr WHERE category_id=? AND attr_code=?",
                                    (category_id, attr_code)).fetchone()
                if attr:
                    conn.execute("INSERT INTO t_sku_attr_value(sku_id,attr_id,attr_value) VALUES (?,?,?)",
                                 (skid, attr["attr_id"], str(val)))
        conn.commit()
        return jsonify({"message": "商品发布成功", "productId": pid}), 201
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# 购物车
# ----------------------------------------------------------------------------
@app.get("/api/cart")
@login_required()
def get_cart():
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT ci.*, s.spec_text, s.sale_price, p.title, p.main_image, "
            "(SELECT COALESCE(total_qty-locked_qty,0) FROM t_inventory i WHERE i.sku_id=s.sku_id) AS available "
            "FROM t_cart_item ci JOIN t_sku s ON s.sku_id=ci.sku_id JOIN t_product p ON p.product_id=s.product_id "
            "WHERE ci.user_id=?", (g.user["user_id"],)).fetchall()
        items = [dict(r) for r in rows]
        total = sum(float(i["sale_price"]) * i["quantity"] for i in items)
        return jsonify({"items": items, "total": round(total, 2), "count": len(items)})
    finally:
        conn.close()


@app.post("/api/cart")
@login_required()
def add_cart():
    data = request.get_json(force=True, silent=True) or {}
    sku_id = data.get("skuId")
    qty = int(data.get("quantity", 1))
    if qty <= 0:
        return jsonify({"error": "数量不合法"}), 400
    conn = db.get_conn()
    try:
        exist = conn.execute("SELECT * FROM t_cart_item WHERE user_id=? AND sku_id=? AND source=?",
                             (g.user["user_id"], sku_id, data.get("source", "manual"))).fetchone()
        if exist:
            conn.execute("UPDATE t_cart_item SET quantity=quantity+? WHERE cart_item_id=?", (qty, exist["cart_item_id"]))
        else:
            conn.execute("INSERT INTO t_cart_item(user_id,sku_id,quantity,source) VALUES (?,?,?,?)",
                         (g.user["user_id"], sku_id, qty, data.get("source", "manual")))
        conn.commit()
        return jsonify({"message": "已加入购物车"})
    finally:
        conn.close()


@app.put("/api/cart/<int:item_id>")
@login_required()
def update_cart(item_id):
    data = request.get_json(force=True, silent=True) or {}
    qty = int(data.get("quantity", 1))
    conn = db.get_conn()
    try:
        conn.execute("UPDATE t_cart_item SET quantity=? WHERE cart_item_id=? AND user_id=?",
                     (max(qty, 1), item_id, g.user["user_id"]))
        conn.commit()
        return jsonify({"message": "已更新"})
    finally:
        conn.close()


@app.delete("/api/cart/<int:item_id>")
@login_required()
def del_cart(item_id):
    conn = db.get_conn()
    try:
        conn.execute("DELETE FROM t_cart_item WHERE cart_item_id=? AND user_id=?", (item_id, g.user["user_id"]))
        conn.commit()
        return jsonify({"message": "已删除"})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# 下单与支付（图 4-10 时序：createOrder -> lockStock -> 支付 -> 回调扣库存 -> 履约）
# ----------------------------------------------------------------------------
def available_of(conn, sku_id):
    row = conn.execute("SELECT total_qty, locked_qty FROM t_inventory WHERE sku_id=?", (sku_id,)).fetchone()
    if not row:
        return 0
    return (row["total_qty"] - row["locked_qty"])


@app.post("/api/orders")
@login_required()
def create_order():
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items") or []
    address = (data.get("address") or "").strip()
    if not items:
        return jsonify({"error": "购物车为空，无法下单"}), 400
    conn = db.get_conn()
    try:
        # 库存校验 + 锁定（事务内）
        lines = []
        total = 0.0
        for it in items:
            sku_id = it.get("skuId")
            qty = int(it.get("quantity", 1))
            sku = conn.execute("SELECT sku_id, sale_price, product_id, status FROM t_sku WHERE sku_id=?", (sku_id,)).fetchone()
            if not sku or sku["status"] != 1:
                conn.rollback()
                return jsonify({"error": f"SKU {sku_id} 不可用"}), 409
            avail = available_of(conn, sku_id)
            if avail < qty:
                conn.rollback()
                return jsonify({"error": f"商品库存不足（可用 {avail}，需 {qty}）", "skuId": sku_id}), 409
            conn.execute("UPDATE t_inventory SET locked_qty=locked_qty+? WHERE sku_id=?", (qty, sku_id))
            lines.append({"sku_id": sku_id, "qty": qty, "price": float(sku["sale_price"])})
            total += float(sku["sale_price"]) * qty
        total = round(total, 2)
        order_no = "EC" + datetime.datetime.now().strftime("%Y%m%d%H%M%S") + secrets.token_hex(3)
        oid = conn.execute("INSERT INTO t_order(order_no,user_id,total_amount,pay_amount,status,address,created_at) VALUES (?,?,?,?,10,?,?)",
                           (order_no, g.user["user_id"], total, total, address, db.now())).lastrowid
        for ln in lines:
            conn.execute("INSERT INTO t_order_item(order_id,sku_id,quantity,unit_price,source) VALUES (?,?,?,?,?)",
                         (oid, ln["sku_id"], ln["qty"], ln["price"], it.get("source", "manual")))
        conn.execute("INSERT INTO t_payment(order_id,channel,pay_status,amount) VALUES (?,?,0,?)",
                     (oid, data.get("channel", "balance"), total))
        conn.commit()
        return jsonify({"orderId": oid, "orderNo": order_no, "amount": total, "status": 10,
                        "message": "订单已创建，请完成支付"})
    finally:
        conn.close()


@app.post("/api/pay/create")
@login_required()
def pay_create():
    """模拟支付网关「统一下单」：返回收银台参数（二维码/链接）。"""
    data = request.get_json(force=True, silent=True) or {}
    order_id = data.get("orderId")
    conn = db.get_conn()
    try:
        order = conn.execute("SELECT * FROM t_order WHERE order_id=? AND user_id=?", (order_id, g.user["user_id"])).fetchone()
        if not order:
            return jsonify({"error": "订单不存在"}), 404
        if order["status"] != 10:
            return jsonify({"error": "订单状态不可支付", "status": order["status"]}), 409
        trade_no = "TN" + secrets.token_hex(10)
        conn.execute("UPDATE t_payment SET trade_no=?, channel=? WHERE order_id=?",
                     (trade_no, data.get("channel", "balance"), order_id))
        conn.commit()
        return jsonify({"orderId": order_id, "tradeNo": trade_no, "amount": float(order["pay_amount"]),
                        "cashierUrl": f"/cashier.html?orderId={order_id}&tradeNo={trade_no}",
                        "message": "请在收银台完成支付"})
    finally:
        conn.close()


@app.post("/api/pay/notify")
@login_required()
def pay_notify():
    """模拟支付网关「异步回调」：验签 + 幂等 -> 扣减库存 -> 订单已支付 -> 触发履约。"""
    data = request.get_json(force=True, silent=True) or {}
    order_id = data.get("orderId")
    trade_no = data.get("tradeNo")
    conn = db.get_conn()
    try:
        pay = conn.execute("SELECT * FROM t_payment WHERE order_id=?", (order_id,)).fetchone()
        order = conn.execute("SELECT * FROM t_order WHERE order_id=?", (order_id,)).fetchone()
        if not pay or not order:
            return jsonify({"error": "订单不存在"}), 404
        # 幂等：已支付直接返回成功
        if pay["pay_status"] == 1:
            return jsonify({"message": "已处理", "status": order["status"]})
        if trade_no and pay["trade_no"] and pay["trade_no"] != trade_no:
            return jsonify({"error": "验签失败：trade_no 不匹配"}), 400
        # 扣减库存（扣减总量，释放锁定）
        for it in conn.execute("SELECT * FROM t_order_item WHERE order_id=?", (order_id,)).fetchall():
            conn.execute("UPDATE t_inventory SET total_qty=total_qty-?, locked_qty=locked_qty-? WHERE sku_id=?",
                         (it["quantity"], it["quantity"], it["sku_id"]))
        conn.execute("UPDATE t_payment SET pay_status=1, paid_at=? WHERE order_id=?", (db.now(), order_id))
        conn.execute("UPDATE t_order SET status=20, paid_at=? WHERE order_id=?", (db.now(), order_id))
        # 发布 OrderPaid 事件 -> 触发履约（演示：写入行为/日志，实际由消息队列驱动物流）
        conn.execute("INSERT INTO t_recommend_log(user_id,scene,strategy_code,items_json,trace_id) VALUES (?,?,?,?,?)",
                     (order["user_id"], "order_paid", "fulfill_trigger",
                      json.dumps([order_id], ensure_ascii=False), "evt_" + secrets.token_hex(8)))
        conn.commit()
        return jsonify({"message": "支付成功，已扣减库存并触发履约", "status": 20})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# 订单管理（消费者）
# ----------------------------------------------------------------------------
@app.get("/api/orders")
@login_required()
def my_orders():
    status = request.args.get("status", type=int)
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM t_order WHERE user_id=?"
        args = [g.user["user_id"]]
        if status:
            sql += " AND status=?"
            args.append(status)
        sql += " ORDER BY created_at DESC"
        orders = conn.execute(sql, args).fetchall()
        out = []
        for o in orders:
            d = dict(o)
            d["statusText"] = db.STATUS_ORDER.get(o["status"], "未知")
            items = conn.execute("SELECT oi.*, s.spec_text, p.title, p.main_image FROM t_order_item oi "
                                 "JOIN t_sku s ON s.sku_id=oi.sku_id JOIN t_product p ON p.product_id=s.product_id "
                                 "WHERE oi.order_id=?", (o["order_id"],)).fetchall()
            d["items"] = [dict(i) for i in items]
            out.append(d)
        return jsonify({"orders": out})
    finally:
        conn.close()


@app.post("/api/orders/<int:oid>/cancel")
@login_required()
def cancel_order(oid):
    conn = db.get_conn()
    try:
        order = conn.execute("SELECT * FROM t_order WHERE order_id=? AND user_id=?", (oid, g.user["user_id"])).fetchone()
        if not order:
            return jsonify({"error": "订单不存在"}), 404
        if order["status"] != 10:
            return jsonify({"error": "仅待支付订单可取消"}), 409
        # 释放锁定库存
        for it in conn.execute("SELECT * FROM t_order_item WHERE order_id=?", (oid,)).fetchall():
            conn.execute("UPDATE t_inventory SET locked_qty=locked_qty-? WHERE sku_id=?", (it["quantity"], it["sku_id"]))
        conn.execute("UPDATE t_order SET status=60 WHERE order_id=?", (oid,))
        conn.execute("UPDATE t_payment SET pay_status=2 WHERE order_id=?", (oid,))
        conn.commit()
        return jsonify({"message": "订单已关闭", "status": 60})
    finally:
        conn.close()


@app.post("/api/orders/<int:oid>/confirm")
@login_required()
def confirm_order(oid):
    conn = db.get_conn()
    try:
        order = conn.execute("SELECT * FROM t_order WHERE order_id=? AND user_id=?", (oid, g.user["user_id"])).fetchone()
        if not order:
            return jsonify({"error": "订单不存在"}), 404
        if order["status"] != 40:
            return jsonify({"error": "仅已发货订单可确认收货"}), 409
        conn.execute("UPDATE t_order SET status=50 WHERE order_id=?", (oid,))
        conn.commit()
        return jsonify({"message": "交易完成", "status": 50})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# 后台：商品 / 订单 / 品类 / 看板（商家、管理员）
# ----------------------------------------------------------------------------
@app.get("/api/admin/products")
@login_required(roles=("merchant", "admin"))
def admin_products():
    conn = db.get_conn()
    try:
        if g.user["role"] == "admin":
            rows = conn.execute("SELECT * FROM t_product ORDER BY product_id DESC").fetchall()
        else:
            rows = conn.execute("SELECT * FROM t_product WHERE merchant_id=? ORDER BY product_id DESC",
                                (g.user["user_id"],)).fetchall()
        out = []
        for p in rows:
            d = dict(p)
            skus = conn.execute("SELECT s.sku_id, s.spec_text, s.sale_price, s.status, "
                               "(SELECT COALESCE(total_qty-locked_qty,0) FROM t_inventory i WHERE i.sku_id=s.sku_id) AS available, "
                               "(SELECT total_qty FROM t_inventory i WHERE i.sku_id=s.sku_id) AS total "
                               "FROM t_sku s WHERE s.product_id=?", (p["product_id"],)).fetchall()
            d["skus"] = [dict(s) for s in skus]
            out.append(d)
        return jsonify({"items": out})
    finally:
        conn.close()


@app.get("/api/admin/orders")
@login_required(roles=("merchant", "admin"))
def admin_orders():
    status = request.args.get("status", type=int)
    conn = db.get_conn()
    try:
        sql = ("SELECT o.*, u.nickname AS buyer FROM t_order o JOIN t_user u ON u.user_id=o.user_id")
        args = []
        if g.user["role"] == "merchant":
            sql += " JOIN t_order_item oi ON oi.order_id=o.order_id JOIN t_sku s ON s.sku_id=oi.sku_id " \
                   "JOIN t_product p ON p.product_id=s.product_id WHERE p.merchant_id=?"
            args.append(g.user["user_id"])
        else:
            sql += " WHERE 1=1"
        if status:
            sql += " AND o.status=?"
            args.append(status)
        sql += " GROUP BY o.order_id ORDER BY o.created_at DESC"
        orders = conn.execute(sql, args).fetchall()
        out = [dict(o) for o in orders]
        for o in out:
            o["statusText"] = db.STATUS_ORDER.get(o["status"], "未知")
        return jsonify({"orders": out})
    finally:
        conn.close()


@app.post("/api/admin/orders/<int:oid>/ship")
@login_required(roles=("merchant", "admin"))
def admin_ship(oid):
    data = request.get_json(force=True, silent=True) or {}
    tracking_no = (data.get("trackingNo") or "").strip()
    if not tracking_no:
        return jsonify({"error": "请填写运单号"}), 400
    conn = db.get_conn()
    try:
        order = conn.execute("SELECT * FROM t_order WHERE order_id=?", (oid,)).fetchone()
        if not order or order["status"] != 20:
            return jsonify({"error": "仅已支付订单可发货"}), 409
        conn.execute("UPDATE t_order SET status=40 WHERE order_id=?", (oid,))
        conn.commit()
        return jsonify({"message": "已发货", "status": 40, "trackingNo": tracking_no})
    finally:
        conn.close()


@app.post("/api/admin/orders/<int:oid>/refund")
@login_required(roles=("merchant", "admin"))
def admin_refund(oid):
    conn = db.get_conn()
    try:
        order = conn.execute("SELECT * FROM t_order WHERE order_id=?", (oid,)).fetchone()
        if not order:
            return jsonify({"error": "订单不存在"}), 404
        if order["status"] not in (20, 30, 40):
            return jsonify({"error": "当前状态不可退款"}), 409
        conn.execute("UPDATE t_order SET status=90 WHERE order_id=?", (oid,))
        conn.execute("UPDATE t_payment SET pay_status=2 WHERE order_id=?", (oid,))
        conn.commit()
        return jsonify({"message": "已退款", "status": 90})
    finally:
        conn.close()


@app.get("/api/admin/dashboard")
@login_required(roles=("merchant", "admin"))
def admin_dashboard():
    conn = db.get_conn()
    try:
        is_admin = g.user["role"] == "admin"
        # 商家视角：统计仅限本店商品与订单
        if is_admin:
            stats = {}
            stats["productCount"] = conn.execute("SELECT COUNT(*) FROM t_product").fetchone()[0]
            stats["orderCount"] = conn.execute("SELECT COUNT(*) FROM t_order").fetchone()[0]
            stats["paidAmount"] = conn.execute("SELECT COALESCE(SUM(pay_amount),0) FROM t_order WHERE status>=20").fetchone()[0]
            stats["pendingShip"] = conn.execute("SELECT COUNT(*) FROM t_order WHERE status=20").fetchone()[0]
            stats["userCount"] = conn.execute("SELECT COUNT(*) FROM t_user").fetchone()[0]
            stats["categoryCount"] = conn.execute("SELECT COUNT(*) FROM t_category").fetchone()[0]
            by_status = conn.execute("SELECT status, COUNT(*) c FROM t_order GROUP BY status").fetchall()
        else:
            mid = g.user["user_id"]
            stats = {}
            stats["productCount"] = conn.execute("SELECT COUNT(*) FROM t_product WHERE merchant_id=?", (mid,)).fetchone()[0]
            stats["orderCount"] = conn.execute(
                "SELECT COUNT(*) FROM t_order o JOIN t_order_item oi ON oi.order_id=o.order_id "
                "JOIN t_sku s ON s.sku_id=oi.sku_id JOIN t_product p ON p.product_id=s.product_id WHERE p.merchant_id=?",
                (mid,)).fetchone()[0]
            stats["paidAmount"] = conn.execute(
                "SELECT COALESCE(SUM(o.pay_amount),0) FROM t_order o JOIN t_order_item oi ON oi.order_id=o.order_id "
                "JOIN t_sku s ON s.sku_id=oi.sku_id JOIN t_product p ON p.product_id=s.product_id WHERE p.merchant_id=? AND o.status>=20",
                (mid,)).fetchone()[0]
            stats["pendingShip"] = conn.execute(
                "SELECT COUNT(*) FROM t_order o JOIN t_order_item oi ON oi.order_id=o.order_id "
                "JOIN t_sku s ON s.sku_id=oi.sku_id JOIN t_product p ON p.product_id=s.product_id WHERE p.merchant_id=? AND o.status=20",
                (mid,)).fetchone()[0]
            stats["userCount"] = conn.execute("SELECT COUNT(*) FROM t_user").fetchone()[0]
            stats["categoryCount"] = conn.execute("SELECT COUNT(*) FROM t_category").fetchone()[0]
            by_status = conn.execute(
                "SELECT o.status, COUNT(*) c FROM t_order o JOIN t_order_item oi ON oi.order_id=o.order_id "
                "JOIN t_sku s ON s.sku_id=oi.sku_id JOIN t_product p ON p.product_id=s.product_id WHERE p.merchant_id=? GROUP BY o.status",
                (mid,)).fetchall()
        stats["ordersByStatus"] = {db.STATUS_ORDER.get(r["status"], str(r["status"])): r["c"] for r in by_status}
        return jsonify(stats)
    finally:
        conn.close()


@app.get("/api/admin/profile")
@login_required(roles=("merchant", "admin"))
def admin_profile():
    """商家/管理员查看自身店铺基本信息。"""
    conn = db.get_conn()
    try:
        u = conn.execute("SELECT user_id, nickname, mobile, role FROM t_user WHERE user_id=?",
                         (g.user["user_id"],)).fetchone()
        prof = conn.execute("SELECT store_desc, contact_phone, store_address FROM t_user_profile WHERE user_id=?",
                            (g.user["user_id"],)).fetchone()
        d = dict(u)
        d["store_desc"] = prof["store_desc"] if prof else ""
        d["contact_phone"] = prof["contact_phone"] if prof else ""
        d["store_address"] = prof["store_address"] if prof else ""
        return jsonify(d)
    finally:
        conn.close()


@app.put("/api/admin/profile")
@login_required(roles=("merchant", "admin"))
def admin_profile_update():
    """商家/管理员维护店铺基本信息（店铺名称/简介/联系电话/地址）。"""
    data = request.get_json(force=True, silent=True) or {}
    nickname = (data.get("nickname") or "").strip()
    store_desc = (data.get("store_desc") or "").strip()
    contact_phone = (data.get("contact_phone") or "").strip()
    store_address = (data.get("store_address") or "").strip()
    if not nickname:
        return jsonify({"error": "请填写店铺名称"}), 400
    if len(nickname) > 64:
        return jsonify({"error": "店铺名称过长"}), 400
    conn = db.get_conn()
    try:
        conn.execute("UPDATE t_user SET nickname=? WHERE user_id=?", (nickname, g.user["user_id"]))
        conn.execute(
            "UPDATE t_user_profile SET store_desc=?, contact_phone=?, store_address=?, updated_at=? WHERE user_id=?",
            (store_desc, contact_phone, store_address, db.now(), g.user["user_id"]))
        conn.commit()
        return jsonify({"message": "店铺信息已更新"})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# AI 能力接口（遵守降级契约）
# ----------------------------------------------------------------------------
@app.post("/api/ai/chat")
@login_required()
def ai_chat():
    data = request.get_json(force=True, silent=True) or {}
    uid = g.user["user_id"] if g.user else None
    conn = db.get_conn()
    try:
        res = ai.chat(conn, uid, data.get("message", ""), data.get("sessionId"))
        return jsonify(res)
    finally:
        conn.close()


@app.get("/api/ai/recommend")
@login_required()
def ai_recommend():
    scene = request.args.get("scene", "home")
    uid = g.user["user_id"] if g.user else None
    conn = db.get_conn()
    try:
        return jsonify(ai.recommend(conn, uid, scene))
    finally:
        conn.close()


@app.get("/api/ai/bundle/<int:pid>")
def ai_bundle(pid):
    conn = db.get_conn()
    try:
        return jsonify(ai.compose_bundle(conn, pid))
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# 启动种子数据
# ----------------------------------------------------------------------------
def seed():
    conn = db.get_conn()
    try:
        # 已存在数据则跳过
        if conn.execute("SELECT 1 FROM t_user LIMIT 1").fetchone():
            conn.close()
            return
        # 三类账号
        accounts = [
            ("13800000000", "admin123", "平台管理员", "admin"),
            ("13900000000", "merch123", "优选数码旗舰店", "merchant"),
            ("13700000000", "user123", "小明", "consumer"),
        ]
        for mobile, pwd, nick, role in accounts:
            h = db.hash_password(pwd)
            uid = conn.execute("INSERT INTO t_user(nickname,mobile,password_hash,role,member_level,created_at) VALUES (?,?,?,?,1,?)",
                              (nick, mobile, h, role, db.now())).lastrowid
            conn.execute("INSERT INTO t_user_profile(user_id,prefer_category_json,activity_score,updated_at) VALUES (?,?,0,?)",
                         (uid, json.dumps([], ensure_ascii=False), db.now()))
        merchant_id = conn.execute("SELECT user_id FROM t_user WHERE mobile='13900000000'").fetchone()[0]
        consumer_id = conn.execute("SELECT user_id FROM t_user WHERE mobile='13700000000'").fetchone()[0]

        # 演示品类树（JSON 自定义引擎导入）
        demo_json = json.dumps({
            "code": "digital", "name": "手机数码",
            "attrs": [{"attrCode": "brand", "attrName": "品牌", "dataType": "enum", "isRequired": True, "isFilterable": True, "valueRange": "Apple,Huawei,Xiaomi,OPPO"},
                      {"attrCode": "warranty", "attrName": "保修期(月)", "dataType": "int", "isRequired": False, "isFilterable": False}],
            "children": [
                {"code": "digital.phone", "name": "手机",
                 "attrs": [{"attrCode": "storage", "attrName": "存储容量", "dataType": "enum", "isRequired": True, "isFilterable": True, "valueRange": "128GB,256GB,512GB"},
                           {"attrCode": "color", "attrName": "颜色", "dataType": "enum", "isRequired": True, "isFilterable": True, "valueRange": "黑,白,蓝,紫"}],
                 "children": [
                     {"code": "digital.phone.flag", "name": "旗舰机",
                      "attrs": [{"attrCode": "screen", "attrName": "屏幕(寸)", "dataType": "decimal", "isRequired": False, "isFilterable": True}]},
                     {"code": "digital.phone.mid", "name": "中端机", "attrs": []}
                 ]},
                {"code": "digital.acc", "name": "手机配件",
                 "attrs": [{"attrCode": "ctype", "attrName": "配件类型", "dataType": "enum", "isRequired": True, "isFilterable": True, "valueRange": "耳机,充电器,保护壳,数据线"}]},
                {"code": "digital.wearable", "name": "智能穿戴",
                 "attrs": [{"attrCode": "wtype", "attrName": "穿戴类型", "dataType": "enum", "isRequired": True, "isFilterable": True, "valueRange": "手表,手环"},
                           {"attrCode": "color", "attrName": "颜色", "dataType": "enum", "isRequired": False, "isFilterable": True, "valueRange": "黑,白,蓝"}]}
            ]
        }, ensure_ascii=False)
        category_engine.import_category(conn, demo_json, merchant_id)

        # 图书（独立一级品类，演示多品类经营）
        books_json = json.dumps({
            "code": "books", "name": "图书",
            "attrs": [{"attrCode": "category", "attrName": "图书分类", "dataType": "enum", "isRequired": True, "isFilterable": True, "valueRange": "技术,运营,文学"},
                      {"attrCode": "author", "attrName": "作者", "dataType": "string", "isRequired": False, "isFilterable": False}],
            "children": []
        }, ensure_ascii=False)
        category_engine.import_category(conn, books_json, merchant_id)

        phone_cat = conn.execute("SELECT category_id FROM t_category WHERE code='digital.phone'").fetchone()[0]
        acc_cat = conn.execute("SELECT category_id FROM t_category WHERE code='digital.acc'").fetchone()[0]
        wearable_cat = conn.execute("SELECT category_id FROM t_category WHERE code='digital.wearable'").fetchone()[0]
        books_cat = conn.execute("SELECT category_id FROM t_category WHERE code='books'").fetchone()[0]

        # 演示商品 + SKU + 库存（main_image 统一指向动态图片路由 /img/product/<id>）
        def add_product(title, cat, skus):
            pid = conn.execute("INSERT INTO t_product(merchant_id,category_id,title,main_image,status,created_at) VALUES (?,?,?,?,1,?)",
                              (merchant_id, cat, title, "/img/product/0", db.now())).lastrowid
            conn.execute("UPDATE t_product SET main_image=? WHERE product_id=?", (f"/img/product/{pid}", pid))
            for sp in skus:
                skid = conn.execute("INSERT INTO t_sku(product_id,spec_text,sale_price,market_price,status) VALUES (?,?,?,?,1)",
                                    (pid, sp["spec"], sp["price"], sp.get("market", sp["price"]))).lastrowid
                conn.execute("INSERT INTO t_inventory(sku_id,warehouse_id,total_qty,locked_qty,version) VALUES (?,1,?,0,0)",
                             (skid, sp["qty"]))
                for ac, val in sp.get("attrs", {}).items():
                    a = conn.execute("SELECT attr_id FROM t_category_attr WHERE category_id=? AND attr_code=?", (cat, ac)).fetchone()
                    if a:
                        conn.execute("INSERT INTO t_sku_attr_value(sku_id,attr_id,attr_value) VALUES (?,?,?)",
                                     (skid, a["attr_id"], str(val)))
            return pid

        # ---- 手机 ----
        add_product("智选云 5G 旗舰手机 Pro", phone_cat, [
            {"spec": "8+128GB/黑", "price": 4999.0, "market": 5299.0, "qty": 20, "attrs": {"brand": "Apple", "storage": "128GB", "color": "黑", "screen": 6.7}},
            {"spec": "12+256GB/蓝", "price": 5699.0, "market": 5999.0, "qty": 15, "attrs": {"brand": "Apple", "storage": "256GB", "color": "蓝", "screen": 6.7}},
            {"spec": "12+512GB/紫", "price": 6499.0, "market": 6799.0, "qty": 8, "attrs": {"brand": "Apple", "storage": "512GB", "color": "紫", "screen": 6.7}},
        ])
        add_product("智选云 中端畅享手机", phone_cat, [
            {"spec": "6+128GB/白", "price": 1599.0, "market": 1799.0, "qty": 30, "attrs": {"brand": "Huawei", "storage": "128GB", "color": "白"}},
            {"spec": "8+256GB/黑", "price": 1999.0, "market": 2199.0, "qty": 25, "attrs": {"brand": "Huawei", "storage": "256GB", "color": "黑"}},
        ])
        add_product("智选云 电竞旗舰手机 Ultra", phone_cat, [
            {"spec": "16+512GB/黑", "price": 6999.0, "market": 7299.0, "qty": 12, "attrs": {"brand": "Xiaomi", "storage": "512GB", "color": "黑", "screen": 6.8}},
            {"spec": "16+1TB/银", "price": 7999.0, "market": 8299.0, "qty": 6, "attrs": {"brand": "Xiaomi", "storage": "1TB", "color": "银", "screen": 6.8}},
        ])
        add_product("智选云 轻薄中端机 Neo", phone_cat, [
            {"spec": "8+128GB/绿", "price": 1299.0, "market": 1499.0, "qty": 40, "attrs": {"brand": "OPPO", "storage": "128GB", "color": "绿"}},
            {"spec": "8+256GB/粉", "price": 1499.0, "market": 1699.0, "qty": 35, "attrs": {"brand": "OPPO", "storage": "256GB", "color": "粉"}},
        ])
        add_product("智选云 折叠屏旗舰 Fold", phone_cat, [
            {"spec": "12+512GB/黑", "price": 8999.0, "market": 9499.0, "qty": 5, "attrs": {"brand": "Huawei", "storage": "512GB", "color": "黑", "screen": 7.6}},
            {"spec": "12+1TB/金", "price": 9999.0, "market": 10499.0, "qty": 3, "attrs": {"brand": "Huawei", "storage": "1TB", "color": "金", "screen": 7.6}},
        ])
        # ---- 手机配件 ----
        add_product("降噪蓝牙耳机 Air", acc_cat, [
            {"spec": "标准版/白", "price": 399.0, "market": 499.0, "qty": 50, "attrs": {"ctype": "耳机"}},
            {"spec": "Pro版/黑", "price": 699.0, "market": 799.0, "qty": 40, "attrs": {"ctype": "耳机"}},
        ])
        add_product("65W 超级快充充电器", acc_cat, [
            {"spec": "单头", "price": 129.0, "market": 159.0, "qty": 60, "attrs": {"ctype": "充电器"}},
        ])
        add_product("磁吸防护壳 Pro", acc_cat, [
            {"spec": "透明", "price": 79.0, "market": 99.0, "qty": 80, "attrs": {"ctype": "保护壳"}},
            {"spec": "磨砂黑", "price": 89.0, "market": 109.0, "qty": 70, "attrs": {"ctype": "保护壳"}},
        ])
        add_product("100W 闪充数据线", acc_cat, [
            {"spec": "1.5m", "price": 49.0, "market": 69.0, "qty": 120, "attrs": {"ctype": "数据线"}},
            {"spec": "2m", "price": 59.0, "market": 79.0, "qty": 100, "attrs": {"ctype": "数据线"}},
        ])
        # ---- 智能穿戴 ----
        add_product("智选云 智能手表 Watch", wearable_cat, [
            {"spec": "46mm/黑", "price": 1299.0, "market": 1499.0, "qty": 30, "attrs": {"wtype": "手表", "color": "黑"}},
            {"spec": "42mm/白", "price": 1099.0, "market": 1299.0, "qty": 28, "attrs": {"wtype": "手表", "color": "白"}},
        ])
        add_product("智选云 运动手环 Band", wearable_cat, [
            {"spec": "标准版/蓝", "price": 199.0, "market": 259.0, "qty": 90, "attrs": {"wtype": "手环", "color": "蓝"}},
            {"spec": "NFC版/紫", "price": 249.0, "market": 299.0, "qty": 75, "attrs": {"wtype": "手环", "color": "紫"}},
        ])
        # ---- 图书 ----
        add_product("《AI 大模型实战》", books_cat, [
            {"spec": "精装", "price": 89.0, "market": 109.0, "qty": 200, "attrs": {"category": "技术", "author": "智选云研究院"}},
        ])
        add_product("《电商运营从0到1》", books_cat, [
            {"spec": "平装", "price": 59.0, "market": 79.0, "qty": 240, "attrs": {"category": "运营", "author": "王明"}},
        ])
        add_product("《Python 数据分析》", books_cat, [
            {"spec": "平装", "price": 69.0, "market": 89.0, "qty": 180, "attrs": {"category": "技术", "author": "李华"}},
        ])
        add_product("《影响力（经典版）》", books_cat, [
            {"spec": "精装", "price": 45.0, "market": 59.0, "qty": 150, "attrs": {"category": "文学", "author": "罗伯特·西奥迪尼"}},
        ])

        # 知识片段（智能客服 RAG 知识库）
        chunks = [
            ("退换货政策", "本平台支持 7 天无理由退换货，商品需保持完好、不影响二次销售。", "退货,退换,七天,无理由"),
            ("配送时效", "现货商品一般在支付后 48 小时内发货，偏远地区顺延 1-2 天。", "配送,发货,物流,快递,时效"),
            ("发票说明", "支持开具电子发票，可在「我的订单」中申请。", "发票,开票,电子发票"),
            ("支付方式", "支持余额支付、微信与支付宝等常见方式（演示站为模拟支付）。", "支付,付款,微信,支付宝,余额"),
        ]
        for title, content, kw in chunks:
            conn.execute("INSERT INTO t_knowledge_chunk(category_code,title,content,keywords,status) VALUES (?,?,?,?,1)",
                         ("digital", title, content, kw))

        # 演示行为（用于智能选品召回）
        skus = conn.execute("SELECT sku_id FROM t_sku LIMIT 3").fetchall()
        for s in skus:
            conn.execute("INSERT INTO t_user_behavior(user_id,event_type,sku_id,scene,occur_time) VALUES (?,?,?,?,?)",
                         (consumer_id, "view", s["sku_id"], "home", db.now()))

        conn.commit()
        print("[seed] 演示数据初始化完成：管理员/商家/消费者账号、品类树(含图书/智能穿戴)、15 件商品(含图片)、知识库已就绪。")
    finally:
        conn.close()


if __name__ == "__main__":
    db.init_schema()
    seed()
    print("AI-ECP 服务已启动： http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
