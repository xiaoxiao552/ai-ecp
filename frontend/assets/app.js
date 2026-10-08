/* 智选云 AI 电商在线售货系统 —— 前端单页应用 (SPA)
 * 原生 JS，无构建依赖；通过 REST API 与后端动态交互，覆盖完整业务闭环。
 */
const state = { token: localStorage.getItem("ai_ecp_token") || "", user: null, categories: [] };

/* ----------------------------- 基础工具 ----------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const money = n => "¥" + (Number(n || 0)).toFixed(2);
const STATUS_TXT = { 10: "待支付", 20: "已支付", 30: "待发货", 40: "已发货", 50: "已完成", 60: "已关闭", 70: "退款中", 80: "售后中", 90: "已退款" };
const STATUS_CLS = { 10: "orange", 20: "blue", 30: "blue", 40: "blue", 50: "green", 60: "red", 70: "red", 80: "orange", 90: "red" };

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  if (state.token) opts.headers["Authorization"] = "Bearer " + state.token;
  if (opts.body && typeof opts.body !== "string") { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.body); }
  try {
    const res = await fetch(path, opts);
    if (res.status === 401) { logout(); return { ok: false, status: 401, data: { error: "登录已过期" } }; }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: "网络异常：" + e.message } };
  }
}
function toast(msg, type = "ok") {
  const d = document.createElement("div");
  d.className = type === "err" ? "err" : "ok";
  d.textContent = msg; d.style.margin = "10px 0";
  $("#app").prepend(d);
  setTimeout(() => d.remove(), 3500);
}

/* ----------------------------- 导航/鉴权 ----------------------------- */
function logout() { state.token = ""; state.user = null; localStorage.removeItem("ai_ecp_token"); location.hash = "#/login"; location.reload(); }
function updateNav() {
  const badge = $("#cartBadge");
  if (badge) badge.classList.add("hidden");
  $("#navAdmin").classList.toggle("hidden", !(state.user && (state.user.role === "merchant" || state.user.role === "admin")));
  const navUser = $("#navUser");
  if (state.user) {
    navUser.innerHTML = `<span class="tag blue">${esc(state.user.nickname)}</span><button class="navlink" id="logoutBtn">退出</button>`;
    $("#logoutBtn").onclick = logout;
    if (state.token) api("/api/cart").then(r => { if (r.ok && r.data.count) { badge.textContent = r.data.count; badge.classList.remove("hidden"); } });
  } else {
    navUser.innerHTML = `<a href="#/login">登录/注册</a>`;
  }
}

