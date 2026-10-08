# -*- coding: utf-8 -*-
"""
智选云 AI 电商在线售货系统 (AI-ECP) —— 数据库层
依据成果包《核心数据模型图》(图 4-8 ERD) 与《领域概念类图》(图 3-9) 建立 SQLite 库。
- 用户/商家/管理员、品类体系(JSON 自定义)、商品与 SKU/库存、购物车、订单/支付、
  会话/消息/知识片段、组货方案、推荐日志。
- 提供连接获取、密码哈希、会话(token)等基础 helpers。
- 提供 seed() 初始化演示数据（含一个演示品类树、商品、知识片段、三类账号）。
"""
import sqlite3
import os
import time
import hashlib
import secrets
import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "ai_ecp.db")

# ----------------------------------------------------------------------------
# 建表脚本（字段命名与 ERD 保持一致）
# ----------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS t_user (
  user_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname     VARCHAR(64),
  mobile       VARCHAR(20) UNIQUE,
  password_hash VARCHAR(200),
  role         VARCHAR(16) DEFAULT 'consumer',   -- consumer | merchant | admin
  member_level INTEGER DEFAULT 1,
  created_at   DATETIME
);

CREATE TABLE IF NOT EXISTS t_user_profile (
  profile_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER,
  prefer_category_json TEXT,
  price_band          VARCHAR(32),
  activity_score      DECIMAL(6,2) DEFAULT 0,
  updated_at          DATETIME,
  FOREIGN KEY (user_id) REFERENCES t_user(user_id)
);

CREATE TABLE IF NOT EXISTS t_user_behavior (
  event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  event_type  VARCHAR(32),
  sku_id      INTEGER,
  scene       VARCHAR(32),
  occur_time  DATETIME
);

CREATE TABLE IF NOT EXISTS t_category (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code        VARCHAR(64) UNIQUE,
  name        VARCHAR(128),
  parent_id   INTEGER,
  level       TINYINT,
  path        VARCHAR(512),
  is_leaf     TINYINT DEFAULT 1,
  version     INTEGER DEFAULT 1,
  status      TINYINT DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES t_category(category_id)
);

CREATE TABLE IF NOT EXISTS t_category_attr (
  attr_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER,
  attr_code     VARCHAR(64),
  attr_name     VARCHAR(128),
  data_type     VARCHAR(32),
  is_required   TINYINT DEFAULT 0,
  is_filterable TINYINT DEFAULT 0,
  value_range   VARCHAR(1024),
  sort_no       INTEGER DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES t_category(category_id)
);

CREATE TABLE IF NOT EXISTS t_index_mapping (
  mapping_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER,
  index_name   VARCHAR(128),
  field_json   TEXT,
  sync_status  TINYINT DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES t_category(category_id)
);

CREATE TABLE IF NOT EXISTS t_product (
  product_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER,
  category_id INTEGER,
  title       VARCHAR(256),
  main_image  VARCHAR(512),
  status      TINYINT DEFAULT 1,    -- 1 在售 / 0 下架
  created_at  DATETIME,
  FOREIGN KEY (merchant_id) REFERENCES t_user(user_id),
  FOREIGN KEY (category_id) REFERENCES t_category(category_id)
);

CREATE TABLE IF NOT EXISTS t_sku (
  sku_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER,
  spec_text    VARCHAR(512),
  sale_price   DECIMAL(12,2),
  market_price DECIMAL(12,2),
  status       TINYINT DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES t_product(product_id)
);

CREATE TABLE IF NOT EXISTS t_sku_attr_value (
  value_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_id     INTEGER,
  attr_id    INTEGER,
  attr_value VARCHAR(256),
  FOREIGN KEY (sku_id) REFERENCES t_sku(sku_id),
  FOREIGN KEY (attr_id) REFERENCES t_category_attr(attr_id)
);

CREATE TABLE IF NOT EXISTS t_inventory (
  stock_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_id       INTEGER,
  warehouse_id INTEGER DEFAULT 1,
  total_qty    INTEGER DEFAULT 0,
  locked_qty   INTEGER DEFAULT 0,
  version      INTEGER DEFAULT 0,
  FOREIGN KEY (sku_id) REFERENCES t_sku(sku_id)
);

CREATE TABLE IF NOT EXISTS t_cart_item (
  cart_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER,
  sku_id       INTEGER,
  quantity     INTEGER DEFAULT 1,
  source       VARCHAR(32) DEFAULT 'manual',  -- manual | recommend | bundle
  FOREIGN KEY (user_id) REFERENCES t_user(user_id),
  FOREIGN KEY (sku_id) REFERENCES t_sku(sku_id)
);

