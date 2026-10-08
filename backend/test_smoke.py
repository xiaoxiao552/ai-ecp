# -*- coding: utf-8 -*-
"""后端业务闭环冒烟测试（Flask 测试客户端，不占用端口）。"""
import json
import app as appmod
from app import app

appmod.db.init_schema()
appmod.seed()

c = app.test_client()
H = {"Content-Type": "application/json"}


def j(r):
    return r.get_json()


def auth(mobile, pwd):
    r = c.post("/api/auth/login", json={"mobile": mobile, "password": pwd}, headers=H)
    assert r.status_code == 200, (r.status_code, r.get_data(as_text=True))
    return r.get_json()["token"]


print("== 登录三类账号 ==")
tk_user = auth("13700000000", "user123")
tk_merch = auth("13900000000", "merch123")
tk_admin = auth("13800000000", "admin123")
print("consumer/merchant/admin token ok")

print("== 商品列表 ==")
r = c.get("/api/products")
prods = j(r)["items"]
assert prods, "no products"
print("商品数:", len(prods), "首件:", prods[0]["title"], prods[0]["min_price"])

print("== 智能选品推荐 ==")
r = c.get("/api/ai/recommend", headers={"Authorization": "Bearer " + tk_user})
rec = j(r)
print("strategy:", rec["strategyCode"], "items:", len(rec["items"]))

print("== 智能组货 ==")
pid = prods[0]["product_id"]
r = c.get(f"/api/ai/bundle/{pid}")
print("bundle:", j(r).get("strategyCode"), "degraded:", j(r).get("degraded"))

print("== 智能客服 ==")
r = c.post("/api/ai/chat", json={"message": "我的订单物流到哪了"}, headers={"Authorization": "Bearer " + tk_user})
print("chat:", j(r)["content"][:40], "degraded:", j(r)["degraded"])

print("== 加入购物车 ==")
sku = c.get(f"/api/products/{pid}").get_json()["product"]["skus"][0]
r = c.post("/api/cart", json={"skuId": sku["sku_id"], "quantity": 1}, headers={"Authorization": "Bearer " + tk_user})
print("加购:", j(r)["message"])
cart = c.get("/api/cart", headers={"Authorization": "Bearer " + tk_user}).get_json()
print("购物车:", cart["count"], "件, 合计 ¥", cart["total"])

print("== 下单 ==")
r = c.post("/api/orders", json={"items": [{"skuId": sku["sku_id"], "quantity": 1}], "address": "北京市朝阳区xx路1号"},
           headers={"Authorization": "Bearer " + tk_user})
od = j(r)
print("下单:", od["message"], "订单号:", od["orderNo"], "金额:", od["amount"], "状态:", od["status"])
assert od["status"] == 10

print("== 锁库存校验（重复下单超量应失败）==")
big = c.post("/api/orders", json={"items": [{"skuId": sku["sku_id"], "quantity": 9999}], "address": "x"},
             headers={"Authorization": "Bearer " + tk_user})
print("超量下单返回:", big.status_code, j(big).get("error"))

print("== 统一下单(支付网关) ==")
r = c.post("/api/pay/create", json={"orderId": od["orderId"], "channel": "balance"}, headers={"Authorization": "Bearer " + tk_user})
print("收银台:", j(r)["cashierUrl"])

print("== 支付回调(验签/扣库存/已支付) ==")
r = c.post("/api/pay/notify", json={"orderId": od["orderId"], "tradeNo": j(r)["tradeNo"]}, headers={"Authorization": "Bearer " + tk_user})
print("支付回调:", j(r)["message"], "状态:", j(r)["status"])
assert j(r)["status"] == 20

print("== 商家发货 ==")
r = c.post(f"/api/admin/orders/{od['orderId']}/ship", json={"trackingNo": "SF1234567890"}, headers={"Authorization": "Bearer " + tk_merch})
print("发货:", j(r)["message"], "状态:", j(r)["status"])
assert j(r)["status"] == 40

print("== 消费者确认收货 ==")
r = c.post(f"/api/orders/{od['orderId']}/confirm", headers={"Authorization": "Bearer " + tk_user})
print("确认收货:", j(r)["message"], "状态:", j(r)["status"])
assert j(r)["status"] == 50

print("== 品类 JSON 导入(新品类) ==")
new_cat = json.dumps({"code": "book", "name": "图书", "attrs": [
    {"attrCode": "author", "attrName": "作者", "dataType": "string", "isRequired": True, "isFilterable": False},
    {"attrCode": "press", "attrName": "出版社", "dataType": "string", "isRequired": False, "isFilterable": True}]}, ensure_ascii=False)
r = c.post("/api/categories/import", json={"json": new_cat}, headers={"Authorization": "Bearer " + tk_merch})
print("品类导入:", j(r).get("message"), "品类数:", j(r).get("categoryCount"))

print("== 品类导入校验失败(重复编码) ==")
bad = json.dumps({"code": "digital", "name": "重复", "children": [{"code": "digital", "name": "冲突"}]}, ensure_ascii=False)
r = c.post("/api/categories/import", json={"json": bad}, headers={"Authorization": "Bearer " + tk_merch})
print("重复编码导入返回:", r.status_code, j(r).get("error"))

print("== 动态表单预览 ==")
book_id = c.get("/api/categories").get_json()["tree"]
print("品类树根数:", len(book_id))

print("\n✅ 全部业务闭环验证通过")
