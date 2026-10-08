# -*- coding: utf-8 -*-
"""
品类自定义引擎（JSON 驱动）—— 对应成果包 图 3-6 / 图 4-9
处理链路：语法解析 → 结构语义校验 → 品类树构建 → 索引映射生成 → 落库 → 动态表单预览。

JSON 约定（商家上传/粘贴的品类定义）：
{
  "code": "phone",                       # 品类编码，全局唯一
  "name": "手机数码",                    # 品类名称
  "attrs": [                             # 属性 Schema（可选）
    {"attrCode":"brand","attrName":"品牌","dataType":"enum",
     "isRequired":true,"isFilterable":true,"valueRange":"Apple,Huawei,Xiaomi"}
  ],
  "children": [                          # 子品类（可选，递归）
    {"code":"phone.cell","name":"手机","attrs":[...],"children":[...]}
  ]
}
dataType 白名单：string | int | decimal | enum | boolean | date
"""
import json
import datetime

DATA_TYPE_WHITELIST = {"string", "int", "decimal", "enum", "boolean", "date"}
MAX_DEPTH = 5

SYNTAX_ERROR = "SYNTAX_ERROR"
VALIDATION_ERROR = "VALIDATION_ERROR"


def parse(json_text: str):
    """JSON 语法解析，失败抛出 SyntaxError(含位置提示)。"""
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        raise SyntaxError(f"JSON 语法错误：第 {e.lineno} 行第 {e.colno} 列 - {e.msg}")


def _validate_node(node, code_set, errors, depth):
    if depth > MAX_DEPTH:
        errors.append(f"层级超过上限({MAX_DEPTH})：{node.get('code')}")
        return
    code = node.get("code")
    name = node.get("name")
    if not isinstance(code, str) or not code.strip():
        errors.append("存在节点缺少合法 code")
        return
    code = code.strip()
    if code in code_set:
        errors.append(f"品类编码重复：{code}")
    code_set.add(code)
    if not isinstance(name, str) or not name.strip():
        errors.append(f"品类 {code} 缺少名称 name")
    for i, a in enumerate(node.get("attrs", []) or []):
        if not a.get("attrCode"):
            errors.append(f"品类 {code} 第 {i+1} 个属性缺少 attrCode")
            continue
        dt = a.get("dataType", "string")
        if dt not in DATA_TYPE_WHITELIST:
            errors.append(f"品类 {code} 属性 {a.get('attrCode')} 的 dataType 不在白名单：{dt}")
        if dt == "enum" and not a.get("valueRange"):
            errors.append(f"品类 {code} 枚举属性 {a.get('attrCode')} 缺少 valueRange")
    for child in node.get("children", []) or []:
        _validate_node(child, code_set, errors, depth + 1)


def validate(draft):
    """结构语义校验：编码唯一性 / 层级深度 / 类型白名单 / 循环引用(由树结构天然避免，做深度与必填校验)。"""
    errors = []
    if not isinstance(draft, dict):
        errors.append("根节点必须是 JSON 对象")
        return errors
    _validate_node(draft, set(), errors, 1)
    return errors


def _flatten(node, parent_id, level, path, out):
    code = node["code"].strip()
    cur_path = f"{path}/{code}" if path else f"/{code}"
    children = node.get("children", []) or []
    out.append({
        "code": code,
        "name": node["name"].strip(),
        "parent_id": parent_id,
        "level": level,
        "path": cur_path,
        "is_leaf": 0 if children else 1,
        "attrs": node.get("attrs", []) or [],
    })
    for child in children:
        _flatten(child, None, level + 1, cur_path, out)  # parent_id 回填
    return out


def build_tree(draft):
    """构建扁平化品类树（含属性 Schema），返回节点列表。"""
    flat = _flatten(draft, None, 1, "", [])
    # 回填 parent_id：依据 path 前缀匹配
    by_code = {n["code"]: n for n in flat}
    for n in flat:
        # parent path = 去掉最后一段
        parts = n["path"].strip("/").split("/")
        if len(parts) > 1:
            parent_code = parts[-2]
            n["parent_id"] = by_code[parent_code]["_pk"] if "_pk" in by_code[parent_code] else None
    return flat