CREATE TABLE IF NOT EXISTS t_order (
  order_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    VARCHAR(32) UNIQUE,
  user_id     INTEGER,
  total_amount DECIMAL(12,2),
  pay_amount   DECIMAL(12,2),
  status      TINYINT DEFAULT 10,   -- 见 STATUS_ORDER 字典
  address     TEXT,
  created_at  DATETIME,
  paid_at     DATETIME,
  FOREIGN KEY (user_id) REFERENCES t_user(user_id)
);

CREATE TABLE IF NOT EXISTS t_order_item (
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER,
  sku_id        INTEGER,
  quantity      INTEGER,
  unit_price    DECIMAL(12,2),
  source        VARCHAR(32),
  FOREIGN KEY (order_id) REFERENCES t_order(order_id),
  FOREIGN KEY (sku_id) REFERENCES t_sku(sku_id)
);

CREATE TABLE IF NOT EXISTS t_payment (
  payment_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER,
  channel     VARCHAR(32),
  pay_status  TINYINT DEFAULT 0,   -- 0 未支付 / 1 已支付 / 2 已退款
  trade_no    VARCHAR(64),
  amount      DECIMAL(12,2),
  paid_at     DATETIME,
  FOREIGN KEY (order_id) REFERENCES t_order(order_id)
);

CREATE TABLE IF NOT EXISTS t_conversation (
  session_id  VARCHAR(64) PRIMARY KEY,
  user_id     INTEGER,
  channel     VARCHAR(32) DEFAULT 'web',
  status      TINYINT DEFAULT 1,
  started_at  DATETIME
);

CREATE TABLE IF NOT EXISTS t_message (
  message_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  VARCHAR(64),
  role        VARCHAR(16),
  content     TEXT,
  confidence  DECIMAL(5,4),
  created_at  DATETIME
);

CREATE TABLE IF NOT EXISTS t_knowledge_chunk (
  chunk_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category_code  VARCHAR(64),
  title          VARCHAR(256),
  content        TEXT,
  keywords       TEXT,
  status         TINYINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS t_bundle (
  bundle_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  main_product_id  INTEGER,
  scene_tag        VARCHAR(64),
  bundle_price     DECIMAL(12,2),
  gross_rate       DECIMAL(6,4),
  strategy_code    VARCHAR(64),
  reason           TEXT,
  FOREIGN KEY (main_product_id) REFERENCES t_product(product_id)
);

CREATE TABLE IF NOT EXISTS t_bundle_item (
  bundle_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id      INTEGER,
  sku_id         INTEGER,
  role           VARCHAR(32),
  quantity       INTEGER DEFAULT 1,
  FOREIGN KEY (bundle_id) REFERENCES t_bundle(bundle_id),
  FOREIGN KEY (sku_id) REFERENCES t_sku(sku_id)
);

CREATE TABLE IF NOT EXISTS t_recommend_log (
  log_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER,
  scene         VARCHAR(32),
  strategy_code VARCHAR(64),
  items_json    TEXT,
  trace_id      VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS t_session (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    INTEGER,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES t_user(user_id)
);
"""

# 订单状态字典（对应 图 4-7 订单状态机）
STATUS_ORDER = {
    10: "待支付",
    20: "已支付",
    30: "待发货",
    40: "已发货",
    50: "已完成",
    60: "已关闭",
    70: "退款中",
    80: "售后中",
    90: "已退款",
}


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema():
    conn = get_conn()
    conn.executescript(SCHEMA)
    # 商家基本信息扩展字段（向后兼容：已存在的库自动补齐列）
    for col, ctype in (
        ("store_desc", "VARCHAR(512)"),
        ("contact_phone", "VARCHAR(32)"),
        ("store_address", "VARCHAR(256)"),
    ):
        try:
            conn.execute(f"ALTER TABLE t_user_profile ADD COLUMN {col} {ctype}")
        except sqlite3.OperationalError:
            pass  # 列已存在
    conn.commit()
    conn.close()


# ----------------------------------------------------------------------------
# 密码 / 会话 helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    d = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode(), 100000).hex()
    return f"pbkdf2${salt}${d}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, d = stored.split("$", 2)
    except Exception:
        return False
    nd = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode(), 100000).hex()
    return secrets.compare_digest(nd, d)


def create_session(conn, user_id: int, ttl_hours: int = 24) -> str:
    token = secrets.token_hex(24)
    exp = (datetime.datetime.now() + datetime.timedelta(hours=ttl_hours)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("INSERT INTO t_session(token, user_id, expires_at) VALUES (?,?,?)", (token, user_id, exp))
    conn.commit()
    return token


def user_by_token(conn, token: str):
    if not token:
        return None
    row = conn.execute(
        "SELECT u.* FROM t_session s JOIN t_user u ON u.user_id=s.user_id "
        "WHERE s.token=? AND s.expires_at>?", (token, now())
    ).fetchone()
    return row


def get_user(conn, user_id: int):
    return conn.execute("SELECT * FROM t_user WHERE user_id=?", (user_id,)).fetchone()


def row_to_dict(row):
    return dict(row) if row else None
