/* 智选云 AI 电商在线售货系统 —— 纯静态前端（无服务器，数据/交互由本地 Store 提供）
 * 路由：#/ 首页 | #/products 商品 | #/product/:id 详情 | #/cart 购物车 |
 *       #/checkout 结算 | #/orders 订单 | #/user 用户中心 | #/login 登录 | #/admin 商家后台
 */
(function () {
  "use strict";
  const S = window.Store, DB = window.DB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  const money = n => "¥" + (Number(n || 0)).toFixed(2);
  const STATUS = { 10: "待支付", 20: "已支付", 30: "待发货", 40: "已发货", 50: "已完成", 60: "已关闭", 70: "退款中", 80: "售后中", 90: "已退款" };
  const STATUS_CLS = { 10: "orange", 20: "blue", 30: "blue", 40: "blue", 50: "green", 60: "red", 70: "red", 80: "orange", 90: "red" };

  const state = { user: null, categories: [], prodFilter: { keyword: "", categoryId: "", minPrice: "", maxPrice: "", attrs: {}, sort: "new" }, buyNow: null, cartCount: 0, authMode: "login", adminTab: "dashboard", ucTab: "overview", chatSession: null };

  /* ---------------- 工具 ---------------- */
  function toast(msg, type = "ok") {
    const wrap = $("#toastWrap"); if (!wrap) return;
    const d = document.createElement("div"); d.className = "toast " + (type === "err" ? "err" : type === "info" ? "info" : "ok");
    d.textContent = msg; wrap.appendChild(d); setTimeout(() => { d.style.opacity = "0"; setTimeout(() => d.remove(), 250); }, 2600);
  }
  function flatCats(list, out) { list.forEach(c => { out.push(c); if (c.children) flatCats(c.children, out); }); return out; }
  function allLeafIds() { const f = flatCats(state.categories, []); return f.filter(c => c.isLeaf).map(c => c.categoryId); }
  function catColor(id) { const c = DB.catById(Number(id)); return (c && c.color) || "#4a90d9"; }
  function catEmoji(id) { const c = DB.catById(Number(id)); return (c && c.emoji) || "🛍️"; }
  function thumb(p, big) {
    const color = catColor(p.categoryId);
    return `<div class="thumb" style="background:linear-gradient(135deg,${color},${color}aa)"><span class="emoji">${esc(p.emoji || catEmoji(p.categoryId))}</span></div>`;
  }
  function requireLogin(redirect) {
    if (state.user) return true;
    state.redirect = redirect || location.hash.slice(1) || "/";
    location.hash = "#/login"; return false;
  }

  /* ---------------- 导航 ---------------- */
  async function updateNav() {
    const r = await S.auth.me(); state.user = r.data.user;
    const badge = $("#cartBadge");
    const isMerchant = state.user && (state.user.role === "merchant" || state.user.role === "admin");
    $("#navAdmin").classList.toggle("hidden", !isMerchant);
    $("#drawerAdmin").classList.toggle("hidden", !isMerchant);
    const navUser = $("#navUser"), drUser = $("#drawerUser");
    if (state.user) {
      navUser.innerHTML = `<span class="tag blue">${esc(state.user.nickname)}</span><button class="navlink" id="logoutBtn">退出</button>`;
      drUser.innerHTML = `<button class="navlink" id="drLogout" style="border:none;background:none;color:var(--red);width:100%;text-align:left">退出登录</button>`;
      $("#logoutBtn").onclick = logout; $("#drLogout").onclick = logout;
      const c = await S.cart.list(); state.cartCount = c.data.count || 0;
      if (badge) { badge.textContent = state.cartCount; badge.classList.toggle("hidden", state.cartCount === 0); }
    } else {
      navUser.innerHTML = `<a href="#/login" class="navlink" style="border:none;background:none;color:var(--accent)">登录/注册</a>`;
      drUser.innerHTML = `<a href="#/login">登录 / 注册</a>`;
      if (badge) badge.classList.add("hidden");
    }
  }
  function logout() { S.auth.logout(); state.user = null; location.hash = "#/"; updateNav(); router(); }
  function setActiveNav() {
    const path = (location.hash.replace(/^#\//, "").split("?")[0]) || "/";
    $$("#nav a[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === "/" + (path.split("/")[0] || "")));
    $$("#drawer a[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === "/" + (path.split("/")[0] || "")));
  }

  /* ---------------- 商品卡片 ---------------- */
  function productCard(p) {
    const price = p.min_price != null ? money(p.min_price) : "—";
    const market = (p.max_price && p.max_price !== p.min_price) ? `<small>${money(p.max_price)}</small>` : "";
    const tags = (p.tags || []).map(t => `<span class="tag ai">${esc(t)}</span>`).join("");
    return `<a class="pcard" href="#/product/${p.productId}">
      ${thumb(p)}
      <div class="body">
        <div class="tags">${tags}</div>
        <p class="title">${esc(p.title)}</p>
        <div class="price">${price}${market}</div>
        <div class="meta">可用库存 ${p.available != null ? p.available : "?"} 件 ｜ 销量 ${p.sales || 0}</div>
        <div class="foot"></div>
      </div></a>`;
  }

  /* ---------------- 首页 ---------------- */
  async function renderHome() {
    const app = $("#app");
    app.innerHTML = `
    <section class="hero"><div class="wrap" style="padding:0">
      <h1>智选云 AI 电商在线售货系统</h1>
      <p class="lede">支持 <strong>智能客服</strong>、<strong>智能选品</strong>、<strong>智能组货</strong> 三项 AI 能力的电商在线售货系统；商品品类可由商家以 JSON 自定义，系统自动生成属性 Schema 与动态发布表单。本站点为纯静态实现，数据本地模拟，可离线运行。</p>
      <div class="cta"><a class="btn primary" href="#/products">浏览商品</a><a class="btn" href="#/user">进入用户中心</a><button class="btn ghost" id="tryDemo">一键体验</button></div>
      <div class="ai-badges"><span class="b">🤖 智能客服</span><span class="b">🎯 智能选品</span><span class="b">🧩 智能组货</span><span class="b">📦 品类 JSON 自定义</span></div>
    </div></section>
    <div class="catnav" id="catnav"></div>
    <div class="section"><div class="head"><h2>精选商品</h2><a href="#/products">查看全部 →</a></div><div class="grid" id="featured"></div></div>
    <div class="section" id="recSection"><div class="head"><h2>✨ AI 智能选品 · 为你推荐</h2><a href="#/products">更多 →</a></div><div class="grid" id="rec"></div></div>`;
    // 品类导航
    const flat = flatCats(state.categories, []);
    $("#catnav").innerHTML = `<span class="chip" data-cat="">全部</span>` + flat.map(c => `<span class="chip" data-cat="${c.categoryId}">${c.emoji || ""} ${esc(c.name)}</span>`).join("");
    $$("#catnav .chip").forEach(ch => ch.onclick = () => { state.prodFilter.categoryId = ch.dataset.cat; location.hash = "#/products"; });
    $("#tryDemo").onclick = async () => { const r = await S.auth.login({ mobile: "13700000000", password: "user123" }); if (r.ok) { toast("已以体验账号登录"); updateNav(); } };
    // 精选
    const prods = await S.products.list({ sort: "sales" });
    $("#featured").innerHTML = (prods.ok ? prods.data.items.slice(0, 8) : []).map(productCard).join("");
    // AI 推荐
    const rec = await S.ai.recommend({ scene: "home" });
    if (rec.ok && rec.data.items.length) $("#rec").innerHTML = rec.data.items.map(productCard).join("");
    else $("#recSection").classList.add("hidden");
  }

  /* ---------------- 商品列表 / 搜索筛选 ---------------- */
  async function computeFacets(categoryId) {
    const r = await S.products.list({ categoryId: categoryId || "" });
    const leaves = categoryId ? DB.leafIdsUnder(Number(categoryId)) : allLeafIds();
    const defs = [];
    leaves.forEach(lid => { const c = DB.catById(lid); (c.attrs || []).forEach(a => { if (a.isFilterable && a.dataType === "enum" && !defs.find(d => d.attrCode === a.attrCode)) defs.push(a); }); });
    return defs.map(a => {
      const values = Array.from(new Set(r.data.items.filter(p => p.attrs && p.attrs[a.attrCode]).map(p => p.attrs[a.attrCode])));
      return { attrCode: a.attrCode, attrName: a.attrName, values };
    }).filter(a => a.values.length);
  }
  async function renderProducts() {
    const app = $("#app");
    app.innerHTML = `
    <div class="section">
      <h2>商品浏览与搜索</h2>
      <div class="bar">
        <input id="kw" class="grow kw" style="border:1px solid var(--line-2);border-radius:999px;font-family:inherit;font-size:14.5px" placeholder="搜索商品名称 / 规格 / 属性…" value="${esc(state.prodFilter.keyword)}">
        <select id="sort" style="padding:11px 13px;border:1px solid var(--line-2);border-radius:8px;font-family:inherit">
          <option value="new">最新</option><option value="price_asc">价格升</option><option value="price_desc">价格降</option><option value="sales">销量</option></select>
        <button class="btn primary" id="search">搜索</button>
      </div>
      <div class="products-layout">
        <aside class="filters" id="filters"></aside>
        <div><div class="grid" id="grid"></div></div>
      </div>
    </div>`;
    $("#sort").value = state.prodFilter.sort;
    const load = async () => {
      const grid = $("#grid"), params = { ...state.prodFilter };
      const r = await S.products.list(params);
      grid.innerHTML = r.ok ? (r.data.items.length ? r.data.items.map(productCard).join("") : `<p class="muted" style="grid-column:1/-1">没有找到匹配的商品，试试调整筛选条件。</p>`)
        : `<p class="err">${esc(r.data.error || "加载失败")}</p>`;
    };
    const drawFilters = async () => {
      const f = $("#filters");
      const flat = flatCats(state.categories, []);
      const topCats = state.categories;
      let html = `<h3>分类</h3><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">`;
      html += `<span class="opt ${!state.prodFilter.categoryId ? "active" : ""}" data-cat="">全部商品</span>`;
      topCats.forEach(c => {
        html += `<div style="font-weight:700;color:var(--ink-2);font-size:13px;margin-top:8px">${c.emoji || ""} ${esc(c.name)}</div>`;
        (c.children || []).forEach(leaf => { html += `<span class="opt ${String(state.prodFilter.categoryId) === String(leaf.categoryId) ? "active" : ""}" data-cat="${leaf.categoryId}" style="margin-left:8px">${esc(leaf.name)}</span>`; });
      });
      html += `</div>`;
      // 价格
      html += `<div class="facet"><div class="facet-title">价格区间（¥）</div><div class="price-range">
        <input id="pmin" type="number" placeholder="最低" value="${esc(state.prodFilter.minPrice)}">
        <span>—</span>
        <input id="pmax" type="number" placeholder="最高" value="${esc(state.prodFilter.maxPrice)}"></div></div>`;
      // 属性 facet
      const facets = await computeFacets(state.prodFilter.categoryId);
      facets.forEach(fa => {
        html += `<div class="facet"><div class="facet-title">${esc(fa.attrName)}</div><div class="facet-opts">`;
        (fa.values || []).forEach(v => {
          const sel = (state.prodFilter.attrs[fa.attrCode] || []).indexOf(v) >= 0;
          html += `<span class="opt ${sel ? "active" : ""}" data-attr="${fa.attrCode}" data-val="${esc(v)}">${esc(v)}</span>`;
        });
        html += `</div></div>`;
      });
      f.innerHTML = html;
      const pmin = $("#pmin"), pmax = $("#pmax");
      if (pmin) pmin.onchange = () => { state.prodFilter.minPrice = pmin.value; load(); };
      if (pmax) pmax.onchange = () => { state.prodFilter.maxPrice = pmax.value; load(); };
      $$("#filters [data-cat]").forEach(el => el.onclick = () => { state.prodFilter.categoryId = el.dataset.cat; state.prodFilter.attrs = {}; drawFilters(); load(); });
      $$("#filters [data-attr]").forEach(el => el.onclick = () => {
        const code = el.dataset.attr, val = el.dataset.val;
        state.prodFilter.attrs[code] = state.prodFilter.attrs[code] || [];
        const i = state.prodFilter.attrs[code].indexOf(val);
        if (i >= 0) state.prodFilter.attrs[code].splice(i, 1); else state.prodFilter.attrs[code].push(val);
        if (!state.prodFilter.attrs[code].length) delete state.prodFilter.attrs[code];
        drawFilters(); load();
      });
    };
    $("#search").onclick = () => { state.prodFilter.keyword = $("#kw").value.trim(); state.prodFilter.sort = $("#sort").value; load(); };
    $("#kw").addEventListener("keydown", e => { if (e.key === "Enter") $("#search").click(); });
    await drawFilters(); load();
  }

  /* ---------------- 商品详情 ---------------- */
  let curProduct = null, curSku = null;
  async function renderProduct(id) {
    const app = $("#app");
    app.innerHTML = `<div class="section"><p class="muted">加载中…</p></div>`;
    const r = await S.products.get(id);
    if (!r.ok) { app.innerHTML = `<div class="section"><p class="err">${esc(r.data.error || "加载失败")}</p></div>`; return; }
    curProduct = r.data.product; curSku = curProduct.skus[0];
    const p = curProduct;
    const skusHtml = p.skus.map((s, i) => `<span class="sku ${i === 0 ? "active" : ""}" data-sk="${s.skuId}">${esc(s.specText || "默认")} · ${money(s.salePrice)}</span>`).join("");
    const color = catColor(p.categoryId);
    app.innerHTML = `
    <div class="detail">
      <div class="gallery" style="background:linear-gradient(135deg,${color},${color}aa)">${esc(p.emoji || catEmoji(p.categoryId))}</div>
      <div>
        <div class="tags">${(p.tags || []).map(t => `<span class="tag ai">${esc(t)}</span>`).join("")}<span class="tag">评分 ${p.rating}</span></div>
        <h1>${esc(p.title)}</h1>
        <div class="price">${money(curSku.salePrice)}<small>${curSku.market_price ? money(curSku.market_price) : ""}</small></div>
        <p class="sub">分类：${esc(catName(p.categoryId))} ｜ 可用库存：<span id="avail">${curSku.available}</span> 件 ｜ 销量 ${p.sales}</p>
        <p class="desc">${esc(p.desc || "")}</p>
        <div class="field"><label>选择规格</label><div class="skus" id="skus">${skusHtml}</div></div>
        <div class="field"><label>数量</label>
          <div class="qty"><button id="minus">−</button><input id="qty" value="1"><button id="plus">+</button></div></div>
        <div class="bar">
          <button class="btn primary" id="addCart">加入购物车</button>
          <button class="btn" id="buyNow">立即购买</button>
          <button class="btn ghost" id="fav">★ 收藏</button>
        </div>
        <div class="panel"><h3>🔗 AI 智能组货建议</h3><div id="bundleBox"><p class="muted">加载中…</p></div></div>
      </div>
    </div>`;
    $$("#skus .sku").forEach(el => el.onclick = () => {
      $$("#skus .sku").forEach(x => x.classList.remove("active"));
      el.classList.add("active");
      curSku = p.skus.find(s => String(s.skuId) === el.dataset.sk);
      $(".detail .price").innerHTML = `${money(curSku.salePrice)}<small>${curSku.market_price ? money(curSku.market_price) : ""}</small>`;
      $("#avail").textContent = curSku.available;
    });
    $("#minus").onclick = () => { $("#qty").value = Math.max(1, (+$("#qty").value) - 1); };
    $("#plus").onclick = () => { $("#qty").value = (+$("#qty").value) + 1; };
    $("#addCart").onclick = async () => {
      const r2 = await S.cart.add({ skuId: curSku.skuId, quantity: +$("#qty").value, source: "manual" });
      if (!r2.ok) return toast(r2.data.error || "加购失败", "err");
      toast("已加入购物车"); updateNav();
    };
    $("#buyNow").onclick = () => { if (!requireLogin("#/checkout")) return; state.buyNow = [{ productId: p.productId, skuId: curSku.skuId, quantity: +$("#qty").value, source: "manual" }]; location.hash = "#/checkout"; };
    $("#fav").onclick = async () => { const t = await S.user.toggleFavorite(p.productId); toast(t.data.favorited ? "已收藏" : "已取消收藏"); };
    // 组货
    const b = r.data.bundle;
    $("#bundleBox").innerHTML = bundleHtml(b);
  }
  function catName(id) { const c = DB.catById(Number(id)); return c ? c.name : "-"; }
  function bundleHtml(b) {
    if (!b) return `<p class="muted">暂无组货建议</p>`;
    if (b.degraded) return `<p class="tag orange">⚠ 已降级</p><p class="muted">${esc(b.degradeReason)}。为你推荐：</p>` +
      (b.items || []).map(i => `<div class="bi">${esc(i.title)} · ${money(i.min_price || i.price || 0)}</div>`).join("");
    const items = (b.bundle.items || []).map(i => `<div class="bi">${esc(i.title)} · ${money(i.price)}</div>`).join(" ＋ ");
    return `<p>${esc(b.bundle.reason)}</p>
      <div class="bundle-items">${items}</div>
      <p class="price" style="font-size:18px">组合价 ${money(b.bundle.price)} ｜ 预估毛利 ${((b.bundle.grossRate || 0) * 100).toFixed(1)}% ｜ 场景：${esc(b.bundle.sceneTag || "")}</p>`;
  }

  /* ---------------- 购物车 ---------------- */
  async function renderCart() {
    const app = $("#app");
    const r = await S.cart.list();
    if (!r.ok) { app.innerHTML = `<div class="section"><p class="err">${esc(r.data.error || "加载失败")}</p></div>`; return; }
    const items = r.data.items;
    app.innerHTML = `<div class="section"><h2>购物车</h2>
      <div id="cartList">${items.length ? "" : `<div class="empty"><div class="big">🛒</div>购物车是空的，<a href="#/products">去逛逛</a>。</div>`}</div>
      ${items.length ? `<div class="cart-summary"><span class="grow"></span><span>共 ${r.data.count} 件，合计：</span><span class="total">${money(r.data.total)}</span>
        <button class="btn primary lg" id="checkout">去结算</button></div>` : ""}</div>`;
    items.forEach(it => {
      const row = document.createElement("div"); row.className = "list-row";
      row.innerHTML = `${thumb(it)}
        <div class="info"><p class="t">${esc(it.title)}</p><p class="s">${esc(it.spec_text || "")} ｜ 单价 ${money(it.sale_price)} ｜ 可用 ${it.available}</p></div>
        <div class="qty"><button data-act="minus" data-id="${it.cart_item_id}">−</button><input value="${it.quantity}" data-id="${it.cart_item_id}" class="qinput" style="width:46px;text-align:center;border:none;font-size:15px" readonly><button data-act="plus" data-id="${it.cart_item_id}">+</button></div>
        <div class="price">${money(it.sale_price * it.quantity)}</div>
        <button class="btn danger sm" data-del="${it.cart_item_id}">删除</button>`;
      $("#cartList").appendChild(row);
    });
    $$("[data-act]").forEach(b => b.onclick = async () => {
      const id = b.dataset.id, cur = +b.parentElement.querySelector(".qinput").value;
      const q = b.dataset.act === "plus" ? cur + 1 : Math.max(1, cur - 1);
      await S.cart.update(id, q); renderCart(); updateNav();
    });
    $$("[data-del]").forEach(b => b.onclick = async () => { await S.cart.remove(b.dataset.del); renderCart(); updateNav(); });
    const co = $("#checkout");
    if (co) co.onclick = () => { if (!requireLogin("#/checkout")) return; state.buyNow = null; location.hash = "#/checkout"; };
  }

  /* ---------------- 结算（下单 + 模拟支付） ---------------- */
  async function loadCheckoutItems() {
    if (state.buyNow && state.buyNow.length) {
      const lines = [];
      for (const l of state.buyNow) { const r = await S.products.get(l.productId); if (r.ok) { const s = r.data.product.skus.find(x => x.skuId === l.skuId); lines.push({ productId: l.productId, skuId: l.skuId, quantity: l.quantity, title: r.data.product.title, emoji: r.data.product.emoji, spec_text: s.specText, sale_price: s.salePrice, available: s.available }); } }
      return { lines, fromCart: false };
    }
    const c = await S.cart.list();
    return { lines: c.data.items.map(it => ({ productId: it.productId, skuId: it.skuId, quantity: it.quantity, title: it.title, emoji: it.emoji, spec_text: it.spec_text, sale_price: it.sale_price, available: it.available, cart_item_id: it.cart_item_id })), fromCart: true, total: c.data.total };
  }
  async function renderCheckout() {
    if (!requireLogin("#/checkout")) return;
    const app = $("#app");
    app.innerHTML = `<div class="section"><p class="muted">加载中…</p></div>`;
    const { lines, fromCart } = await loadCheckoutItems();
    if (!lines.length) { app.innerHTML = `<div class="section"><div class="empty"><div class="big">🧾</div>没有可结算的商品，<a href="#/products">去选购</a>。</div></div>`; return; }
    const addrR = await S.user.addresses();
    const addrs = addrR.data.addresses || [];
    let selAddr = addrs.find(a => a.isDefault) || addrs[0] || null;
    const coupon = 20; // 新人无门槛券
    const subtotal = lines.reduce((s, l) => s + l.sale_price * l.quantity, 0);
    const total = Math.max(0, subtotal - coupon);
    const itemsHtml = lines.map(l => `<div class="co-item">${thumb(l)}<div class="t">${esc(l.title)}<br><small class="muted">${esc(l.spec_text || "")} ×${l.quantity}</small></div><div class="p">${money(l.sale_price * l.quantity)}</div></div>`).join("");
    const addrHtml = addrs.length ? addrs.map(a => `<div class="addr-card ${selAddr && selAddr.addrId === a.addrId ? "active" : ""}" data-addr="${a.addrId}"><div><b>${esc(a.name)}</b> ${esc(a.phone)}<br><small class="muted">${esc(a.detail)}</small></div><span class="tick">${selAddr && selAddr.addrId === a.addrId ? "✓" : ""}</span></div>`).join("") + `<button class="btn ghost sm" id="addAddr" style="margin-top:8px">+ 新增收货地址</button>` : `<button class="btn primary sm" id="addAddr">+ 新增收货地址</button>`;
    app.innerHTML = `
    <div class="section"><h2>结算下单</h2>
      <div class="checkout-grid">
        <div>
          <div class="box"><h3>收货地址</h3><div id="addrList">${addrHtml}</div></div>
          <div class="box"><h3>商品清单</h3>${itemsHtml}</div>
        </div>
        <div>
          <div class="box"><h3>支付方式</h3><div class="pay-method" id="payMethod">
            <div class="pm active" data-pm="balance">💰 余额支付（模拟）</div>
            <div class="pm" data-pm="wechat">💚 微信支付</div>
            <div class="pm" data-pm="alipay">🔵 支付宝</div></div>
            <p class="muted" style="margin-top:10px;font-size:12.5px">本站点为演示，所有支付均为模拟，点击「提交订单」即视为支付成功。</p></div>
          <div class="box"><h3>金额明细</h3>
            <div class="summary-line"><span>商品小计</span><span>${money(subtotal)}</span></div>
            <div class="summary-line"><span>优惠券（新人无门槛）</span><span style="color:var(--green)">- ${money(coupon)}</span></div>
            <div class="summary-line total"><span>应付总额</span><span>${money(total)}</span></div>
            <button class="btn primary block lg" id="submitOrder" style="margin-top:12px">提交订单并支付</button>
            <button class="btn ghost block" id="backCart" style="margin-top:8px">返回购物车</button>
          </div>
        </div>
      </div></div>`;
    let payMethod = "balance";
    $$("#payMethod .pm").forEach(el => el.onclick = () => { $$("#payMethod .pm").forEach(x => x.classList.remove("active")); el.classList.add("active"); payMethod = el.dataset.pm; });
    $$("#addrList [data-addr]").forEach(el => el.onclick = () => { selAddr = addrs.find(a => a.addrId === el.dataset.addr); $$("#addrList .addr-card").forEach(x => { x.classList.remove("active"); x.querySelector(".tick").textContent = ""; }); el.classList.add("active"); el.querySelector(".tick").textContent = "✓"; });
    $("#addAddr").onclick = () => openAddrModal(selAddr, async () => { const r2 = await S.user.addresses(); const a2 = r2.data.addresses; selAddr = a2.find(a => a.isDefault) || a2[0]; renderCheckout(); });
    $("#backCart").onclick = () => location.hash = "#/cart";
    $("#submitOrder").onclick = async () => {
      const btn = $("#submitOrder"); btn.disabled = true; btn.textContent = "处理中…";
      const orderItems = lines.map(l => ({ productId: l.productId, skuId: l.skuId, quantity: l.quantity, source: "manual" }));
      const cr = await S.orders.create({ items: orderItems, address: selAddr ? (selAddr.name + " " + selAddr.phone + " " + selAddr.detail) : "演示地址", coupon });
      if (!cr.ok) { toast(cr.data.error || "下单失败", "err"); btn.disabled = false; btn.textContent = "提交订单并支付"; return; }
      const pr = await S.pay.create({ orderId: cr.data.orderId, channel: payMethod });
      const nr = await S.pay.notify({ orderId: cr.data.orderId, tradeNo: pr.data.tradeNo });
      if (!nr.ok) { toast(nr.data.error || "支付失败", "err"); btn.disabled = false; btn.textContent = "提交订单并支付"; return; }
      if (fromCart) await S.cart.clear(lines.map(l => l.cart_item_id));
      state.buyNow = null; updateNav();
      toast("✅ 支付成功，库存已扣减并触发履约！");
      location.hash = "#/orders"; setTimeout(router, 400);
    };
  }
  function openAddrModal(existing, onSaved) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(22,32,43,.5);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px";
    overlay.innerHTML = `<div class="auth-wrap" style="margin:0;max-width:460px;width:100%"><h2>${existing ? "编辑" : "新增"}收货地址</h2>
      <div class="field"><label>收货人</label><input id="aName" value="${existing ? esc(existing.name) : ""}"></div>
      <div class="field"><label>手机号</label><input id="aPhone" value="${existing ? esc(existing.phone) : ""}"></div>
      <div class="field"><label>详细地址</label><input id="aDetail" value="${existing ? esc(existing.detail) : ""}"></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink-2)"><input type="checkbox" id="aDef" ${existing && existing.isDefault ? "checked" : ""}> 设为默认地址</label>
      <div class="bar"><span class="grow"></span><button class="btn primary" id="saveAddr">保存</button><button class="btn ghost" id="closeAddr">取消</button></div></div>`;
    document.body.appendChild(overlay);
    $("#closeAddr", overlay).onclick = () => overlay.remove();
    $("#saveAddr", overlay).onclick = async () => {
      const a = { name: $("#aName", overlay).value.trim(), phone: $("#aPhone", overlay).value.trim(), detail: $("#aDetail", overlay).value.trim(), isDefault: $("#aDef", overlay).checked };
      if (existing) a.addrId = existing.addrId;
      const r = await S.user.saveAddress(a);
      if (r.ok) { overlay.remove(); onSaved && onSaved(); }
    };
  }

  /* ---------------- 我的订单 ---------------- */
  async function renderOrders() {
    if (!requireLogin("#/orders")) return;
    const app = $("#app");
    const r = await S.orders.list();
    const orders = r.ok ? r.data.orders : [];
    const tabs = [["all", "全部"], ["10", "待支付"], ["20", "待发货"], ["40", "待收货"], ["50", "已完成"], ["60", "已关闭"]];
    app.innerHTML = `<div class="section"><h2>我的订单</h2>
      <div class="order-tabs" id="oTabs">${tabs.map(t => `<button data-st="${t[0]}">${t[1]}</button>`).join("")}</div>
      <div id="orderList">${orders.length ? "" : `<div class="empty"><div class="big">📦</div>还没有订单，<a href="#/products">去下单</a>。</div>`}</div></div>`;
    let cur = "all";
    const draw = () => {
      const list = cur === "all" ? orders : orders.filter(o => String(o.status) === cur);
      $("#orderList").innerHTML = list.length ? list.map(orderCard).join("") : `<div class="empty"><div class="big">📦</div>该分类下暂无订单。</div>`;
      bindOrderActions();
    };
    $$("#oTabs button").forEach(b => b.onclick = () => { cur = b.dataset.st; $$("#oTabs button").forEach(x => x.classList.remove("active")); b.classList.add("active"); draw(); });
    $$("#oTabs button")[0].classList.add("active");
    draw();
  }
  function orderCard(o) {
    const items = (o.items || []).map(i => `<div class="bi">${thumb(i)}<div class="t">${esc(i.title)}<br><small class="muted">${esc(i.spec_text || "")} ×${i.quantity}</small></div><div class="q"></div></div>`).join("");
    let acts = "";
    if (o.status === 10) acts = `<button class="btn primary sm" data-pay="${o.order_id}">去支付</button><button class="btn danger sm" data-cancel="${o.order_id}">取消</button>`;
    if (o.status === 40) acts = `<button class="btn primary sm" data-confirm="${o.order_id}">确认收货</button>`;
    if (o.status === 50) acts = `<button class="btn sm" data-review="${o.order_id}">评价</button>`;
    return `<div class="order-card">
      <div class="oh"><span class="no">订单 ${esc(o.order_no)}</span><span class="addr">${esc(o.address || "")} ｜ ${esc((o.created_at || "").slice(0, 10))}</span>
        <span class="sp"><span class="tag ${STATUS_CLS[o.status] || ""}">${STATUS[o.status] || "未知"}</span></span>
        <span class="price">${money(o.pay_amount)}</span></div>
      <div class="order-items">${items}</div>
      ${o.tracking_no ? `<div class="tracking">运单号：${esc(o.tracking_no)}</div>` : ""}
      <div class="order-actions">${acts}</div></div>`;
  }
  function bindOrderActions() {
    $$("[data-pay]").forEach(b => b.onclick = async () => {
      const oid = b.dataset.pay;
      const all = (await S.orders.list()).data.orders;
      const o = all.find(x => x.order_id === oid);
      if (!o) return;
      const pr = await S.pay.create({ orderId: oid, channel: "balance" });
      const nr = await S.pay.notify({ orderId: oid, tradeNo: pr.data.tradeNo });
      if (nr.ok) { toast("✅ 支付成功，库存已扣减并触发履约"); renderOrders(); }
      else toast(nr.data.error || "支付失败", "err");
    });
    $$("[data-cancel]").forEach(b => b.onclick = async () => { const r = await S.orders.cancel(b.dataset.cancel); if (r.ok) { toast("订单已关闭"); renderOrders(); } else toast(r.data.error, "err"); });
    $$("[data-confirm]").forEach(b => b.onclick = async () => { const r = await S.orders.confirm(b.dataset.confirm); if (r.ok) { toast("交易完成"); renderOrders(); } else toast(r.data.error, "err"); });
    $$("[data-review]").forEach(b => b.onclick = () => openReviewModal(b.dataset.review));
  }
  function openReviewModal(orderId) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(22,32,43,.5);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px";
    overlay.innerHTML = `<div class="auth-wrap" style="margin:0;max-width:440px;width:100%"><h2>发表评价</h2>
      <div class="field"><label>评分</label><select id="rvRating"><option value="5">★★★★★ 5 分</option><option value="4">★★★★ 4 分</option><option value="3">★★★ 3 分</option><option value="2">★★ 2 分</option><option value="1">★ 1 分</option></select></div>
      <div class="field"><label>评价内容</label><textarea id="rvContent" placeholder="说说使用感受…" style="min-height:90px"></textarea></div>
      <div class="bar"><span class="grow"></span><button class="btn primary" id="rvSave">提交</button><button class="btn ghost" id="rvClose">取消</button></div></div>`;
    document.body.appendChild(overlay);
    $("#rvClose", overlay).onclick = () => overlay.remove();
    $("#rvSave", overlay).onclick = async () => {
      const r = await S.user.addReview({ orderId, rating: +$("#rvRating", overlay).value, content: $("#rvContent", overlay).value.trim(), title: "" });
      if (r.ok) { overlay.remove(); toast("评价已提交"); }
    };
  }

  /* ---------------- 用户中心 ---------------- */
  async function renderUser() {
    if (!requireLogin("#/user")) return;
    const app = $("#app");
    const tabs = [["overview", "概览"], ["profile", "个人资料"], ["orders", "我的订单"], ["addresses", "收货地址"], ["favorites", "我的收藏"], ["reviews", "我的评价"]];
    app.innerHTML = `<div class="section"><h2>用户中心</h2>
      <div class="uc"><aside class="uc-side"><div class="uc-name"><div class="avatar" id="ucAvatar"></div><div><b id="ucNick"></b><br><small class="muted" id="ucRole"></small></div></div>
        <div id="ucNav">${tabs.map(t => `<span class="nav-item ${state.ucTab === t[0] ? "active" : ""}" data-tab="${t[0]}">${t[1]}</span>`).join("")}</div></aside>
      <div class="uc-content" id="ucContent"></div></div></div>`;
    $("#ucNick").textContent = state.user.nickname;
    $("#ucAvatar").textContent = (state.user.nickname || "U").slice(0, 1);
    $("#ucRole").textContent = ({ consumer: "普通会员", merchant: "商家", admin: "管理员" }[state.user.role] || "") + " · " + "Lv." + (state.user.memberLevel || 1);
    $$("#ucNav .nav-item").forEach(el => el.onclick = () => { state.ucTab = el.dataset.tab; renderUser(); });
    const box = $("#ucContent");
    if (state.ucTab === "overview") {
      const d = await S.user.dashboard();
      box.innerHTML = `<div class="box"><h3>账户概览</h3><div class="stat-grid">
        <div class="stat-cell"><b>${d.data.orderCount}</b><span>我的订单</span></div>
        <div class="stat-cell"><b>${money(d.data.paidAmount)}</b><span>累计支付</span></div>
        <div class="stat-cell"><b>${d.data.pendingPay}</b><span>待支付</span></div>
        <div class="stat-cell"><b>${d.data.favorites}</b><span>收藏</span></div>
        <div class="stat-cell"><b>${d.data.coupons}</b><span>优惠券</span></div></div>
        <div class="panel" style="margin-top:12px"><h3>🎯 AI 智能选品</h3><div class="grid" id="ucRec" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))"></div></div></div>`;
      const rec = await S.ai.recommend({ scene: "home" });
      $("#ucRec").innerHTML = (rec.ok ? rec.data.items : []).map(p => `<a class="pcard" href="#/product/${p.productId}" style="min-width:0">${thumb(p)}<div class="body"><p class="title">${esc(p.title)}</p><div class="price">${money(p.min_price)}</div></div></a>`).join("");
    } else if (state.ucTab === "profile") {
      const p = state.user;
      box.innerHTML = `<div class="box"><h3>个人资料</h3>
        <div class="form-row">
          <div class="field"><label>昵称</label><input id="pNick" value="${esc(p.nickname)}"></div>
          <div class="field"><label>手机号</label><input value="${esc(p.mobile)}" disabled></div></div>
        <div class="form-row">
          <div class="field"><label>性别</label><select id="pGender"><option value="">不填</option><option value="男" ${p.gender === "男" ? "selected" : ""}>男</option><option value="女" ${p.gender === "女" ? "selected" : ""}>女</option></select></div>
          <div class="field"><label>生日</label><input id="pBirth" type="date" value="${esc(p.birthday || "")}"></div></div>
        <button class="btn primary" id="saveProfile">保存修改</button></div>`;
      $("#saveProfile").onclick = async () => {
        const r = await S.user.updateProfile({ nickname: $("#pNick").value.trim(), gender: $("#pGender").value, birthday: $("#pBirth").value });
        if (r.ok) { toast("资料已更新"); state.user = r.data.user; updateNav(); }
      };
    } else if (state.ucTab === "orders") {
      const r = await S.orders.list(); const orders = r.data.orders;
      box.innerHTML = `<div class="box"><h3>我的订单</h3>${orders.length ? orders.map(orderCard).join("") : `<div class="empty">暂无订单</div>`}</div>`;
      bindOrderActions();
    } else if (state.ucTab === "addresses") {
      const r = await S.user.addresses(); const addrs = r.data.addresses;
      box.innerHTML = `<div class="box"><h3>收货地址</h3><div id="addrWrap">${addrs.map(a => addrRow(a)).join("")}</div><button class="btn primary sm" id="addAddr2" style="margin-top:8px">+ 新增地址</button></div>`;
      bindAddrActions();
      $("#addAddr2").onclick = () => openAddrModal(null, () => renderUser());
    } else if (state.ucTab === "favorites") {
      const r = await S.user.favorites();
      box.innerHTML = `<div class="box"><h3>我的收藏</h3><div class="grid">${r.data.items.length ? r.data.items.map(p => `<div style="position:relative">${productCard(p)}<button class="btn danger sm" data-unfav="${p.productId}" style="position:absolute;top:8px;right:8px">取消</button></div>`).join("") : `<div class="empty">还没有收藏</div>`}</div></div>`;
      $$("[data-unfav]").forEach(b => b.onclick = async () => { await S.user.toggleFavorite(b.dataset.unfav); renderUser(); });
    } else if (state.ucTab === "reviews") {
      const r = await S.user.reviews();
      box.innerHTML = `<div class="box"><h3>我的评价</h3>${r.data.reviews.length ? r.data.reviews.map(rv => `<div class="list-row" style="flex-direction:column;align-items:stretch"><div><b>${"★".repeat(rv.rating)}</b> <span class="muted">订单 ${esc(rv.orderId)}</span></div><p style="margin:6px 0">${esc(rv.content)}</p></div>`).join("") : `<div class="empty">暂无评价</div>`}</div>`;
    }
  }
  function addrRow(a) { return `<div class="addr-card" data-addr="${a.addrId}"><div><b>${esc(a.name)}</b> ${esc(a.phone)} ${a.isDefault ? '<span class="tag green">默认</span>' : ''}<br><small class="muted">${esc(a.detail)}</small></div>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn ghost sm" data-edit="${a.addrId}">编辑</button><button class="btn danger sm" data-deladdr="${a.addrId}">删除</button></span></div>`; }
  function bindAddrActions() {
    $$("[data-edit]").forEach(b => b.onclick = () => { const id = b.dataset.edit; S.user.addresses().then(r => { const a = r.data.addresses.find(x => x.addrId === id); openAddrModal(a, () => renderUser()); }); });
    $$("[data-deladdr]").forEach(b => b.onclick = async () => { await S.user.removeAddress(b.dataset.deladdr); renderUser(); });
  }

  /* ---------------- 登录 / 注册 ---------------- */
  function renderLogin() {
    const app = $("#app");
    const redirect = state.redirect || "/";
    app.innerHTML = `
    <div class="auth-wrap">
      <h2>智选云 AI 电商</h2>
      <p class="sub">AI-ECP · 在线售货系统 · 纯静态演示站</p>
      <div class="seg">
        <button class="${state.authMode === "login" ? "active" : ""}" id="mLogin">登录</button>
        <button class="${state.authMode === "register" ? "active" : ""}" id="mReg">注册</button>
      </div>
      <div id="authForm"></div>
      <div class="hint">演示账号：消费者 13700000000 / user123 ｜ 商家 13900000000 / merch123 ｜ 管理员 13800000000 / admin123<br>或点击「注册」创建本地账号（数据保存在本浏览器）。</div>
    </div>`;
    const draw = () => {
      const f = $("#authForm");
      if (state.authMode === "login") {
        f.innerHTML = `<div class="field"><label>手机号</label><input id="mobile" placeholder="请输入手机号" value="13700000000"></div>
          <div class="field"><label>密码</label><input id="pwd" type="password" placeholder="请输入密码" value="user123"></div>
          <button class="btn primary block lg" id="submit" style="margin-top:6px">登录</button>`;
      } else {
        f.innerHTML = `<div class="field"><label>昵称</label><input id="nick" placeholder="昵称"></div>
          <div class="field"><label>手机号</label><input id="mobile" placeholder="至少6位"></div>
          <div class="field"><label>密码</label><input id="pwd" type="password" placeholder="至少6位"></div>
          <div class="field"><label>注册身份</label><select id="role"><option value="consumer">消费者（买家）</option><option value="merchant">商家</option></select></div>
          <button class="btn primary block lg" id="submit" style="margin-top:6px">注册并登录</button>`;
      }
      $("#submit").onclick = submitAuth;
    };
    $("#mLogin").onclick = () => { state.authMode = "login"; $("#mLogin").classList.add("active"); $("#mReg").classList.remove("active"); draw(); };
    $("#mReg").onclick = () => { state.authMode = "register"; $("#mReg").classList.add("active"); $("#mLogin").classList.remove("active"); draw(); };
    draw();
    async function submitAuth() {
      const mobile = $("#mobile").value.trim(), password = $("#pwd").value;
      let r;
      if (state.authMode === "login") r = await S.auth.login({ mobile, password });
      else r = await S.auth.register({ mobile, password, nickname: $("#nick").value.trim(), role: $("#role").value });
      if (!r.ok) { toast(r.data.error || "操作失败", "err"); return; }
      state.user = r.data.user; await updateNav();
      toast("登录成功"); location.hash = "#" + (redirect || "/"); router();
    }
  }

  /* ---------------- 商家后台 ---------------- */
  async function renderAdmin() {
    if (!requireLogin("#/admin")) return;
    if (!(state.user.role === "merchant" || state.user.role === "admin")) { $("#app").innerHTML = `<div class="section"><p class="err">仅商家 / 管理员可访问。</p></div>`; return; }
    const app = $("#app");
    const tabs = [["dashboard", "经营看板"], ["products", "商品管理"], ["orders", "订单管理"], ["category", "品类(JSON)"]];
    app.innerHTML = `<div class="section"><h2>商家 / 平台后台</h2>
      <div class="tabs" id="adTabs">${tabs.map(t => `<button data-t="${t[0]}" class="${state.adminTab === t[0] ? "active" : ""}">${t[1]}</button>`).join("")}</div>
      <div id="adminBody"></div></div>`;
    $$("#adTabs button").forEach(b => b.onclick = () => { state.adminTab = b.dataset.t; renderAdmin(); });
    if (state.adminTab === "dashboard") return renderAdminDashboard();
    if (state.adminTab === "products") return renderAdminProducts();
    if (state.adminTab === "orders") return renderAdminOrders();
    if (state.adminTab === "category") return renderAdminCategory();
  }
  async function renderAdminDashboard() {
    const b = $("#adminBody");
    const r = await S.orders.adminList();
    const products = (await S.products.list({})).data.items;
    const orders = r.data.orders;
    const paid = orders.filter(o => o.status >= 20).reduce((s, o) => s + o.pay_amount, 0);
    const byStatus = {}; orders.forEach(o => byStatus[STATUS[o.status] || o.status] = (byStatus[STATUS[o.status] || o.status] || 0) + 1);
    const byStatusHtml = Object.entries(byStatus).map(([k, v]) => `<div class="statcard"><b>${v}</b><span>${esc(k)}</span></div>`).join("");
    b.innerHTML = `<div class="statgrid">
      <div class="statcard"><b>${products.length}</b><span>商品数</span></div>
      <div class="statcard"><b>${orders.length}</b><span>订单数</span></div>
      <div class="statcard"><b>${money(paid)}</b><span>已支付金额</span></div>
      <div class="statcard"><b>${orders.filter(o => o.status === 20 || o.status === 30).length}</b><span>待发货</span></div>
      <div class="statcard"><b>${orders.filter(o => o.status === 40).length}</b><span>已发货</span></div>
      <div class="statcard"><b>${orders.filter(o => o.status === 50).length}</b><span>已完成</span></div></div>
      <h3 style="color:var(--accent);margin:18px 0 8px">订单状态分布</h3><div class="statgrid">${byStatusHtml || '<div class="muted">暂无订单</div>'}</div>`;
  }
  async function renderAdminProducts() {
    const b = $("#adminBody");
    const r = await S.products.list({});
    b.innerHTML = `<button class="btn primary sm" id="addProd" style="margin-bottom:12px">+ 发布新商品</button>
      <table class="table"><thead><tr><th>ID</th><th>标题</th><th>分类</th><th>SKU/库存</th><th>状态</th></tr></thead><tbody>
      ${r.data.items.map(p => `<tr><td>${p.productId}</td><td>${esc(p.title)}</td><td>${esc(catName(p.categoryId))}</td><td>${(p.skus || []).map(s => `${esc(s.specText || "默认")}:${s.available ?? "?"}`).join("<br>")}</td><td>${p.status ? "在售" : "下架"}</td></tr>`).join("")}</tbody></table>`;
    $("#addProd").onclick = openProductModal;
  }
  function openProductModal() {
    const flat = flatCats(state.categories, []).filter(c => c.isLeaf);
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(22,32,43,.5);z-index:120;display:flex;align-items:center;justify-content:center;overflow:auto;padding:20px";
    overlay.innerHTML = `<div class="auth-wrap" style="margin:0;max-width:560px;width:100%"><h2>发布商品</h2>
      <div class="field"><label>商品标题</label><input id="ptitle" placeholder="商品标题"></div>
      <div class="field"><label>所属叶子品类</label><select id="pcat">${flat.map(c => `<option value="${c.categoryId}">${esc(c.name)}（${esc(catName(c.parentId))}）</option>`).join("")}</select></div>
      <div id="dynForm"></div>
      <div class="field"><label>SKU 列表</label><div id="skuList"></div><button class="btn ghost sm" id="addSku" type="button">+ 增加一个 SKU</button></div>
      <div class="bar"><span class="grow"></span><button class="btn primary" id="saveProd">发布</button><button class="btn ghost" id="closeProd">取消</button></div>
      <div id="prodErr"></div></div>`;
    document.body.appendChild(overlay);
    const skuRow = () => `<div class="skurow" style="display:flex;gap:6px;margin-bottom:6px">
      <input placeholder="规格(如 8+128GB/黑)" class="sp" style="flex:2;padding:8px;border:1px solid var(--line-2);border-radius:6px">
      <input placeholder="售价" class="sprice" type="number" style="width:84px;padding:8px;border:1px solid var(--line-2);border-radius:6px">
      <input placeholder="市场价" class="smarket" type="number" style="width:84px;padding:8px;border:1px solid var(--line-2);border-radius:6px">
      <input placeholder="库存" class="sqty" type="number" style="width:74px;padding:8px;border:1px solid var(--line-2);border-radius:6px"></div>`;
    const addSku = () => { const d = document.createElement("div"); d.innerHTML = skuRow(); $("#skuList", overlay).appendChild(d.firstElementChild); };
    addSku(); $("#addSku", overlay).onclick = addSku;
    const loadForm = async () => {
      const r = await S.categories.form($("#pcat", overlay).value);
      if (r.ok && r.data.fields.length) {
        $("#dynForm", overlay).innerHTML = `<label style="font-size:13.5px;font-weight:600;color:var(--ink-2)">动态属性（来自品类 Schema：${esc(r.data.categoryName)}）</label>` +
          r.data.fields.map(f => `<div class="field" style="margin:6px 0"><label>${esc(f.attrName)}${f.isRequired ? " *" : ""} <span class="muted">(${esc(f.dataType)}${f.valueRange ? "，可选:" + f.valueRange : ""})</span></label>
            <input data-attr="${esc(f.attrCode)}" placeholder="${f.valueRange ? "可选:" + esc(f.valueRange) : ""}"></div>`).join("");
      } else $("#dynForm", overlay).innerHTML = "";
    };
    $("#pcat", overlay).onchange = loadForm; loadForm();
    $("#closeProd", overlay).onclick = () => overlay.remove();
    $("#saveProd", overlay).onclick = async () => {
      const title = $("#ptitle", overlay).value.trim();
      const categoryId = +$("#pcat", overlay).value;
      const attrInputs = $$("#dynForm [data-attr]", overlay);
      const attrValues = {}; attrInputs.forEach(a => { if (a.value.trim()) attrValues[a.dataset.attr] = a.value.trim(); });
      const skus = $$(".skurow", overlay).map(r => ({ specText: r.querySelector(".sp").value.trim(), salePrice: +r.querySelector(".sprice").value, marketPrice: +r.querySelector(".smarket").value || undefined, totalQty: +r.querySelector(".sqty").value || 0 })).filter(s => s.specText && s.salePrice > 0);
      if (!title || !skus.length) { $("#prodErr", overlay).innerHTML = `<p class="err">请填写标题与至少一个合法 SKU</p>`; return; }
      const r = await S.products.create({ title, categoryId, skus, attrValues });
      if (!r.ok) { $("#prodErr", overlay).innerHTML = `<p class="err">${esc(r.data.error || "发布失败")}</p>`; return; }
      overlay.remove(); toast("商品发布成功"); renderAdminProducts();
    };
  }
  async function renderAdminOrders() {
    const b = $("#adminBody");
    const r = await S.orders.adminList();
    b.innerHTML = `<table class="table"><thead><tr><th>订单号</th><th>买家</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${r.data.orders.map(o => {
        let act = "";
        if (o.status === 20 || o.status === 30) act = `<button class="btn primary sm" data-ship="${o.order_id}">发货</button>`;
        if ([20, 30, 40].includes(o.status)) act += `<button class="btn danger sm" data-refund="${o.order_id}">退款</button>`;
        return `<tr><td>${esc(o.order_no)}</td><td>${esc(o.buyer || "")}</td><td>${money(o.pay_amount)}</td>
          <td><span class="tag ${STATUS_CLS[o.status] || ""}">${STATUS[o.status] || "未知"}</span></td><td>${act}</td></tr>`;
      }).join("")}</tbody></table>`;
    $$("[data-ship]").forEach(btn => btn.onclick = async () => {
      const tn = prompt("请输入运单号：", "SF" + Date.now());
      if (!tn) return;
      const r2 = await S.orders.ship(btn.dataset.ship, tn);
      if (r2.ok) { toast("已发货"); renderAdminOrders(); } else toast(r2.data.error, "err");
    });
    $$("[data-refund]").forEach(btn => btn.onclick = async () => {
      if (!confirm("确认退款给用户？")) return;
      const r2 = await S.orders.refund(btn.dataset.refund);
      if (r2.ok) { toast("已退款"); renderAdminOrders(); } else toast(r2.data.error, "err");
    });
  }
  function renderAdminCategory() {
    const b = $("#adminBody");
    const flat = flatCats(state.categories, []).filter(c => c.isLeaf);
    b.innerHTML = `<p class="muted">粘贴商家自定义品类 JSON（系统执行：语法校验 → 结构语义校验 → 建树 → 索引映射 → 落库，并生成动态发布表单）。</p>
      <div class="field"><label>品类定义 JSON</label><textarea class="code" id="catJson">{
  "code": "apparel",
  "name": "服饰",
  "attrs": [{"attrCode":"size","attrName":"尺码","dataType":"enum","isRequired":true,"isFilterable":true,"valueRange":"S,M,L,XL"},
            {"attrCode":"color","attrName":"颜色","dataType":"enum","isRequired":true,"isFilterable":true,"valueRange":"黑,白,红"}],
  "children": [{"code":"apparel.man","name":"男装","attrs":[]},{"code":"apparel.women","name":"女装","attrs":[]}]
}</textarea></div>
      <div class="bar"><button class="btn primary" id="importCat">导入品类</button>
        <select id="previewCat" style="padding:9px 12px;border:1px solid var(--line-2);border-radius:8px;font-family:inherit">${flat.map(c => `<option value="${c.categoryId}">${esc(c.name)}</option>`).join("")}</select>
        <button class="btn" id="previewForm">预览动态表单</button></div>
      <div id="catResult"></div>
      <div class="panel" id="formPreview" style="display:none"><h3>动态商品发布表单 Schema</h3><pre class="jsonpreview" id="formJson"></pre></div>`;
    $("#importCat").onclick = async () => {
      const r = await S.categories.import($("#catJson").value);
      const box = $("#catResult");
      if (r.ok) box.innerHTML = `<div class="ok">✅ ${esc(r.data.message)} ｜ 品类数 ${r.data.categoryCount} ｜ 属性数 ${r.data.attrCount} ｜ 版本 ${r.data.version}</div>`;
      else box.innerHTML = `<div class="err">❌ ${esc(r.data.error || "导入失败")}${r.data.details ? "<br>" + esc((r.data.details || []).join("；")) : ""}</div>`;
    };
    $("#previewForm").onclick = async () => {
      const r = await S.categories.form($("#previewCat").value);
      if (r.ok) { $("#formPreview").style.display = "block"; $("#formJson").textContent = JSON.stringify(r.data, null, 2); }
    };
  }

  /* ---------------- AI 客服浮窗 ---------------- */
  function initChat() {
    const fab = $("#chatFab"), panel = $("#chatPanel");
    fab.onclick = () => panel.classList.toggle("hidden");
    $("#chatClose").onclick = () => panel.classList.add("hidden");
    $("#chatSend").onclick = sendChat;
    $("#chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
    const quick = ["我的订单到哪了？", "如何退换货？", "支持哪些支付方式？", "有哪些 AI 能力？"];
    $("#chatQuick").innerHTML = quick.map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join("");
    $$("#chatQuick button").forEach(b => b.onclick = () => { $("#chatInput").value = b.dataset.q; sendChat(); });
  }
  async function sendChat() {
    const input = $("#chatInput"); const text = input.value.trim(); if (!text) return;
    if (!state.user) { $("#chatBody").innerHTML += `<div class="msg bot"><div>请先 <a href="#/login">登录</a> 后使用智能客服（部分业务查询需要账号）。</div></div>`; }
    $("#chatBody").innerHTML += `<div class="msg user">${esc(text)}</div>`;
    input.value = ""; $("#chatBody").scrollTop = 9e9;
    const r = await S.ai.chat({ message: text, sessionId: state.chatSession });
    if (!r.ok) { $("#chatBody").innerHTML += `<div class="msg bot">${esc(r.data.error || "服务异常")}</div>`; $("#chatBody").scrollTop = 9e9; return; }
    state.chatSession = r.data.sessionId;
    const meta = r.data.degraded ? `降级 · ${esc(r.data.degradeReason)}` : `置信度 ${r.data.confidence}`;
    $("#chatBody").innerHTML += `<div class="msg bot ${r.data.degraded ? "degraded" : ""}">${esc(r.data.content)}<div class="meta">${meta}</div></div>`;
    $("#chatBody").scrollTop = 9e9;
  }

  /* ---------------- 路由 ---------------- */
  async function router() {
    setActiveNav();
    const hash = location.hash.slice(1) || "/";
    const path = hash.split("?")[0];
    const parts = path.split("/").filter(Boolean);
    const app = $("#app");
    if (parts.length === 0) return renderHome();
    if (parts[0] === "login") return renderLogin();
    if (parts[0] === "products") return renderProducts();
    if (parts[0] === "product") return renderProduct(parts[1]);
    if (parts[0] === "cart") return renderCart();
    if (parts[0] === "checkout") return renderCheckout();
    if (parts[0] === "orders") return renderOrders();
    if (parts[0] === "user") return renderUser();
    if (parts[0] === "admin") return renderAdmin();
    renderHome();
  }

  /* ---------------- 移动端抽屉 ---------------- */
  function initDrawer() {
    const toggle = $("#navToggle"), drawer = $("#drawer"), mask = $("#drawerMask");
    toggle.onclick = () => { drawer.classList.add("show"); mask.classList.add("show"); };
    const close = () => { drawer.classList.remove("show"); mask.classList.remove("show"); };
    mask.onclick = close; $("#drawerClose").onclick = close;
    drawer.addEventListener("click", e => { if (e.target.tagName === "A") close(); });
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    initChat(); initDrawer();
    const r = await S.categories.list(); state.categories = r.data.tree;
    await updateNav();
    window.addEventListener("hashchange", router);
    router();
  }
  boot();
})();