def import_category(conn, json_text: str, merchant_id=None, version=1):
    """
    导入品类：解析 → 校验 → 建树 → 索引映射 → 落库。
    返回 {rootCategoryId, categoryCount, attrCount, version, tree}
    """
    draft = parse(json_text)
    errors = validate(draft)
    if errors:
        raise ValueError({"stage": VALIDATION_ERROR, "errors": errors})

    flat = build_tree(draft)
    new_version = (conn.execute("SELECT COALESCE(MAX(version),0) FROM t_category").fetchone()[0] or 0) + 1

    # 先写入所有品类，建立 code -> category_id 映射
    code_to_id = {}
    rows = []
    # 按 path 长度排序保证父在前
    flat.sort(key=lambda n: len(n["path"]))
    for n in flat:
        parent_id = code_to_id.get(_parent_code(n["path"])) if n["parent_id"] is None and "/" in n["path"].strip("/") else None
        # parent_id 计算：通过 parent code
        pparts = n["path"].strip("/").split("/")
        pid = code_to_id.get(pparts[-2]) if len(pparts) > 1 else None
        rid = conn.execute(
            "INSERT INTO t_category(code,name,parent_id,level,path,is_leaf,version,status) "
            "VALUES (?,?,?,?,?,?,?,1)",
            (n["code"], n["name"], pid, n["level"], n["path"], n["is_leaf"], new_version),
        ).lastrowid
        code_to_id[n["code"]] = rid
        rows.append((rid, n))

    # 写入属性 + 索引映射
    attr_count = 0
    for rid, n in rows:
        for i, a in enumerate(n["attrs"]):
            conn.execute(
                "INSERT INTO t_category_attr(category_id,attr_code,attr_name,data_type,is_required,is_filterable,value_range,sort_no) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (rid, a.get("attrCode"), a.get("attrName"), a.get("dataType", "string"),
                 1 if a.get("isRequired") else 0, 1 if a.get("isFilterable") else 0,
                 a.get("valueRange"), i),
            )
            attr_count += 1
            if a.get("isFilterable"):
                conn.execute(
                    "INSERT INTO t_index_mapping(category_id,index_name,field_json,sync_status) VALUES (?,?,?,1)",
                    (rid, f"idx_{n['code']}_{a.get('attrCode')}",
                     json.dumps({"attrCode": a.get("attrCode"), "dataType": a.get("dataType", "string")}, ensure_ascii=False)),
                )
    conn.commit()
    root_id = code_to_id.get(flat[0]["code"])
    return {
        "rootCategoryId": root_id,
        "categoryCount": len(flat),
        "attrCount": attr_count,
        "version": new_version,
        "tree": [{"categoryId": rid, **{k: v for k, v in n.items() if k != "parent_id"}, "parentId": n["parent_id"]} for rid, n in rows],
    }


def _parent_code(path):
    parts = path.strip("/").split("/")
    return parts[-2] if len(parts) > 1 else None


def get_category_tree(conn):
    """返回前端可用的品类树（含属性）。"""
    cats = conn.execute("SELECT * FROM t_category WHERE status=1 ORDER BY level, category_id").fetchall()
    attrs = conn.execute("SELECT * FROM t_category_attr ORDER BY category_id, sort_no").fetchall()
    attr_map = {}
    for a in attrs:
        attr_map.setdefault(a["category_id"], []).append(dict(a))
    nodes = {}
    for c in cats:
        d = dict(c)
        d["attrs"] = attr_map.get(c["category_id"], [])
        d["children"] = []
        nodes[c["category_id"]] = d
    roots = []
    for c in cats:
        if c["parent_id"] and c["parent_id"] in nodes:
            nodes[c["parent_id"]]["children"].append(nodes[c["category_id"]])
        else:
            roots.append(nodes[c["category_id"]])
    return roots


def preview_form(conn, category_id: int):
    """预览「动态商品发布表单」：汇总该品类及其祖先的属性 Schema（成果包核心能力之一）。"""
    # 回溯祖先链
    chain = []
    cur = conn.execute("SELECT * FROM t_category WHERE category_id=?", (category_id,)).fetchone()
    while cur:
        chain.append(cur)
        if cur["parent_id"]:
            cur = conn.execute("SELECT * FROM t_category WHERE category_id=?", (cur["parent_id"],)).fetchone()
        else:
            cur = None
    chain.reverse()
    fields = []
    seen = set()
    for c in chain:
        for a in conn.execute("SELECT * FROM t_category_attr WHERE category_id=? ORDER BY sort_no", (c["category_id"],)):
            if a["attr_code"] in seen:
                continue
            seen.add(a["attr_code"])
            fields.append({
                "attrCode": a["attr_code"],
                "attrName": a["attr_name"],
                "dataType": a["data_type"],
                "isRequired": bool(a["is_required"]),
                "isFilterable": bool(a["is_filterable"]),
                "valueRange": a["value_range"],
                "fromCategory": c["name"],
            })
    return {"categoryId": category_id, "categoryName": chain[-1]["name"] if chain else "", "fields": fields}
