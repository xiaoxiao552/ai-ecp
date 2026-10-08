# -*- coding: utf-8 -*-
"""
商品图片生成（占位图，零外部依赖）
- 按品类决定主色与图标，按 product_id 做色彩偏移，保证同一商品图片稳定、不同商品有区分。
- 输出为 SVG 文本，由 Flask 以 image/svg+xml 返回；前端 <img> 直接引用。
- 这样无需准备真实商品图即可获得“有图片展示”的浏览体验，且对后台新发布商品同样生效。
"""
import html

# 品类关键词 -> (emoji 图标, 主色, 辅色)
_CATEGORY_STYLE = [
    (("手机", "phone", "旗舰", "中端", "折叠"), "📱", "#1f4e79", "#4a90d9"),
    (("配件", "acc", "耳机", "充电", "壳", "线"), "🎧", "#0f6f6b", "#3fb8af"),
    (("图书", "book", "书"), "📚", "#8a5a2b", "#d39b5a"),
    (("穿戴", "watch", "手环", "band"), "⌚", "#5b3a8a", "#9b6fd0"),
    (("电脑", "平板", "pc", "pad"), "💻", "#2c5e3a", "#5fae6f"),
]


def _style_for(category_name: str, title: str):
    key = (category_name or "") + " " + (title or "")
    for keys, emoji, c1, c2 in _CATEGORY_STYLE:
        for k in keys:
            if k in key:
                return emoji, c1, c2
    return "🛍️", "#34495e", "#7f8c9a"


def _wrap(text: str, n: int = 9):
    lines, cur = [], ""
    for ch in (text or ""):
        cur += ch
        if len(cur) >= n:
            lines.append(cur)
            cur = ""
    if cur:
        lines.append(cur)
    return lines[:3]  # 最多 3 行


def build_svg(product_id: int, title: str, category_name: str) -> str:
    emoji, c1, c2 = _style_for(category_name, title)
    # 基于 product_id 的色相轻微偏移，增强区分度
    shift = (product_id * 37) % 360
    grad_id = f"g{product_id}"
    lines = _wrap(title or "商品", 9)
    # 标题文字（SVG 中需转义）
    tspans = "".join(
        f'<tspan x="400" dy="{0 if i == 0 else 64}">{html.escape(ln)}</tspan>'
        for i, ln in enumerate(lines)
    )
    angle = (shift % 60) - 30
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="{html.escape(title or '商品')}">
  <defs>
    <linearGradient id="{grad_id}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate({angle} .5 .5)">
      <stop offset="0" stop-color="{c1}"/>
      <stop offset="1" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#{grad_id})"/>
  <circle cx="400" cy="300" r="180" fill="#ffffff" opacity="0.12"/>
  <circle cx="400" cy="300" r="130" fill="#ffffff" opacity="0.10"/>
  <text x="400" y="300" font-size="150" text-anchor="middle" dominant-baseline="central">{emoji}</text>
  <text x="400" y="600" font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle"
        font-family="Microsoft YaHei, PingFang SC, sans-serif">{tspans}</text>
  <text x="400" y="740" font-size="26" fill="#ffffff" opacity="0.8" text-anchor="middle"
        font-family="Microsoft YaHei, PingFang SC, sans-serif">智选云 AI 电商</text>
</svg>'''
    return svg