/* ----------------------------- 路由 ----------------------------- */
let productFilter = { keyword: "", categoryId: "", sort: "new", view: "grid" };
function router() {
  const hash = location.hash.slice(1) || "/";
  const parts = hash.split("/").filter(Boolean); // ['product','12']
  $$("#nav a[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === "/" && (parts.length === 0) || a.dataset.route === "/" + (parts[0] || "")));
  const app = $("#app");
  if (!state.token && !["/", "/products", "/product"].includes("/" + (parts[0] || "")) && parts[0] !== "login") {
    // 需要登录的页面在首次进入时若未登录则跳转登录（登录后回跳）
  }
  if (parts[0] === "login" || (!state.token && (parts[0] === "cart" || parts[0] === "orders" || parts[0] === "admin"))) {
    renderLogin(!state.token && ["cart", "orders", "admin"].includes(parts[0]) ? "请先登录，即可查看购物车/订单/商家后台。" : ""); return;
  }
  // 商家后台仅对商家/管理员开放：消费者即使已登录也明确拦截
  if (parts[0] === "admin" && state.user && state.user.role === "consumer") {
    app.innerHTML = `<div class="section"><div class="panel"><h3>无访问权限</h3>
      <p class="muted">商家后台仅对「商家」或「平台管理员」开放，当前账号为消费者。</p>
      <p><a href="#/products">去逛逛商品 →</a></p></div></div>`;
    return;
  }
  if (parts.length === 0) return renderHome();
  if (parts[0] === "products") return renderProducts();
  if (parts[0] === "product") return renderProduct(parts[1]);
  if (parts[0] === "cart") return renderCart();
  if (parts[0] === "orders") return renderOrders();
  if (parts[0] === "admin") return renderAdmin();
  renderHome();
}

/* ----------------------------- 登录/注册 ----------------------------- */
let authMode = "login";
function renderLogin(hint) {
  const app = $("#app");
  app.innerHTML = `
  <div class="auth-wrap">
    <h2>智选云 AI 电商</h2>
    <p class="sub">AI-ECP · 在线售货系统 · 动态演示站</p>
    ${hint ? `<div class="hint">${esc(hint)}</div>` : ""}
    <div class="seg">
      <button class="${authMode === "login" ? "active" : ""}" id="mLogin">登录</button>
      <button class="${authMode === "register" ? "active" : ""}" id="mReg">注册</button>
    </div>
    <div id="authForm"></div>
    <div class="hint">演示账号：消费者 13700000000 / user123 ｜ 商家 13900000000 / merch123 ｜ 管理员 13800000000 / admin123</div>
  </div>`;
  const draw = () => {
    const f = $("#authForm");
    if (authMode === "login") {
      f.innerHTML = `
      <div class="field"><label>手机号</label><input id="mobile" placeholder="请输入手机号" value="13700000000"></div>
      <div class="field"><label>密码</label><input id="pwd" type="password" placeholder="请输入密码" value="user123"></div>
      <button class="btn primary" style="width:100%" id="submit">登录</button>`;
    } else {
      f.innerHTML = `
      <div class="field"><label>昵称</label><input id="nick" placeholder="昵称"></div>
      <div class="field"><label>手机号</label><input id="mobile" placeholder="至少6位"></div>
      <div class="field"><label>密码</label><input id="pwd" type="password" placeholder="至少6位"></div>
      <div class="field"><label>注册身份</label>
        <select id="role"><option value="consumer">消费者（买家）</option><option value="merchant">商家</option></select></div>
      <button class="btn primary" style="width:100%" id="submit">注册并登录</button>`;
    }
    $("#submit").onclick = submitAuth;
  };
  $("#mLogin").onclick = () => { authMode = "login"; $("#mLogin").classList.add("active"); $("#mReg").classList.remove("active"); draw(); };
  $("#mReg").onclick = () => { authMode = "register"; $("#mReg").classList.add("active"); $("#mLogin").classList.remove("active"); draw(); };
  draw();
}
async function submitAuth() {
  const mobile = $("#mobile").value.trim();
  const password = $("#pwd").value;
  let r;
  if (authMode === "login") {
    r = await api("/api/auth/login", { method: "POST", body: { mobile, password } });
  } else {
    r = await api("/api/auth/register", { method: "POST", body: { mobile, password, nickname: $("#nick").value.trim(), role: $("#role").value } });
  }
  if (!r.ok) { toast(r.data.error || "操作失败", "err"); return; }
  state.token = r.data.token; state.user = r.data.user;
  localStorage.setItem("ai_ecp_token", state.token);
  updateNav();
  location.hash = "#/"; router();
}

/* ----------------------------- 首页 ----------------------------- */
async function renderHome() {
  const app = $("#app");
  app.innerHTML = `
  <section class="hero"><div class="wrap" style="padding:0">
    <h1>智选云 AI 电商在线售货系统</h1>
    <p class="lede">支持<strong>智能客服</strong>、<strong>智能选品</strong>、<strong>智能组货</strong>三项 AI 能力的电商在线售货系统；商品品类可由商家以 JSON 自定义，系统自动生成属性 Schema 与动态发布表单。下文为动态数据演示。</p>
    <div class="cta"><a class="btn primary" href="#/products">浏览商品</a><a class="btn" href="#/admin">进入商家后台</a></div>
  </div></section>
  <div class="catnav" id="catnav"></div>
  <div class="section"><div class="head"><h2>精选商品</h2><a href="#/products">查看全部 →</a></div><div class="grid" id="featured"></div></div>
  <div class="section" id="recSection"><div class="head"><h2>✨ AI 智能选品为你推荐</h2></div><div class="grid" id="rec"></div></div>`;
  // 品类导航
  const cates = await api("/api/categories");
  if (cates.ok) state.categories = cates.data.tree;
  const nav = $("#catnav");
  const flat = [];
  const walk = (nodes) => nodes.forEach(n => { flat.push(n); walk(n.children || []); });
  walk(state.categories);
  nav.innerHTML = `<span class="chip" data-cat="">全部</span>` + flat.map(c => `<span class="chip" data-cat="${c.category_id}">${esc(c.name)}</span>`).join("");
  $$("#catnav .chip").forEach(ch => ch.onclick = () => { productFilter.categoryId = ch.dataset.cat; location.hash = "#/products"; });
  // 精选
  $("#featured").innerHTML = `<p class="muted">正在加载商品…</p>`;
  const prods = await api("/api/products");
  if (prods.ok) {
    $("#featured").innerHTML = prods.data.items.length ? prods.data.items.map(productCard).join("")
      : `<p class="muted">暂无商品。</p>`;
  } else {
    $("#featured").innerHTML = `<p class="err">商品加载失败：${esc(prods.data.error || "网络异常")}</p>`;
  }
  // AI 推荐（需登录）
  if (state.token) {
    const rec = await api("/api/ai/recommend?scene=home");
    if (rec.ok && rec.data.items.length) $("#rec").innerHTML = rec.data.items.map(productCard).join("");
    else $("#recSection").classList.add("hidden");
  } else {
    $("#recSection").classList.add("hidden");
  }
}
function productImg(p) { return p.main_image || ("/img/product/" + p.product_id); }
function productCard(p, asList) {
  const price = p.min_price != null ? money(p.min_price) : "—";
  const market = (p.max_price && p.max_price !== p.min_price) ? `<small>${money(p.max_price)}</small>` : "";
  const img = `<img src="${esc(productImg(p))}" alt="${esc(p.title)}" loading="lazy" onerror="this.remove()">`;
  if (asList) {
    return `<a class="pcard list" href="#/product/${p.product_id}">
      <div class="thumb">${img}<span class="ph">${esc(p.category_name || "商品")}</span></div>
      <div class="body"><p class="title">${esc(p.title)}</p>
      <div class="meta">${esc(p.category_name || "")} ｜ 可用 ${p.available != null ? p.available : "?"} 件</div>
      <div class="price">${price}${market}</div></div></a>`;
  }
  return `<a class="pcard" href="#/product/${p.product_id}">
    <div class="thumb">${img}<span class="ph">${esc(p.category_name || "商品")}</span></div>
    <div class="body"><p class="title">${esc(p.title)}</p>
    <div class="price">${price}${market}</div>
    <div class="meta">可用库存 ${p.available != null ? p.available : "?"} 件</div></div></a>`;
}

/* ----------------------------- 商品列表/搜索 ----------------------------- */
async function renderProducts() {
  const app = $("#app");
  const flat = []; const walk = (nodes) => nodes.forEach(n => { flat.push(n); walk(n.children || []); });
  walk(state.categories);
  app.innerHTML = `
  <div class="section">
    <h2>商品浏览与搜索</h2>
    <div class="bar">
      <input id="kw" class="grow" style="padding:11px 13px;border:1px solid var(--line-2);border-radius:999px;font-family:inherit;font-size:14.5px" placeholder="搜索商品名称 / 规格…" value="${esc(productFilter.keyword)}">
      <select id="cat" style="padding:11px 13px;border:1px solid var(--line-2);border-radius:8px;font-family:inherit">
        <option value="">全部分类</option>${flat.map(c => `<option value="${c.category_id}" ${String(c.category_id) === productFilter.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <select id="sort" style="padding:11px 13px;border:1px solid var(--line-2);border-radius:8px;font-family:inherit">
        <option value="new">最新</option><option value="price_asc">价格升</option><option value="price_desc">价格降</option></select>
      <button class="btn primary" id="search">搜索</button>
      <span class="viewtoggle">
        <button class="btn sm ${productFilter.view === "grid" ? "primary" : ""}" id="vgrid" title="网格视图">▦</button>
        <button class="btn sm ${productFilter.view === "list" ? "primary" : ""}" id="vlist" title="列表视图">☰</button>
      </span>
    </div>
    <div class="grid ${productFilter.view === "list" ? "list-mode" : ""}" id="grid"><p class="muted">正在加载商品…</p></div>
  </div>`;
  const draw = () => {
    const grid = $("#grid");
    grid.className = "grid " + (productFilter.view === "list" ? "list-mode" : "");
    grid.innerHTML = `<p class="muted">正在加载商品…</p>`;
    const params = new URLSearchParams();
    if (productFilter.keyword) params.set("keyword", productFilter.keyword);
    if (productFilter.categoryId) params.set("categoryId", productFilter.categoryId);
    if (productFilter.sort) params.set("sort", productFilter.sort);
    api("/api/products?" + params.toString()).then(r => {
      grid.innerHTML = r.ok ? (r.data.items.length ? r.data.items.map(it => productCard(it, productFilter.view === "list")).join("") : `<p class="muted">没有找到匹配的商品。</p>`)
        : `<p class="err">${esc(r.data.error || "加载失败")}</p>`;
    });
  };
  $("#search").onclick = () => { productFilter.keyword = $("#kw").value.trim(); productFilter.categoryId = $("#cat").value; productFilter.sort = $("#sort").value; draw(); };
  $("#vgrid").onclick = () => { productFilter.view = "grid"; renderProducts(); };
  $("#vlist").onclick = () => { productFilter.view = "list"; renderProducts(); };
  draw();
}

/* ----------------------------- 商品详情 ----------------------------- */
let curProduct = null, curSku = null;
async function renderProduct(id) {
  const app = $("#app");
  app.innerHTML = `<div class="section"><p class="muted">加载中…</p></div>`;
  const r = await api("/api/products/" + id);
  if (!r.ok) { app.innerHTML = `<div class="section"><p class="err">${esc(r.data.error || "加载失败")}</p></div>`; return; }
  curProduct = r.data.product; curSku = curProduct.skus[0];
  const p = curProduct;
  const skusHtml = p.skus.map((s, i) => `<span class="sku ${i === 0 ? "active" : ""}" data-sk="${s.sku_id}">${esc(s.spec_text || "默认")} · ${money(s.sale_price)}</span>`).join("");
  const img = productImg(p);
  app.innerHTML = `
  <div class="detail">
    <div class="gallery">
      <div class="main-img"><img id="mainImg" src="${esc(img)}" alt="${esc(p.title)}" onerror="this.style.display='none'"><span class="ph2">${esc(p.category_name || "商品")}</span></div>
      <div class="thumbs">${[0,1,2].map(i => `<span class="thumb-i ${i === 0 ? "active" : ""}" data-i="${i}"><img src="${esc(img)}" alt="" onerror="this.style.display='none'"></span>`).join("")}</div>
    </div>
    <div>
      <h1>${esc(p.title)}</h1>
      <div class="price">${money(curSku.sale_price)}<small>${curSku.market_price ? money(curSku.market_price) : ""}</small></div>
      <p class="muted">分类：${esc(p.category_name || "-")} ｜ 可用库存：<span id="avail">${curSku.available}</span> 件</p>
      <div class="field"><label>选择规格</label><div class="skus" id="skus">${skusHtml}</div></div>
      <div class="field"><label>数量</label>
        <div class="qty"><button id="minus">−</button><input id="qty" value="1"><button id="plus">+</button></div></div>
      <div class="bar">
        <button class="btn primary" id="addCart">加入购物车</button>
        <button class="btn" id="buyNow">立即购买</button>
      </div>
      <div class="panel"><h3>🔗 AI 智能组货建议</h3><div id="bundleBox"><p class="muted">加载中…</p></div></div>
    </div>
  </div>`;
  // SKU 选择
  $$("#skus .sku").forEach(el => el.onclick = () => {
    $$("#skus .sku").forEach(x => x.classList.remove("active"));
    el.classList.add("active");
    curSku = p.skus.find(s => String(s.sku_id) === el.dataset.sk);
    $(".detail .price").innerHTML = `${money(curSku.sale_price)}<small>${curSku.market_price ? money(curSku.market_price) : ""}</small>`;
    $("#avail").textContent = curSku.available;
  });
  // 详情图集：缩略图切换主图（演示图为同图，真实场景可接入多图）
  $$(".gallery .thumbs .thumb-i").forEach(el => el.onclick = () => {
    $$(".gallery .thumbs .thumb-i").forEach(x => x.classList.remove("active"));
    el.classList.add("active");
    const im = el.querySelector("img");
    if (im) $("#mainImg").src = im.src;
  });
  $("#minus").onclick = () => { $("#qty").value = Math.max(1, (+$("#qty").value) - 1); };
  $("#plus").onclick = () => { $("#qty").value = (+$("#qty").value) + 1; };
  $("#addCart").onclick = async () => {
    const r = await api("/api/cart", { method: "POST", body: { skuId: curSku.sku_id, quantity: +$("#qty").value, source: "manual" } });
    if (!r.ok) return toast(r.data.error || "加购失败", "err");
    toast("已加入购物车"); updateNav();
  };
  $("#buyNow").onclick = () => { openCashierFromCart([{ skuId: curSku.sku_id, quantity: +$("#qty").value, source: "manual" }]); };
  // 组货
  const b = r.data.bundle;
  $("#bundleBox").innerHTML = bundleHtml(b);
}
function bundleHtml(b) {
  if (!b) return `<p class="muted">暂无组货建议</p>`;
  if (b.degraded) return `<p class="tag orange">已降级</p><p class="muted">${esc(b.degradeReason)}。为你推荐单品：</p>` +
    (b.items || []).map(i => `<div class="tag">${esc(i.title)} · ${money(i.min_price || i.price || 0)}</div>`).join("");
  const items = (b.bundle.items || []).map(i => `${esc(i.title)} · ${money(i.price)}`).join(" ＋ ");
  return `<p>${esc(b.bundle.reason)}</p><p class="price" style="font-size:18px">组合价 ${money(b.bundle.price)} ｜ 预估毛利 ${((b.bundle.grossRate || 0) * 100).toFixed(1)}%</p><p class="muted">${esc(items)}</p>`;
}

/* ----------------------------- 购物车 ----------------------------- */
async function renderCart() {
  const app = $("#app");
  const r = await api("/api/cart");
  if (!r.ok) { app.innerHTML = `<div class="section"><p class="err">${esc(r.data.error || "加载失败")}</p></div>`; return; }
  const items = r.data.items;
  app.innerHTML = `<div class="section"><h2>购物车</h2>
    <div id="cartList">${items.length ? "" : `<p class="muted">购物车是空的，<a href="#/products">去逛逛</a>。</p>`}</div>
    ${items.length ? `<div class="bar"><span class="grow"></span><span class="total">合计：${money(r.data.total)}</span>
      <button class="btn primary" id="checkout">结算下单</button></div>` : ""}</div>`;
  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `<div class="thumb"><img src="${esc(it.main_image || "/img/product/0")}" alt="" loading="lazy" onerror="this.remove()"><span class="ph">商品</span></div>
      <div class="info"><p class="t">${esc(it.title)}</p><p class="s">${esc(it.spec_text || "")} ｜ 单价 ${money(it.sale_price)} ｜ 可用 ${it.available}</p></div>
      <div class="qty"><button data-act="minus" data-id="${it.cart_item_id}">−</button><input value="${it.quantity}" data-id="${it.cart_item_id}" class="qinput"><button data-act="plus" data-id="${it.cart_item_id}">+</button></div>
      <div class="price">${money(it.sale_price * it.quantity)}</div>
      <button class="btn danger sm" data-del="${it.cart_item_id}">删除</button>`;
    $("#cartList").appendChild(row);
  });
  $$("[data-act]").forEach(b => b.onclick = async () => {
    const id = b.dataset.id, cur = +b.parentElement.querySelector(".qinput").value;
    const q = b.dataset.act === "plus" ? cur + 1 : Math.max(1, cur - 1);
    await api("/api/cart/" + id, { method: "PUT", body: { quantity: q } }); renderCart(); updateNav();
  });
  $$("[data-del]").forEach(b => b.onclick = async () => { await api("/api/cart/" + b.dataset.del, { method: "DELETE" }); renderCart(); updateNav(); });
  const co = $("#checkout");
  if (co) co.onclick = () => {
    const lines = items.map(it => ({ skuId: it.sku_id, quantity: it.quantity, source: it.source }));
    openCashierFromCart(lines, items.map(it => it.cart_item_id));
  };
}

/* ----------------------------- 收银台（下单 + 支付 + 回调扣库存）  ----------------------------- */
async function createOrderThenPay(lines) {
  const r = await api("/api/orders", { method: "POST", body: { items: lines, address: "演示地址（北京市朝阳区）" } });
  if (!r.ok) { toast(r.data.error || "下单失败", "err"); return null; }
  const pc = await api("/api/pay/create", { method: "POST", body: { orderId: r.data.orderId, channel: "balance" } });
  if (!pc.ok) { toast(pc.data.error || "支付下单失败", "err"); return null; }
  // 模拟支付网关回调（验签 + 幂等 + 扣库存 + 已支付 + 履约）
  const pn = await api("/api/pay/notify", { method: "POST", body: { orderId: r.data.orderId, tradeNo: pc.data.tradeNo } });
  if (!pn.ok) { toast(pn.data.error || "支付回调失败", "err"); return null; }
  return r.data.orderId;
}
function openCashierFromCart(lines, cartItemIds) {
  if (!state.token) { location.hash = "#/login"; return; }
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(22,32,43,.5);z-index:120;display:flex;align-items:center;justify-content:center";
  overlay.innerHTML = `<div class="auth-wrap" style="margin:0;max-width:420px;width:92%">
    <h2>收银台</h2><p class="sub">演示支付网关（余额支付）</p>
    <p id="cashierMsg" class="muted">即将创建订单并发起支付…</p>
    <div class="bar"><span class="grow"></span><button class="btn primary" id="payNow">确认支付</button>
    <button class="btn ghost" id="payCancel">取消</button></div></div>`;
  document.body.appendChild(overlay);
  $("#payCancel", overlay).onclick = () => overlay.remove();
  $("#payNow", overlay).onclick = async () => {
    $("#payNow", overlay).disabled = true; $("#cashierMsg", overlay).textContent = "处理中…";
    const orderId = await createOrderThenPay(lines);
    if (orderId) {
      $("#cashierMsg", overlay).innerHTML = `<span class="ok">✅ 支付成功，库存已扣减并触发履约！订单号 ${esc(orderId)}</span>`;
      // 清理购物车中已下单项
      if (cartItemIds) for (const id of cartItemIds) await api("/api/cart/" + id, { method: "DELETE" });
      updateNav();
      setTimeout(() => { overlay.remove(); location.hash = "#/orders"; router(); }, 1400);
    } else {
      $("#payNow", overlay).disabled = false;
    }
  };
}

/* ----------------------------- 我的订单 ----------------------------- */
async function renderOrders() {
  const app = $("#app");
  const r = await api("/api/orders");
  if (!r.ok) { app.innerHTML = `<div class="section"><p class="err">${esc(r.data.error || "加载失败")}</p></div>`; return; }
  const orders = r.data.orders;
  app.innerHTML = `<div class="section"><h2>我的订单</h2>
    ${orders.length ? orders.map(orderCard).join("") : `<p class="muted">还没有订单，<a href="#/products">去下单</a>。</p>`}</div>`;
  bindOrderActions();
}
function orderCard(o) {
  const items = (o.items || []).map(i => `<div class="tag">${esc(i.title)} ×${i.quantity} (${esc(i.spec_text || "")})</div>`).join("");
  let acts = "";
  if (o.status === 10) acts = `<button class="btn primary sm" data-pay="${o.order_id}">去支付</button><button class="btn danger sm" data-cancel="${o.order_id}">取消</button>`;
  if (o.status === 40) acts = `<button class="btn primary sm" data-confirm="${o.order_id}">确认收货</button>`;
  return `<div class="list-row" style="flex-direction:column;align-items:stretch">
    <div style="display:flex;gap:12px;align-items:center">
      <div class="info" style="flex:1"><p class="t">订单 ${esc(o.order_no)}</p><p class="s">${esc(o.address || "")} ｜ 创建 ${esc(o.created_at)}</p></div>
      <span class="tag ${STATUS_CLS[o.status] || ""}">${STATUS_TXT[o.status] || "未知"}</span>
      <span class="price">${money(o.pay_amount)}</span>
    </div>
    <div style="margin:8px 0">${items}</div>
    <div style="text-align:right">${acts}</div></div>`;
}
function bindOrderActions() {
  $$("[data-pay]").forEach(b => b.onclick = async () => {
    const lines = (await api("/api/orders")).data.orders.find(o => o.order_id == b.dataset.pay).items.map(i => ({ skuId: i.sku_id, quantity: i.quantity, source: i.source }));
    openCashierFromCart(lines);
  });
  $$("[data-cancel]").forEach(b => b.onclick = async () => { const r = await api("/api/orders/" + b.dataset.cancel + "/cancel", { method: "POST" }); if (r.ok) { toast("订单已关闭"); renderOrders(); } else toast(r.data.error, "err"); });
  $$("[data-confirm]").forEach(b => b.onclick = async () => { const r = await api("/api/orders/" + b.dataset.confirm + "/confirm", { method: "POST" }); if (r.ok) { toast("交易完成"); renderOrders(); } else toast(r.data.error, "err"); });
}

/* ----------------------------- 商家后台 ----------------------------- */
let adminTab = "dashboard";
async function renderAdmin() {
  const app = $("#app");
  app.innerHTML = `<div class="section"><h2>商家 / 平台后台</h2>
    <div class="tabs">
      <button data-t="dashboard" class="${adminTab === "dashboard" ? "active" : ""}">经营看板</button>
      <button data-t="products" class="${adminTab === "products" ? "active" : ""}">商品管理</button>
      <button data-t="orders" class="${adminTab === "orders" ? "active" : ""}">订单管理</button>
      <button data-t="profile" class="${adminTab === "profile" ? "active" : ""}">基本信息</button>
      <button data-t="category" class="${adminTab === "category" ? "active" : ""}">品类(JSON)</button>
    </div>
    <div id="adminBody"></div></div>`;
  $$(".tabs button").forEach(b => b.onclick = () => { adminTab = b.dataset.t; renderAdmin(); });
  if (adminTab === "dashboard") return renderDashboard();
  if (adminTab === "products") return renderAdminProducts();
  if (adminTab === "orders") return renderAdminOrders();
  if (adminTab === "profile") return renderAdminProfile();
  if (adminTab === "category") return renderAdminCategory();
}
async function renderDashboard() {
  const r = await api("/api/admin/dashboard");
  const b = $("#adminBody");
  if (!r.ok) { b.innerHTML = `<p class="err">${esc(r.data.error || "无权限")}</p>`; return; }
  const d = r.data;
  const byStatus = Object.entries(d.ordersByStatus || {}).map(([k, v]) => `<div class="statcard"><b>${v}</b><span>${esc(k)}</span></div>`).join("");
  b.innerHTML = `<div class="statgrid">
    <div class="statcard"><b>${d.productCount}</b><span>商品数</span></div>
    <div class="statcard"><b>${d.orderCount}</b><span>订单数</span></div>
    <div class="statcard"><b>${money(d.paidAmount)}</b><span>已支付金额</span></div>
    <div class="statcard"><b>${d.pendingShip}</b><span>待发货</span></div>
    <div class="statcard"><b>${d.userCount}</b><span>用户数</span></div>
    <div class="statcard"><b>${d.categoryCount}</b><span>品类数</span></div></div>
    <h3 style="color:var(--accent);margin:18px 0 8px">订单状态分布</h3>
    <div class="statgrid">${byStatus || '<div class="muted">暂无订单</div>'}</div>
    <div class="panel" style="margin-top:18px">
      <h3>后台核心管理能力 · 适用场景 · 交互方式</h3>
      <ul class="cap-list">
        <li><b>经营看板</b>：实时查看本店商品数、订单数、已支付金额、待发货与订单状态分布。<span class="muted">场景：每日经营巡检。</span> <span class="muted">交互：进入后台默认页。</span></li>
        <li><b>商品管理</b>：上/下架商品、按品类 JSON Schema 发布多 SKU 商品并设置库存。<span class="muted">场景：上新、补货、调价。</span> <span class="muted">交互：表格操作 + 弹窗表单。</span></li>
        <li><b>订单管理</b>：对已支付订单录入运单号发货、对异常订单退款。<span class="muted">场景：履约与售后。</span> <span class="muted">交互：订单表格内的「发货/退款」按钮。</span></li>
        <li><b>基本信息</b>：维护店铺名称、简介、联系电话与地址。<span class="muted">场景：店铺装修与客服联系。</span> <span class="muted">交互：表单保存。</span></li>
        <li><b>品类(JSON)</b>：以 JSON 自定义品类与属性，系统自动建树并生成动态发布表单。<span class="muted">场景：扩展经营类目。</span> <span class="muted">交互：粘贴 JSON → 导入 → 预览表单。</span></li>
      </ul>
    </div>`;
}
async function renderAdminProfile() {
  const b = $("#adminBody");
  b.innerHTML = `<p class="muted">正在加载店铺信息…</p>`;
  const r = await api("/api/admin/profile");
  if (!r.ok) { b.innerHTML = `<p class="err">${esc(r.data.error || "无权限")}</p>`; return; }
  const p = r.data;
  b.innerHTML = `<div class="panel" style="max-width:560px">
    <h3>店铺基本信息</h3>
    <div class="field"><label>店铺名称（登录昵称）</label><input id="pName" value="${esc(p.nickname || "")}"></div>
    <div class="field"><label>店铺简介</label><textarea id="pDesc" rows="3" placeholder="一句话介绍你的店铺">${esc(p.store_desc || "")}</textarea></div>
    <div class="field"><label>联系电话</label><input id="pPhone" value="${esc(p.contact_phone || "")}" placeholder="如 13900000000"></div>
    <div class="field"><label>店铺地址</label><input id="pAddr" value="${esc(p.store_address || "")}" placeholder="如 北京市朝阳区xx路1号"></div>
    <div class="field"><label>账号手机（不可修改）</label><input value="${esc(p.mobile || "")}" disabled></div>
    <button class="btn primary" id="saveProfile">保存</button><span id="pMsg" class="muted" style="margin-left:10px"></span>
  </div>`;
  $("#saveProfile").onclick = async () => {
    const body = { nickname: $("#pName").value.trim(), store_desc: $("#pDesc").value.trim(),
                   contact_phone: $("#pPhone").value.trim(), store_address: $("#pAddr").value.trim() };
    const rr = await api("/api/admin/profile", { method: "PUT", body });
    const msg = $("#pMsg");
    if (rr.ok) { msg.textContent = "已保存 ✓"; msg.className = "ok"; updateNav(); }
    else { msg.textContent = rr.data.error || "保存失败"; msg.className = "err"; }
  };
}
async function renderAdminProducts() {
  const b = $("#adminBody");
  const r = await api("/api/admin/products");
  if (!r.ok) { b.innerHTML = `<p class="err">${esc(r.data.error || "无权限")}</p>`; return; }
  b.innerHTML = `<button class="btn primary sm" id="addProd" style="margin-bottom:12px">+ 发布新商品</button>
    <table class="table"><thead><tr><th>ID</th><th>图片</th><th>标题</th><th>SKU/库存</th><th>状态</th></tr></thead><tbody>
    ${r.data.items.map(p => `<tr><td>${p.product_id}</td>
      <td><div class="thumb" style="width:48px;height:48px;font-size:10px"><img src="${esc(p.main_image || ("/img/product/" + p.product_id))}" alt="" onerror="this.remove()"><span class="ph">图</span></div></td>
      <td>${esc(p.title)}</td><td>${(p.skus || []).map(s => `${esc(s.spec_text || "默认")}:${s.available ?? "?"}`).join("<br>")}</td><td>${p.status ? "在售" : "下架"}</td></tr>`).join("")}</tbody></table>`;
  $("#addProd").onclick = openProductModal;
}
function openProductModal() {
  const flat = []; const walk = (nodes) => nodes.forEach(n => { flat.push(n); walk(n.children || []); });
  walk(state.categories);
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(22,32,43,.5);z-index:120;display:flex;align-items:center;justify-content:center;overflow:auto;padding:20px";
  overlay.innerHTML = `<div class="auth-wrap" style="margin:0;max-width:560px;width:100%">
    <h2>发布商品</h2>
    <div class="field"><label>商品标题</label><input id="ptitle" placeholder="商品标题"></div>
    <div class="field"><label>所属品类（叶子品类）</label><select id="pcat">${flat.map(c => `<option value="${c.category_id}">${esc(c.name)}</option>`).join("")}</select></div>
    <div id="dynForm"></div>
    <div class="field"><label>SKU 列表</label><div id="skuList"></div>
      <button class="btn ghost sm" id="addSku" type="button">+ 增加一个 SKU</button></div>
    <div class="bar"><span class="grow"></span><button class="btn primary" id="saveProd">发布</button><button class="btn ghost" id="closeProd">取消</button></div>
    <div id="prodErr"></div></div>`;
  document.body.appendChild(overlay);
  const skuRow = () => `<div class="skurow" style="display:flex;gap:6px;margin-bottom:6px">
    <input placeholder="规格(如 8+128GB/黑)" class="sp" style="flex:2;padding:8px;border:1px solid var(--line-2);border-radius:6px">
    <input placeholder="售价" class="sprice" type="number" style="width:90px;padding:8px;border:1px solid var(--line-2);border-radius:6px">
    <input placeholder="市场价" class="smarket" type="number" style="width:90px;padding:8px;border:1px solid var(--line-2);border-radius:6px">
    <input placeholder="库存" class="sqty" type="number" style="width:80px;padding:8px;border:1px solid var(--line-2);border-radius:6px"></div>`;
  const addSku = () => { const d = document.createElement("div"); d.innerHTML = skuRow(); $("#skuList", overlay).appendChild(d.firstElementChild); };
  addSku(); $("#addSku", overlay).onclick = addSku;
  // 动态表单预览（品类属性 Schema）
  const loadForm = async () => {
    const r = await api("/api/categories/" + $("#pcat", overlay).value + "/form");
    if (r.ok && r.data.fields.length) {
      $("#dynForm", overlay).innerHTML = `<label style="font-size:13.5px;font-weight:600;color:var(--ink-2)">动态属性（来自品类 Schema：${esc(r.data.categoryName)}）</label>` +
        r.data.fields.map(f => `<div class="field" style="margin:6px 0"><label>${esc(f.attrName)}${f.isRequired ? " *" : ""} <span class="muted">(${esc(f.dataType)})</span></label>
          <input data-attr="${esc(f.attrCode)}" placeholder="${f.valueRange ? "可选:" + esc(f.valueRange) : ""}"></div>`).join("");
    } else $("#dynForm", overlay).innerHTML = "";
  };
  $("#pcat", overlay).onchange = loadForm; loadForm();
  $("#closeProd", overlay).onclick = () => overlay.remove();
  $("#saveProd", overlay).onclick = async () => {
    const title = $("#ptitle", overlay).value.trim();
    const categoryId = +$("#pcat", overlay).value;
    const skuRows = $$(".skurow", overlay);
    const attrInputs = $$("#dynForm [data-attr]", overlay);
    const attrValues = {};
    attrInputs.forEach(a => { if (a.value.trim()) attrValues[a.dataset.attr] = a.value.trim(); });
    const skus = skuRows.map(r => ({
      specText: r.querySelector(".sp").value.trim(),
      salePrice: +r.querySelector(".sprice").value,
      marketPrice: +r.querySelector(".smarket").value || undefined,
      totalQty: +r.querySelector(".sqty").value || 0,
      attrValues
    })).filter(s => s.specText && s.salePrice > 0);
    if (!title || !skus.length) { $("#prodErr", overlay).innerHTML = `<p class="err">请填写标题与至少一个合法 SKU</p>`; return; }
    const r = await api("/api/products", { method: "POST", body: { title, categoryId, skus } });
    if (!r.ok) { $("#prodErr", overlay).innerHTML = `<p class="err">${esc(r.data.error || "发布失败")}</p>`; return; }
    overlay.remove(); toast("商品发布成功"); renderAdminProducts();
  };
}
async function renderAdminOrders() {
  const b = $("#adminBody");
  const r = await api("/api/admin/orders");
  if (!r.ok) { b.innerHTML = `<p class="err">${esc(r.data.error || "无权限")}</p>`; return; }
  b.innerHTML = `<table class="table"><thead><tr><th>订单号</th><th>买家</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${r.data.orders.map(o => {
      let act = "";
      if (o.status === 20) act = `<button class="btn primary sm" data-ship="${o.order_id}">发货</button>`;
      if ([20, 30, 40].includes(o.status)) act += `<button class="btn danger sm" data-refund="${o.order_id}">退款</button>`;
      return `<tr><td>${esc(o.order_no)}</td><td>${esc(o.buyer || "")}</td><td>${money(o.pay_amount)}</td>
        <td><span class="tag ${STATUS_CLS[o.status] || ""}">${STATUS_TXT[o.status] || "未知"}</span></td><td>${act}</td></tr>`;
    }).join("")}</tbody></table>`;
  $$("[data-ship]").forEach(btn => btn.onclick = async () => {
    const tn = prompt("请输入运单号：", "SF" + Date.now());
    if (!tn) return;
    const r = await api("/api/admin/orders/" + btn.dataset.ship + "/ship", { method: "POST", body: { trackingNo: tn } });
    if (r.ok) { toast("已发货"); renderAdminOrders(); } else toast(r.data.error, "err");
  });
  $$("[data-refund]").forEach(btn => btn.onclick = async () => {
    if (!confirm("确认退款给用户？")) return;
    const r = await api("/api/admin/orders/" + btn.dataset.refund + "/refund", { method: "POST" });
    if (r.ok) { toast("已退款"); renderAdminOrders(); } else toast(r.data.error, "err");
  });
}
function renderAdminCategory() {
  const b = $("#adminBody");
  b.innerHTML = `<p class="muted">粘贴商家自定义品类 JSON（系统将执行：语法校验 → 结构语义校验 → 建树 → 索引映射 → 落库，并自动生成动态发布表单）。</p>
    <div class="field"><label>品类定义 JSON</label><textarea class="code" id="catJson">{
  "code": "apparel",
  "name": "服饰",
  "attrs": [{"attrCode":"size","attrName":"尺码","dataType":"enum","isRequired":true,"isFilterable":true,"valueRange":"S,M,L,XL"},
            {"attrCode":"color","attrName":"颜色","dataType":"enum","isRequired":true,"isFilterable":true,"valueRange":"黑,白,红"}],
  "children": [{"code":"apparel.man","name":"男装","attrs":[]},{"code":"apparel.women","name":"女装","attrs":[]}]
}</textarea></div>
    <div class="bar"><button class="btn primary" id="importCat">导入品类</button>
      <select id="previewCat" style="padding:9px 12px;border:1px solid var(--line-2);border-radius:8px;font-family:inherit"></select>
      <button class="btn" id="previewForm">预览动态表单</button></div>
    <div id="catResult"></div>
    <div class="panel" id="formPreview" style="display:none"><h3>动态商品发布表单 Schema</h3><pre class="jsonpreview" id="formJson"></pre></div>`;
  const flat = []; const walk = (nodes) => nodes.forEach(n => { flat.push(n); walk(n.children || []); });
  walk(state.categories);
  $("#previewCat").innerHTML = flat.map(c => `<option value="${c.category_id}">${esc(c.name)}</option>`).join("");
  $("#importCat").onclick = async () => {
    const r = await api("/api/categories/import", { method: "POST", body: { json: $("#catJson").value } });
    const box = $("#catResult");
    if (r.ok) box.innerHTML = `<div class="ok">✅ ${esc(r.data.message)} ｜ 品类数 ${r.data.categoryCount} ｜ 属性数 ${r.data.attrCount} ｜ 版本 ${r.data.version}</div>`;
    else box.innerHTML = `<div class="err">❌ ${esc(r.data.error || "导入失败")}${r.data.details ? "<br>" + esc((r.data.details || []).join("；")) : ""}</div>`;
    if (r.ok) { state.categories = (await api("/api/categories")).data.tree; }
  };
  $("#previewForm").onclick = async () => {
    const r = await api("/api/categories/" + $("#previewCat").value + "/form");
    if (r.ok) { $("#formPreview").style.display = "block"; $("#formJson").textContent = JSON.stringify(r.data, null, 2); }
  };
}

/* ----------------------------- AI 客服浮窗 ----------------------------- */
let chatSession = null;
function initChat() {
  const fab = $("#chatFab"), panel = $("#chatPanel");
  fab.onclick = () => panel.classList.toggle("hidden");
  $("#chatClose").onclick = () => panel.classList.add("hidden");
  $("#chatSend").onclick = sendChat;
  $("#chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
}
async function sendChat() {
  const input = $("#chatInput"); const text = input.value.trim(); if (!text) return;
  if (!state.token) { $("#chatBody").innerHTML += `<div class="msg bot">请先 <a href="#/login">登录</a> 后使用智能客服。</div>`; input.value = ""; return; }
  $("#chatBody").innerHTML += `<div class="msg user">${esc(text)}</div>`;
  input.value = "";
  const r = await api("/api/ai/chat", { method: "POST", body: { message: text, sessionId: chatSession } });
  if (!r.ok) { $("#chatBody").innerHTML += `<div class="msg bot">${esc(r.data.error || "服务异常")}</div>`; $("#chatBody").scrollTop = 9e9; return; }
  chatSession = r.data.sessionId;
  const meta = r.data.degraded ? `降级 · ${esc(r.data.degradeReason)}` : `置信度 ${r.data.confidence}`;
  $("#chatBody").innerHTML += `<div class="msg bot ${r.data.degraded ? "degraded" : ""}">${esc(r.data.content)}<div class="meta">${meta}</div></div>`;
  $("#chatBody").scrollTop = 9e9;
}

/* ----------------------------- 启动 ----------------------------- */
async function boot() {
  initChat();
  if (state.token) {
    const r = await api("/api/auth/me");
    if (r.ok) state.user = r.data.user; else { state.token = ""; localStorage.removeItem("ai_ecp_token"); }
  }
  await api("/api/categories").then(r => { if (r.ok) state.categories = r.data.tree; });
  updateNav();
  window.addEventListener("hashchange", router);
  router();
}
boot();
