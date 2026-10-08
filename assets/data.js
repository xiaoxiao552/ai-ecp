/* 智选云 AI 电商在线售货系统 —— 静态数据集 + 本地模拟后端 (Store)
 * 纯前端：所有数据内嵌，所有"后端交互"通过 localStorage 模拟，无需服务器，可直接 file:// 打开。
 * 数据模型字段沿用成果包《核心数据模型图》(图 4-8 ERD)：品类/属性/商品/SKU/库存/订单/支付/会话/组货。
 */
(function () {
  "use strict";

  /* ============================================================
   * 一、品类树（含属性 Schema）—— 对应 t_category / t_category_attr
   * 叶子品类携带可筛选属性（enum + isFilterable），用于商品检索的 facet 筛选。
   * ========================================================== */
  const categories = [
    {
      categoryId: 1, code: "digital", name: "数码电子", emoji: "📱", color: "#4a90d9",
      parentId: 0, level: 1, isLeaf: false, children: [
        { categoryId: 11, code: "phone", name: "智能手机", emoji: "📱", color: "#4a90d9", parentId: 1, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "brand", attrName: "品牌", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "星耀,极光,锐翼" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "黑,白,蓝,金" },
            { attrCode: "storage", attrName: "存储", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "128G,256G,512G" }
          ] },
        { categoryId: 12, code: "laptop", name: "笔记本电脑", emoji: "💻", color: "#3a7bd5", parentId: 1, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "brand", attrName: "品牌", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "锐翼,幻影" },
            { attrCode: "ram", attrName: "内存", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "16G,32G" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "银,灰,黑" }
          ] },
        { categoryId: 13, code: "earphone", name: "智能耳机", emoji: "🎧", color: "#5aa0e0", parentId: 1, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "brand", attrName: "品牌", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "声海,灵动" },
            { attrCode: "type", attrName: "类型", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "入耳式,头戴式" }
          ] }
      ]
    },
    {
      categoryId: 2, code: "apparel", name: "服饰鞋包", emoji: "👕", color: "#27ae60",
      parentId: 0, level: 1, isLeaf: false, children: [
        { categoryId: 21, code: "men", name: "男装", emoji: "👔", color: "#27ae60", parentId: 2, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "gender", attrName: "性别", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "男" },
            { attrCode: "size", attrName: "尺码", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "S,M,L,XL,XXL" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "黑,白,灰,蓝" },
            { attrCode: "style", attrName: "风格", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "商务,休闲,运动" }
          ] },
        { categoryId: 22, code: "women", name: "女装", emoji: "👗", color: "#2ecc71", parentId: 2, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "gender", attrName: "性别", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "女" },
            { attrCode: "size", attrName: "尺码", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "S,M,L" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "红,白,黑,粉" }
          ] },
        { categoryId: 23, code: "shoes", name: "鞋靴", emoji: "👟", color: "#1f9d55", parentId: 2, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "gender", attrName: "性别", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "男,女" },
            { attrCode: "size", attrName: "鞋码", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "38,39,40,41,42,43" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "黑,白,灰" }
          ] }
      ]
    },
    {
      categoryId: 3, code: "home", name: "家居生活", emoji: "🏠", color: "#e67e22",
      parentId: 0, level: 1, isLeaf: false, children: [
        { categoryId: 31, code: "kitchen", name: "厨房用品", emoji: "🍳", color: "#e67e22", parentId: 3, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "material", attrName: "材质", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "不锈钢,陶瓷,硅胶" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "黑,白,红" }
          ] },
        { categoryId: 32, code: "textile", name: "家纺布艺", emoji: "🛏️", color: "#d35400", parentId: 3, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "material", attrName: "材质", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "全棉,天丝" },
            { attrCode: "color", attrName: "颜色", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "白,灰,蓝" }
          ] }
      ]
    },
    {
      categoryId: 4, code: "beauty", name: "美妆个护", emoji: "💄", color: "#e84393",
      parentId: 0, level: 1, isLeaf: false, children: [
        { categoryId: 41, code: "skincare", name: "护肤", emoji: "🧴", color: "#e84393", parentId: 4, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "skinType", attrName: "肤质", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "干性,油性,混合性,敏感性" },
            { attrCode: "effect", attrName: "功效", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "保湿,美白,抗老" }
          ] },
        { categoryId: 42, code: "makeup", name: "彩妆", emoji: "💋", color: "#d6336c", parentId: 4, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "effect", attrName: "妆效", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "持久,哑光,滋润" },
            { attrCode: "color", attrName: "色号", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "正红,豆沙,裸粉" }
          ] }
      ]
    },
    {
      categoryId: 5, code: "food", name: "食品生鲜", emoji: "🍎", color: "#c0392b",
      parentId: 0, level: 1, isLeaf: false, children: [
        { categoryId: 51, code: "snack", name: "休闲零食", emoji: "🍫", color: "#c0392b", parentId: 5, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "taste", attrName: "口味", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "甜,咸,辣" },
            { attrCode: "origin", attrName: "产地", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "国产,进口" }
          ] },
        { categoryId: 52, code: "drink", name: "饮品冲调", emoji: "🥤", color: "#a93226", parentId: 5, level: 2, isLeaf: true,
          attrs: [
            { attrCode: "taste", attrName: "口味", dataType: "enum", isRequired: true, isFilterable: true, valueRange: "苦,香,酸" },
            { attrCode: "origin", attrName: "产地", dataType: "enum", isRequired: false, isFilterable: true, valueRange: "国产,进口" }
          ] }
      ]
    }
  ];

  /* ============================================================
   * 二、商品与 SKU —— 对应 t_product / t_sku / t_sku_attr_value / t_inventory
   * 每个商品含 1~3 个 SKU；available 即可用库存。attrs 用于 facet 筛选。
   * ========================================================== */
  const products = [
    // —— 数码电子 / 智能手机 ——
    { productId: 1001, merchantId: 9001, categoryId: 11, title: "星耀 Pro 5G 旗舰手机", emoji: "📱", status: 1, createdAt: "2026-08-01",
      rating: 4.8, sales: 3200, tags: ["热销", "AI优选"], desc: "6.7 英寸 OLED 高刷屏，旗舰影像系统，5000mAh 长续航，AI 影像一键成片。",
      attrs: { brand: "星耀", color: "黑", storage: "256G" },
      skus: [
        { skuId: 11001, specText: "黑 / 256G", salePrice: 4299, marketPrice: 4699, status: 1, attrValues: { color: "黑", storage: "256G" }, available: 120 },
        { skuId: 11002, specText: "白 / 256G", salePrice: 4299, marketPrice: 4699, status: 1, attrValues: { color: "白", storage: "256G" }, available: 86 },
        { skuId: 11003, specText: "蓝 / 512G", salePrice: 4899, marketPrice: 5299, status: 1, attrValues: { color: "蓝", storage: "512G" }, available: 54 }
      ] },
    { productId: 1002, merchantId: 9001, categoryId: 11, title: "极光 Lite 轻薄 5G 手机", emoji: "📱", status: 1, createdAt: "2026-08-12",
      rating: 4.6, sales: 1800, tags: ["新品"], desc: "172g 超轻机身，主打颜值与手感，适合日常通勤与轻度游戏。",
      attrs: { brand: "极光", color: "金", storage: "128G" },
      skus: [
        { skuId: 11011, specText: "金 / 128G", salePrice: 1999, marketPrice: 2199, status: 1, attrValues: { color: "金", storage: "128G" }, available: 210 },
        { skuId: 11012, specText: "黑 / 256G", salePrice: 2399, marketPrice: 2599, status: 1, attrValues: { color: "黑", storage: "256G" }, available: 95 }
      ] },
    // —— 数码电子 / 笔记本 ——
    { productId: 1003, merchantId: 9001, categoryId: 12, title: "锐翼 Air 14 轻薄笔记本", emoji: "💻", status: 1, createdAt: "2026-07-20",
      rating: 4.7, sales: 960, tags: ["热销"], desc: "1.2kg 全金属机身，2.8K 高色域屏，长续航办公利器。",
      attrs: { brand: "锐翼", ram: "16G", color: "银" },
      skus: [
        { skuId: 12001, specText: "16G / 银", salePrice: 5499, marketPrice: 5999, status: 1, attrValues: { ram: "16G", color: "银" }, available: 60 },
        { skuId: 12002, specText: "32G / 灰", salePrice: 6499, marketPrice: 6999, status: 1, attrValues: { ram: "32G", color: "灰" }, available: 33 }
      ] },
    { productId: 1004, merchantId: 9001, categoryId: 12, title: "幻影 16 高性能游戏本", emoji: "💻", status: 1, createdAt: "2026-07-28",
      rating: 4.9, sales: 540, tags: ["AI优选"], desc: "RTX 独显 + 高刷电竞屏，AI 渲染与 3A 大作都从容。",
      attrs: { brand: "幻影", ram: "32G", color: "黑" },
      skus: [
        { skuId: 12011, specText: "32G / 黑", salePrice: 9999, marketPrice: 10999, status: 1, attrValues: { ram: "32G", color: "黑" }, available: 22 }
      ] },
    // —— 数码电子 / 耳机 ——
    { productId: 1005, merchantId: 9002, categoryId: 13, title: "声海 主动降噪头戴耳机", emoji: "🎧", status: 1, createdAt: "2026-08-05",
      rating: 4.7, sales: 2100, tags: ["热销"], desc: "40h 续航，自适应降噪，通勤飞行沉浸聆听。",
      attrs: { brand: "声海", type: "头戴式" },
      skus: [
        { skuId: 13001, specText: "头戴式 / 黑", salePrice: 1299, marketPrice: 1499, status: 1, attrValues: { type: "头戴式", color: "黑" }, available: 140 },
        { skuId: 13002, specText: "头戴式 / 银", salePrice: 1299, marketPrice: 1499, status: 1, attrValues: { type: "头戴式", color: "银" }, available: 72 }
      ] },
    { productId: 1006, merchantId: 9002, categoryId: 13, title: "灵动 真无线降噪耳机", emoji: "🎧", status: 1, createdAt: "2026-08-18",
      rating: 4.5, sales: 2600, tags: ["新品"], desc: "半入耳舒适佩戴，智能通透模式，来电清晰。",
      attrs: { brand: "灵动", type: "入耳式" },
      skus: [
        { skuId: 13011, specText: "入耳式 / 白", salePrice: 499, marketPrice: 599, status: 1, attrValues: { type: "入耳式", color: "白" }, available: 320 }
      ] },

    // —— 服饰鞋包 / 男装 ——
    { productId: 2001, merchantId: 9003, categoryId: 21, title: "简欧 纯棉商务衬衫", emoji: "👔", status: 1, createdAt: "2026-08-02",
      rating: 4.6, sales: 1500, tags: ["热销"], desc: "新疆长绒棉，免烫抗皱，商务通勤百搭。",
      attrs: { gender: "男", size: "L", color: "白", style: "商务" },
      skus: [
        { skuId: 21001, specText: "白 / L", salePrice: 199, marketPrice: 259, status: 1, attrValues: { size: "L", color: "白" }, available: 200 },
        { skuId: 21002, specText: "蓝 / XL", salePrice: 199, marketPrice: 259, status: 1, attrValues: { size: "XL", color: "蓝" }, available: 150 },
        { skuId: 21003, specText: "灰 / M", salePrice: 199, marketPrice: 259, status: 1, attrValues: { size: "M", color: "灰" }, available: 180 }
      ] },
    { productId: 2002, merchantId: 9003, categoryId: 21, title: "都市 男士休闲夹克", emoji: "🧥", status: 1, createdAt: "2026-08-15",
      rating: 4.4, sales: 880, tags: ["新品"], desc: "防风面料，多口袋设计，春秋出行实穿。",
      attrs: { gender: "男", size: "XL", color: "黑", style: "休闲" },
      skus: [
        { skuId: 21011, specText: "黑 / XL", salePrice: 359, marketPrice: 459, status: 1, attrValues: { size: "XL", color: "黑" }, available: 90 },
        { skuId: 21012, specText: "灰 / L", salePrice: 359, marketPrice: 459, status: 1, attrValues: { size: "L", color: "灰" }, available: 70 }
      ] },
    // —— 服饰鞋包 / 女装 ——
    { productId: 2003, merchantId: 9003, categoryId: 22, title: "雪纺 碎花连衣裙", emoji: "👗", status: 1, createdAt: "2026-08-08",
      rating: 4.7, sales: 1900, tags: ["热销"], desc: "轻盈雪纺，显瘦剪裁，约会度假都适合。",
      attrs: { gender: "女", size: "M", color: "红" },
      skus: [
        { skuId: 22001, specText: "红 / M", salePrice: 269, marketPrice: 329, status: 1, attrValues: { size: "M", color: "红" }, available: 160 },
        { skuId: 22002, specText: "白 / S", salePrice: 269, marketPrice: 329, status: 1, attrValues: { size: "S", color: "白" }, available: 130 },
        { skuId: 22003, specText: "黑 / L", salePrice: 269, marketPrice: 329, status: 1, attrValues: { size: "L", color: "黑" }, available: 110 }
      ] },
    { productId: 2004, merchantId: 9003, categoryId: 22, title: "云朵 针织开衫", emoji: "🧶", status: 1, createdAt: "2026-08-20",
      rating: 4.5, sales: 760, tags: ["新品"], desc: "柔软亲肤针织，慵懒风百搭外套。",
      attrs: { gender: "女", size: "L", color: "粉" },
      skus: [
        { skuId: 22011, specText: "粉 / L", salePrice: 229, marketPrice: 289, status: 1, attrValues: { size: "L", color: "粉" }, available: 95 }
      ] },
    // —— 服饰鞋包 / 鞋靴 ——
    { productId: 2005, merchantId: 9003, categoryId: 23, title: "云感 减震运动鞋", emoji: "👟", status: 1, createdAt: "2026-08-03",
      rating: 4.8, sales: 2400, tags: ["热销", "AI优选"], desc: "回弹中底，透气网面，跑步健身舒适不累脚。",
      attrs: { gender: "男", size: "42", color: "黑" },
      skus: [
        { skuId: 23001, specText: "男 / 42 / 黑", salePrice: 399, marketPrice: 499, status: 1, attrValues: { gender: "男", size: "42", color: "黑" }, available: 180 },
        { skuId: 23002, specText: "男 / 43 / 白", salePrice: 399, marketPrice: 499, status: 1, attrValues: { gender: "男", size: "43", color: "白" }, available: 120 },
        { skuId: 23003, specText: "女 / 38 / 白", salePrice: 399, marketPrice: 499, status: 1, attrValues: { gender: "女", size: "38", color: "白" }, available: 140 }
      ] },

    // —— 家居生活 / 厨房 ——
    { productId: 3001, merchantId: 9004, categoryId: 31, title: "麦饭石 不粘煎锅", emoji: "🍳", status: 1, createdAt: "2026-07-30",
      rating: 4.6, sales: 1700, tags: ["热销"], desc: "麦饭石涂层，少油不粘，电磁炉燃气通用。",
      attrs: { material: "陶瓷", color: "黑" },
      skus: [
        { skuId: 31001, specText: "28cm / 黑", salePrice: 129, marketPrice: 169, status: 1, attrValues: { material: "陶瓷", color: "黑" }, available: 300 },
        { skuId: 31002, specText: "32cm / 红", salePrice: 159, marketPrice: 199, status: 1, attrValues: { material: "陶瓷", color: "红" }, available: 240 }
      ] },
    { productId: 3002, merchantId: 9004, categoryId: 31, title: "德式 陶瓷刀具套装", emoji: "🔪", status: 1, createdAt: "2026-08-10",
      rating: 4.7, sales: 980, tags: ["AI优选"], desc: "氧化锆陶瓷刀，锋利防锈，厨房轻奢之选。",
      attrs: { material: "陶瓷", color: "白" },
      skus: [
        { skuId: 31011, specText: "6 件套 / 白", salePrice: 299, marketPrice: 399, status: 1, attrValues: { material: "陶瓷", color: "白" }, available: 88 }
      ] },
    // —— 家居生活 / 家纺 ——
    { productId: 3003, merchantId: 9004, categoryId: 32, title: "全棉 四件套床品", emoji: "🛏️", status: 1, createdAt: "2026-08-06",
      rating: 4.8, sales: 1300, tags: ["热销"], desc: "60 支长绒棉，亲肤透气，裸睡级体验。",
      attrs: { material: "全棉", color: "灰" },
      skus: [
        { skuId: 32001, specText: "1.5m床 / 灰", salePrice: 399, marketPrice: 499, status: 1, attrValues: { material: "全棉", color: "灰" }, available: 110 },
        { skuId: 32002, specText: "1.8m床 / 蓝", salePrice: 459, marketPrice: 569, status: 1, attrValues: { material: "全棉", color: "蓝" }, available: 80 }
      ] },

    // —— 美妆个护 / 护肤 ——
    { productId: 4001, merchantId: 9005, categoryId: 41, title: "水润 保湿面霜 50g", emoji: "🧴", status: 1, createdAt: "2026-08-04",
      rating: 4.6, sales: 2200, tags: ["热销"], desc: "神经酰胺修护屏障，长效锁水不黏腻。",
      attrs: { skinType: "干性", effect: "保湿" },
      skus: [
        { skuId: 41001, specText: "50g / 保湿", salePrice: 189, marketPrice: 239, status: 1, attrValues: { effect: "保湿" }, available: 260 },
        { skuId: 41002, specText: "50g / 美白", salePrice: 219, marketPrice: 269, status: 1, attrValues: { effect: "美白" }, available: 150 }
      ] },
    { productId: 4002, merchantId: 9005, categoryId: 41, title: "烟酰胺 亮肤精华", emoji: "🧪", status: 1, createdAt: "2026-08-16",
      rating: 4.5, sales: 1400, tags: ["AI优选"], desc: "10% 烟酰胺，淡化暗沉，提亮肤色。",
      attrs: { skinType: "油性", effect: "美白" },
      skus: [
        { skuId: 41011, specText: "30ml / 美白", salePrice: 159, marketPrice: 199, status: 1, attrValues: { effect: "美白" }, available: 200 }
      ] },
    // —— 美妆个护 / 彩妆 ——
    { productId: 4003, merchantId: 9005, categoryId: 42, title: "丝绒 哑光唇膏", emoji: "💋", status: 1, createdAt: "2026-08-09",
      rating: 4.7, sales: 2600, tags: ["热销"], desc: "雾面丝绒质感，持久不脱色，显白提气色。",
      attrs: { effect: "哑光", color: "正红" },
      skus: [
        { skuId: 42001, specText: "正红 / 哑光", salePrice: 99, marketPrice: 129, status: 1, attrValues: { effect: "哑光", color: "正红" }, available: 400 },
        { skuId: 42002, specText: "豆沙 / 滋润", salePrice: 99, marketPrice: 129, status: 1, attrValues: { effect: "滋润", color: "豆沙" }, available: 350 },
        { skuId: 42003, specText: "裸粉 / 持久", salePrice: 99, marketPrice: 129, status: 1, attrValues: { effect: "持久", color: "裸粉" }, available: 300 }
      ] },

    // —— 食品生鲜 / 零食 ——
    { productId: 5001, merchantId: 9006, categoryId: 51, title: "每日坚果 30 包礼盒", emoji: "🥜", status: 1, createdAt: "2026-08-01",
      rating: 4.8, sales: 3500, tags: ["热销", "AI优选"], desc: "每日一包混合坚果果干，独立小包装营养早餐。",
      attrs: { taste: "甜", origin: "国产" },
      skus: [
        { skuId: 51001, specText: "30包 / 甜", salePrice: 89, marketPrice: 119, status: 1, attrValues: { taste: "甜", origin: "国产" }, available: 500 },
        { skuId: 51002, specText: "30包 / 咸", salePrice: 89, marketPrice: 119, status: 1, attrValues: { taste: "咸", origin: "国产" }, available: 420 }
      ] },
    { productId: 5002, merchantId: 9006, categoryId: 51, title: "手撕 风干牛肉干", emoji: "🥩", status: 1, createdAt: "2026-08-14",
      rating: 4.6, sales: 1900, tags: ["新品"], desc: "内蒙古草原牛肉，低脂高蛋白，追剧零食。",
      attrs: { taste: "辣", origin: "国产" },
      skus: [
        { skuId: 51011, specText: "200g / 辣", salePrice: 59, marketPrice: 79, status: 1, attrValues: { taste: "辣", origin: "国产" }, available: 280 }
      ] },
    // —— 食品生鲜 / 饮品 ——
    { productId: 5003, merchantId: 9006, categoryId: 52, title: "冻干 黑咖啡 20 杯", emoji: "☕", status: 1, createdAt: "2026-08-07",
      rating: 4.7, sales: 2800, tags: ["热销"], desc: "0 蔗糖冻干即溶，醇香提神，随时随地一杯。",
      attrs: { taste: "苦", origin: "进口" },
      skus: [
        { skuId: 52001, specText: "20杯 / 苦", salePrice: 69, marketPrice: 89, status: 1, attrValues: { taste: "苦", origin: "进口" }, available: 360 },
        { skuId: 52002, specText: "20杯 / 香", salePrice: 69, marketPrice: 89, status: 1, attrValues: { taste: "香", origin: "进口" }, available: 300 }
      ] },
    { productId: 5004, merchantId: 9006, categoryId: 52, title: "高山 乌龙茶 礼盒", emoji: "🍵", status: 1, createdAt: "2026-08-19",
      rating: 4.5, sales: 1100, tags: ["新品"], desc: "高山慢采乌龙，回甘悠长，自饮送礼皆宜。",
      attrs: { taste: "香", origin: "国产" },
      skus: [
        { skuId: 52011, specText: "250g / 香", salePrice: 139, marketPrice: 179, status: 1, attrValues: { taste: "香", origin: "国产" }, available: 160 }
      ] }
  ];

  /* ============================================================
   * 三、智能客服知识库 —— 对应 t_knowledge_chunk（RAG-lite 检索语料）
   * ========================================================== */
  const knowledge = [
    { categoryCode: "shipping", content: "本平台订单在付款后 24 小时内由商家发货，普通快递 1-3 天送达，偏远地区 3-5 天。可在「我的订单」中查看物流运单号。" },
    { categoryCode: "return", content: "支持 7 天无理由退换货（不影响二次销售）。在「我的订单」对应订单点击申请售后，或联系智能客服提交退换货，审核通过后寄回即可。" },
    { categoryCode: "payment", content: "本站为演示站点，采用模拟支付网关（余额支付）。点击「确认支付」即视为支付成功，库存实时扣减并触发商家履约发货。" },
    { categoryCode: "stock", content: "商品库存为实时可用库存；下单未支付时会预占库存，取消订单或超时未支付将自动释放。" },
    { categoryCode: "ai", content: "智选云内置三项 AI 能力：智能客服（答疑与业务查询）、智能选品（个性化推荐）、智能组货（搭配组合建议）。AI 异常时自动降级为规则策略，不影响下单。" },
    { categoryCode: "member", content: "注册即成为普通会员，消费累计成长值可升级银卡/金卡，享受专属折扣与优先发货。" },
    { categoryCode: "coupon", content: "可在「用户中心-优惠券」领取满减券，结算时自动抵扣；本演示默认提供新人 20 元无门槛券。" }
  ];

  /* ============================================================
   * 四、智能组货方案 —— 对应 t_bundle / t_bundle_item
   * 大模型只生成搭配理由；库存/价格/毛利由业务校验（此处预置可售组合）。
   * ========================================================== */
  const bundles = [
    { bundleId: 1, mainProductId: 1001, sceneTag: "数码焕新", bundlePrice: 4598, grossRate: 0.18, strategyCode: "phone_acc",
      reason: "星耀 Pro 搭配声海降噪耳机，通勤路上影音沉浸，手机+耳机组合更超值。",
      items: [1001, 1005] },
    { bundleId: 2, mainProductId: 2003, sceneTag: "约会穿搭", bundlePrice: 468, grossRate: 0.22, strategyCode: "apparel_set",
      reason: "碎花连衣裙配丝绒唇膏，约会妆容一气呵成，温柔显白两件套。",
      items: [2003, 4003] },
    { bundleId: 3, mainProductId: 5001, sceneTag: "办公室补给", bundlePrice: 138, grossRate: 0.20, strategyCode: "snack_coffee",
      reason: "每日坚果配冻干黑咖啡，下午茶能量组合，提神又饱腹。",
      items: [5001, 5003] },
    { bundleId: 4, mainProductId: 1003, sceneTag: "居家办公", bundlePrice: 5628, grossRate: 0.17, strategyCode: "laptop_acc",
      reason: "轻薄本搭配云感运动鞋，办公运动两不误，工作生活平衡组合。",
      items: [1003, 2005] }
  ];

  /* ============================================================
   * 五、演示用户 —— 对应 t_user / t_user_profile
   * ========================================================== */
  const seedUsers = [
    { userId: 1, nickname: "体验用户", mobile: "13700000000", password: "user123", role: "consumer", memberLevel: 2, gender: "男", birthday: "1995-06-01" },
    { userId: 2, nickname: "星耀官方旗舰店", mobile: "13900000000", password: "merch123", role: "merchant", memberLevel: 0, gender: "", birthday: "" },
    { userId: 3, nickname: "平台管理员", mobile: "13800000000", password: "admin123", role: "admin", memberLevel: 0, gender: "", birthday: "" }
  ];

  /* ============================================================
   * 六、工具函数
   * ========================================================== */
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function catById(id) {
    let found = null;
    const want = Number(id);
    (function walk(list) { list.forEach(c => { if (Number(c.categoryId) === want) found = c; if (c.children) walk(c.children); }); })(categories);
    return found;
  }
  function leafIdsUnder(id) {
    const node = catById(id);
    const out = [];
    (function walk(n) { if (!n) return; if (n.isLeaf) out.push(n.categoryId); if (n.children) n.children.forEach(walk); })(node);
    return out.length ? out : [id];
  }
  function productMinPrice(p) { return Math.min.apply(null, p.skus.map(s => s.salePrice)); }
  function productMaxPrice(p) { return Math.max.apply(null, p.skus.map(s => s.salePrice)); }

  /* ============================================================
   * 七、本地存储抽象（localStorage 不可用时降级为内存）
   * ========================================================== */
  const storage = (function () {
    let mem = {};
    let hasLS = false;
    try { localStorage.setItem("__ai_ecp_t__", "1"); localStorage.removeItem("__ai_ecp_t__"); hasLS = true; } catch (e) { hasLS = false; }
    return {
      get(k) { try { const v = hasLS ? localStorage.getItem(k) : mem[k]; return v ? JSON.parse(v) : null; } catch (e) { return null; } },
      set(k, v) { const s = JSON.stringify(v); if (hasLS) { try { localStorage.setItem(k, s); } catch (e) { mem[k] = s; } } else mem[k] = s; },
      del(k) { if (hasLS) localStorage.removeItem(k); else delete mem[k]; }
    };
  })();

  const K = {
    token: "ai_ecp_token", user: "ai_ecp_user", users: "ai_ecp_users",
    products: "ai_ecp_products", cart: "ai_ecp_cart", orders: "ai_ecp_orders",
    fav: "ai_ecp_fav", addr: "ai_ecp_addr", reviews: "ai_ecp_reviews",
    behavior: "ai_ecp_behavior", conv: "ai_ecp_conv"
  };

  // 运行时商品库（种子 + 商家新增），持久化以便演示发布后仍在
  function loadProducts() {
    const saved = storage.get(K.products);
    if (saved && saved.length) return saved;
    const init = deepCopy(products);
    storage.set(K.products, init);
    return init;
  }
  let RT_PRODUCTS = loadProducts();

  function res(ok, data, status) { return { ok: ok, status: status || (ok ? 200 : 400), data: data }; }
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 120)); }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function todayStr() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function findUser(mobile) {
    const reg = storage.get(K.users) || [];
    return seedUsers.find(u => u.mobile === mobile) || reg.find(u => u.mobile === mobile) || null;
  }
  function publicUser(u) { return { userId: u.userId, nickname: u.nickname, mobile: u.mobile, role: u.role, memberLevel: u.memberLevel, gender: u.gender, birthday: u.birthday }; }

  function decStock(productId, skuId, qty) {
    const p = RT_PRODUCTS.find(x => x.productId === productId);
    if (!p) return false;
    const s = p.skus.find(sk => sk.skuId === skuId);
    if (!s || s.available < qty) return false;
    s.available -= qty; storage.set(K.products, RT_PRODUCTS); return true;
  }
  function incStock(productId, skuId, qty) {
    const p = RT_PRODUCTS.find(x => x.productId === productId); if (!p) return;
    const s = p.skus.find(sk => sk.skuId === skuId); if (!s) return;
    s.available += qty; storage.set(K.products, RT_PRODUCTS);
  }

  function logBehavior(userId, eventType, skuId, scene) {
    const b = storage.get(K.behavior) || [];
    b.push({ eventId: uid("e"), userId: userId || 0, eventType, skuId, scene: scene || "", occurTime: new Date().toISOString() });
    if (b.length > 500) b.splice(0, b.length - 500);
    storage.set(K.behavior, b);
  }

  /* ============================================================
   * 八、Store —— 本地模拟后端 API（保持 {ok,data} 契约）
   * ========================================================== */
  const Store = {
    /* ---------- 鉴权 ---------- */
    auth: {
      async login({ mobile, password }) {
        await delay();
        const u = findUser(mobile);
        if (!u || u.password !== password) return res(false, { error: "手机号或密码错误" });
        storage.set(K.token, u.userId); storage.set(K.user, publicUser(u));
        return res(true, { token: u.userId, user: publicUser(u) });
      },
      async register({ mobile, password, nickname, role }) {
        await delay();
        if (!mobile || !password) return res(false, { error: "手机号与密码必填" });
        if (findUser(mobile)) return res(false, { error: "该手机号已注册" });
        const reg = storage.get(K.users) || [];
        const u = { userId: 100000 + reg.length + 1, nickname: nickname || ("用户" + mobile.slice(-4)), mobile, password, role: role || "consumer", memberLevel: 1, gender: "", birthday: "" };
        reg.push(u); storage.set(K.users, reg);
        storage.set(K.token, u.userId); storage.set(K.user, publicUser(u));
        return res(true, { token: u.userId, user: publicUser(u) });
      },
      async me() {
        const u = storage.get(K.user);
        return res(true, { user: u || null });
      },
      async logout() { storage.del(K.token); storage.del(K.user); return res(true, {}); }
    },

    /* ---------- 品类 ---------- */
    categories: {
      async list() { await delay(40); return res(true, { tree: deepCopy(categories) }); },
      async form(categoryId) {
        await delay(40);
        const c = catById(categoryId);
        if (!c) return res(false, { error: "品类不存在" });
        const fields = (c.attrs || []).map(a => ({
          attrCode: a.attrCode, attrName: a.attrName, dataType: a.dataType,
          isRequired: a.isRequired, isFilterable: a.isFilterable, valueRange: a.valueRange
        }));
        return res(true, { categoryName: c.name, fields });
      },
      async import(jsonText) {
        // 模拟品类 JSON 五步处理：语法校验→结构校验→建树→索引映射→落库
        await delay(200);
        let obj;
        try { obj = JSON.parse(jsonText); } catch (e) { return res(false, { error: "JSON 语法错误：" + e.message, details: ["第 " + (e.message.match(/\d+/) || "?") + " 行附近"] }); }
        const errs = [];
        if (!obj.code) errs.push("缺少根字段 code");
        if (!obj.name) errs.push("缺少根字段 name");
        if (obj.children && !Array.isArray(obj.children)) errs.push("children 必须为数组");
        let depth = 0; (function d(n, l) { depth = Math.max(depth, l); (n.children || []).forEach(c => d(c, l + 1)); })(obj, 1);
        if (depth > 5) errs.push("品类层级深度超过上限 5");
        if (errs.length) return res(false, { error: "结构语义校验未通过", details: errs });
        const attrCount = (function c(n) { return (n.attrs || []).length + (n.children || []).reduce((s, x) => s + c(x), 0); })(obj);
        return res(true, { message: "导入成功", categoryCount: (function c(n) { return 1 + (n.children || []).reduce((s, x) => s + c(x), 0); })(obj), attrCount, version: 1 });
      }
    },

    /* ---------- 商品 ---------- */
    products: {
      async list(filter) {
        filter = filter || {};
        await delay();
        let list = deepCopy(RT_PRODUCTS).filter(p => p.status === 1);
        if (filter.categoryId) {
          const leaves = leafIdsUnder(Number(filter.categoryId));
          list = list.filter(p => leaves.indexOf(p.categoryId) >= 0);
        }
        if (filter.keyword) {
          const kw = String(filter.keyword).toLowerCase();
          list = list.filter(p => (p.title + " " + (p.desc || "") + " " + JSON.stringify(p.attrs) + " " + p.skus.map(s => s.specText).join(" ")).toLowerCase().indexOf(kw) >= 0);
        }
        if (filter.attrs) {
          list = list.filter(p => Object.keys(filter.attrs).every(code => {
            const want = filter.attrs[code];
            return want.indexOf(p.attrs && p.attrs[code]) >= 0;
          }));
        }
        // 空串视为未设置，避免 Number("")=0 误过滤
        const minP = (filter.minPrice === "" || filter.minPrice == null) ? null : Number(filter.minPrice);
        const maxP = (filter.maxPrice === "" || filter.maxPrice == null) ? null : Number(filter.maxPrice);
        if (minP != null && !isNaN(minP)) list = list.filter(p => productMinPrice(p) >= minP);
        if (maxP != null && !isNaN(maxP)) list = list.filter(p => productMinPrice(p) <= maxP);
        list.forEach(p => { p.min_price = productMinPrice(p); p.max_price = productMaxPrice(p); p.available = p.skus.reduce((s, x) => s + x.available, 0); });
        const sort = filter.sort || "new";
        if (sort === "price_asc") list.sort((a, b) => a.min_price - b.min_price);
        else if (sort === "price_desc") list.sort((a, b) => b.min_price - a.min_price);
        else if (sort === "sales") list.sort((a, b) => b.sales - a.sales);
        else list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        return res(true, { items: list, total: list.length });
      },
      async get(id) {
        await delay();
        const p = deepCopy(RT_PRODUCTS).find(x => x.productId === Number(id));
        if (!p) return res(false, { error: "商品不存在" });
        p.min_price = productMinPrice(p);
        const bundle = (window.Store.ai._bundleSync(p.productId) || {});
        return res(true, { product: p, bundle });
      },
      async create({ title, categoryId, skus, attrValues }) {
        await delay();
        const u = storage.get(K.user);
        if (!u || u.role !== "merchant" && u.role !== "admin") return res(false, { error: "无权限" });
        if (!title || !skus || !skus.length) return res(false, { error: "请填写标题与至少一个 SKU" });
        const id = Math.max.apply(null, RT_PRODUCTS.map(x => x.productId)) + 1;
        const cleanSkus = skus.map((s, i) => ({
          skuId: id * 100 + i + 1, specText: s.specText, salePrice: Number(s.salePrice),
          marketPrice: Number(s.marketPrice) || Number(s.salePrice), status: 1,
          attrValues: attrValues || {}, available: Number(s.totalQty) || 0
        }));
        const np = { productId: id, merchantId: u.userId, categoryId: Number(categoryId), title, emoji: "🛍️", status: 1, createdAt: todayStr(), rating: 5.0, sales: 0, tags: ["新品"], desc: "商家发布的商品。", attrs: attrValues || {}, skus: cleanSkus };
        RT_PRODUCTS.push(np); storage.set(K.products, RT_PRODUCTS);
        return res(true, { product: np });
      }
    },

    /* ---------- 购物车 ---------- */
    cart: {
      async list() {
        await delay();
        const cart = storage.get(K.cart) || [];
        const items = []; let total = 0;
        cart.forEach(it => {
          const p = RT_PRODUCTS.find(x => x.productId === it.productId); if (!p) return;
          const s = p.skus.find(sk => sk.skuId === it.skuId); if (!s) return;
          items.push({
            cart_item_id: it.cart_item_id, productId: p.productId, skuId: s.skuId, title: p.title,
            emoji: p.emoji, spec_text: s.specText, sale_price: s.salePrice, market_price: s.marketPrice,
            available: s.available, quantity: it.quantity, source: it.source || "manual"
          });
          total += s.salePrice * it.quantity;
        });
        return res(true, { items, total, count: items.reduce((s, x) => s + x.quantity, 0) });
      },
      async add({ skuId, quantity, source }) {
        await delay();
        // 定位商品
        let prod = null, sku = null;
        for (const p of RT_PRODUCTS) { const s = p.skus.find(x => x.skuId === skuId); if (s) { prod = p; sku = s; break; } }
        if (!prod) return res(false, { error: "商品不存在" });
        const cart = storage.get(K.cart) || [];
        const exist = cart.find(it => it.skuId === skuId);
        if (exist) exist.quantity += Number(quantity) || 1;
        else cart.push({ cart_item_id: uid("c"), productId: prod.productId, skuId, quantity: Number(quantity) || 1, source: source || "manual" });
        storage.set(K.cart, cart);
        return res(true, { count: cart.reduce((s, x) => s + x.quantity, 0) });
      },
      async update(id, quantity) {
        await delay();
        const cart = storage.get(K.cart) || [];
        const it = cart.find(x => x.cart_item_id === id); if (!it) return res(false, { error: "条目不存在" });
        it.quantity = Math.max(1, Number(quantity) || 1); storage.set(K.cart, cart);
        return res(true, {});
      },
      async remove(id) {
        await delay();
        let cart = storage.get(K.cart) || [];
        cart = cart.filter(x => x.cart_item_id !== id); storage.set(K.cart, cart);
        return res(true, {});
      },
      async clear(ids) {
        let cart = storage.get(K.cart) || [];
        if (ids && ids.length) cart = cart.filter(x => ids.indexOf(x.cart_item_id) < 0);
        else cart = [];
        storage.set(K.cart, cart); return res(true, {});
      }
    },

    /* ---------- 订单 / 支付 ---------- */
    orders: {
      async list() {
        await delay();
        const u = storage.get(K.user);
        let orders = storage.get(K.orders) || [];
        if (u && u.role !== "admin") orders = orders.filter(o => o.user_id === u.userId);
        orders.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        return res(true, { orders });
      },
      async get(id) {
        await delay();
        const orders = storage.get(K.orders) || [];
        const o = orders.find(x => x.order_id === id);
        return o ? res(true, { order: o }) : res(false, { error: "订单不存在" });
      },
      async create({ items, address, coupon }) {
        await delay();
        const u = storage.get(K.user);
        if (!u) return res(false, { error: "请先登录" });
        let total = 0, payAmount = 0;
        const orderItems = [];
        for (const line of items) {
          const p = RT_PRODUCTS.find(x => x.productId === line.productId); if (!p) continue;
          const s = p.skus.find(sk => sk.skuId === line.skuId); if (!s) continue;
          if (s.available < line.quantity) return res(false, { error: "「" + p.title + "」库存不足" }, 409);
          // 锁定库存（下单即预占）
          s.available -= line.quantity;
          total += s.salePrice * line.quantity;
          orderItems.push({ sku_id: s.skuId, productId: p.productId, categoryId: p.categoryId, title: p.title, emoji: p.emoji, spec_text: s.specText, quantity: line.quantity, unit_price: s.salePrice, source: line.source || "manual" });
        }
        storage.set(K.products, RT_PRODUCTS);
        const couponAmount = Number(coupon) || 0;
        payAmount = Math.max(0, total - couponAmount);
        const orderId = uid("O");
        const order = {
          order_id: orderId, order_no: "AI" + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10),
          user_id: u.userId, buyer: u.nickname, address: address || "演示地址（北京市朝阳区）",
          total_amount: total, pay_amount: payAmount, coupon_amount: couponAmount,
          status: 10, created_at: new Date().toISOString(), items: orderItems, tracking_no: ""
        };
        const all = storage.get(K.orders) || []; all.push(order); storage.set(K.orders, all);
        return res(true, { orderId, order });
      },
      async cancel(id) {
        await delay();
        const orders = storage.get(K.orders) || [];
        const o = orders.find(x => x.order_id === id); if (!o) return res(false, { error: "订单不存在" });
        if (o.status !== 10 && o.status !== 60) return res(false, { error: "当前状态不可取消" });
        o.status = 60;
        // 释放锁定库存
        o.items.forEach(it => incStock(it.productId, it.sku_id, it.quantity));
        storage.set(K.orders, orders); storage.set(K.products, RT_PRODUCTS);
        return res(true, { order: o });
      },
      async confirm(id) {
        await delay();
        const orders = storage.get(K.orders) || [];
        const o = orders.find(x => x.order_id === id); if (!o) return res(false, { error: "订单不存在" });
        if (o.status !== 40) return res(false, { error: "仅已发货订单可确认收货" });
        o.status = 50; storage.set(K.orders, orders); return res(true, { order: o });
      },
      async ship(id, trackingNo) {
        await delay();
        const orders = storage.get(K.orders) || [];
        const o = orders.find(x => x.order_id === id); if (!o) return res(false, { error: "订单不存在" });
        if (o.status !== 20 && o.status !== 30) return res(false, { error: "当前状态不可发货" });
        o.status = 40; o.tracking_no = trackingNo || ("SF" + Date.now()); storage.set(K.orders, orders);
        return res(true, { order: o });
      },
      async refund(id) {
        await delay();
        const orders = storage.get(K.orders) || [];
        const o = orders.find(x => x.order_id === id); if (!o) return res(false, { error: "订单不存在" });
        if (![20, 30, 40].includes(o.status)) return res(false, { error: "当前状态不可退款" });
        o.status = 90; o.items.forEach(it => incStock(it.productId, it.sku_id, it.quantity));
        storage.set(K.orders, orders); storage.set(K.products, RT_PRODUCTS);
        return res(true, { order: o });
      },
      async adminList() {
        await delay();
        const orders = (storage.get(K.orders) || []).slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        return res(true, { orders });
      }
    },

    pay: {
      async create({ orderId, channel }) {
        await delay();
        return res(true, { tradeNo: "TN" + Date.now().toString(36).toUpperCase(), channel: channel || "balance" });
      },
      async notify({ orderId, tradeNo }) {
        await delay();
        const orders = storage.get(K.orders) || [];
        const o = orders.find(x => x.order_id === orderId); if (!o) return res(false, { error: "订单不存在" });
        if (o.status === 10) { o.status = 20; o.paid_at = new Date().toISOString(); o.trade_no = tradeNo; }
        storage.set(K.orders, orders);
        // 记录推荐日志（演示 AI 选品闭环）
        return res(true, { order: o });
      }
    },

    /* ---------- AI 能力（降级契约：均返回 degraded 标记） ---------- */
    ai: {
      // 智能选品：画像/行为召回 → 业务规则 → 冷启动兜底
      async recommend({ scene, userId }) {
        await delay();
        const list = deepCopy(RT_PRODUCTS).filter(p => p.status === 1);
        let items;
        const beh = storage.get(K.behavior) || [];
        const viewedSkus = beh.filter(b => b.eventType === "view").map(b => b.skuId);
        if (viewedSkus.length && scene === "home") {
          const cats = new Set();
          viewedSkus.forEach(sid => { const p = RT_PRODUCTS.find(x => x.skus.some(s => s.skuId === sid)); if (p) cats.add(p.categoryId); });
          items = list.filter(p => cats.has(p.categoryId)).sort((a, b) => b.rating - a.rating);
        }
        if (!items || items.length < 4) items = list.slice().sort((a, b) => b.rating * 0.6 + b.sales / 1000 - (a.rating * 0.6 + a.sales / 1000));
        items = items.slice(0, 6);
        items.forEach(p => { p.min_price = productMinPrice(p); p.available = p.skus.reduce((s, x) => s + x.available, 0); });
        return res(true, { items, degraded: false, strategy: "hybrid_recall", scene: scene || "home" });
      },
      // 智能组货：搭配理由(模型) + 库存/价格/毛利校验(业务)
      _bundleSync(productId) {
        const b = bundles.find(x => x.items.indexOf(Number(productId)) >= 0 || x.mainProductId === Number(productId));
        if (!b) {
          // 降级：单品推荐
          const p = RT_PRODUCTS.find(x => x.productId === Number(productId));
          if (!p) return null;
          return { degraded: true, degradeReason: "暂无匹配组货方案", items: [{ title: p.title, min_price: productMinPrice(p) }] };
        }
        const items = b.items.map(pid => { const p = RT_PRODUCTS.find(x => x.productId === pid); return p ? { title: p.title, price: productMinPrice(p), productId: p.productId } : null; }).filter(Boolean);
        const ok = items.length >= 2 && items.every(i => { const p = RT_PRODUCTS.find(x => x.productId === i.productId); return p && p.skus.some(s => s.available > 0); });
        if (!ok) return { degraded: true, degradeReason: "组合中部分商品库存不足，已降级为单品推荐", bundle: b, items: items.map(i => ({ title: i.title, min_price: i.price })) };
        return { degraded: false, bundle: { reason: b.reason, price: b.bundlePrice, grossRate: b.grossRate, sceneTag: b.sceneTag, items }, items };
      },
      async bundle(productId) { await delay(); return res(true, this._bundleSync(productId) || { degraded: true, degradeReason: "暂无组货建议" }); },
      // 智能客服：意图识别 → 知识库 RAG / 业务工具 → 护栏 → 降级
      async chat({ message, sessionId }) {
        await delay(180);
        const text = String(message || "").toLowerCase();
        let content, confidence = 0.92, degraded = false;
        // 业务工具：查订单/物流
        if (text.indexOf("订单") >= 0 || text.indexOf("物流") >= 0 || text.indexOf("发货") >= 0 || text.indexOf("运单") >= 0) {
          const u = storage.get(K.user);
          const orders = (storage.get(K.orders) || []).filter(o => !u || o.user_id === u.userId);
          if (orders.length) {
            const last = orders[0];
            const stTxt = ({ 10: "待支付", 20: "已支付待发货", 30: "待发货", 40: "已发货", 50: "已完成", 60: "已关闭", 90: "已退款" })[last.status] || "处理中";
            content = "您最近的订单 " + last.order_no + " 当前状态：" + stTxt + (last.tracking_no ? "，运单号 " + last.tracking_no : "，付款后将尽快发货") + "。如需进一步操作可在「我的订单」中进行。";
          } else { content = "您暂无可查询的订单。如需下单，可前往「商品」页浏览并加入购物车。"; }
          confidence = 0.95;
        } else if (text.indexOf("退") >= 0 || text.indexOf("换") >= 0) {
          const k = knowledge.find(x => x.categoryCode === "return"); content = k.content; confidence = 0.9;
        } else if (text.indexOf("支付") >= 0 || text.indexOf("付款") >= 0 || text.indexOf("钱") >= 0) {
          const k = knowledge.find(x => x.categoryCode === "payment"); content = k.content; confidence = 0.9;
        } else if (text.indexOf("优惠") >= 0 || text.indexOf("券") >= 0 || text.indexOf("折扣") >= 0) {
          const k = knowledge.find(x => x.categoryCode === "coupon"); content = k.content; confidence = 0.88;
        } else if (text.indexOf("会员") >= 0 || text.indexOf("等级") >= 0) {
          const k = knowledge.find(x => x.categoryCode === "member"); content = k.content; confidence = 0.85;
        } else if (text.indexOf("库存") >= 0 || text.indexOf("有货") >= 0) {
          const k = knowledge.find(x => x.categoryCode === "stock"); content = k.content; confidence = 0.85;
        } else if (text.indexOf("智能") >= 0 || text.indexOf("ai") >= 0 || text.indexOf("能力") >= 0) {
          const k = knowledge.find(x => x.categoryCode === "ai"); content = k.content; confidence = 0.85;
        } else if (text.indexOf("你好") >= 0 || text.indexOf("hi") >= 0 || text.indexOf("在吗") >= 0) {
          content = "您好，我是智选云智能客服 😊。我可以帮您查询订单/物流、解答退换货与支付问题，也能介绍我们的 AI 选品与组货能力。请问有什么可以帮您？";
          confidence = 0.98;
        } else {
          // 知识库模糊检索（RAG-lite）
          const hit = knowledge.find(k => k.content.toLowerCase().indexOf(text.replace(/[?？。.！!]/g, "")) >= 0)
            || knowledge.find(k => text.split("").some(ch => ch.length && k.content.indexOf(ch) >= 0 && ch.charCodeAt(0) > 200));
          if (hit) { content = hit.content; confidence = 0.8; }
          else { content = "您的问题我已记录。您可以在「用户中心-我的订单」自助处理订单与售后，或拨打客服热线 400-800-8000。常见问答：发货时效、7天无理由退换、模拟支付说明等。"; confidence = 0.55; degraded = true; }
        }
        // 会话持久化
        const conv = storage.get(K.conv) || {};
        const sid = sessionId || uid("s");
        conv[sid] = conv[sid] || [];
        conv[sid].push({ role: "user", content: message });
        conv[sid].push({ role: "bot", content, confidence });
        storage.set(K.conv, conv);
        return res(true, { sessionId: sid, content, confidence, degraded, degradeReason: degraded ? "未命中知识库，已转人工话术兜底" : "" });
      }
    },

    /* ---------- 用户中心 ---------- */
    user: {
      async profile() {
        await delay();
        const u = storage.get(K.user);
        if (!u) return res(false, { error: "未登录" });
        return res(true, { user: u, coupon: { amount: 20, name: "新人无门槛券" } });
      },
      async updateProfile(patch) {
        await delay();
        const cur = storage.get(K.user); if (!cur) return res(false, { error: "未登录" });
        Object.assign(cur, patch); storage.set(K.user, cur);
        const reg = storage.get(K.users) || [];
        const seedIdx = seedUsers.findIndex(s => s.userId === cur.userId);
        if (seedIdx >= 0) Object.assign(seedUsers[seedIdx], patch); else { const i = reg.findIndex(r => r.userId === cur.userId); if (i >= 0) Object.assign(reg[i], patch); }
        if (reg.length) storage.set(K.users, reg);
        return res(true, { user: cur });
      },
      async addresses() { await delay(); const u = storage.get(K.user); return res(true, { addresses: storage.get(K.addr) || (u ? defaultAddr(u) : []) }); },
      async saveAddress(a) {
        await delay();
        const list = storage.get(K.addr) || [];
        if (a.addrId) { const i = list.findIndex(x => x.addrId === a.addrId); if (i >= 0) list[i] = Object.assign(list[i], a); }
        else { a.addrId = uid("a"); if (a.isDefault) list.forEach(x => x.isDefault = false); list.push(a); }
        storage.set(K.addr, list); return res(true, { addresses: list });
      },
      async removeAddress(id) { await delay(); let list = storage.get(K.addr) || []; list = list.filter(x => x.addrId !== id); storage.set(K.addr, list); return res(true, { addresses: list }); },
      async favorites() {
        await delay();
        const fav = storage.get(K.fav) || [];
        const items = fav.map(pid => { const p = RT_PRODUCTS.find(x => x.productId === pid); if (!p) return null; p.min_price = productMinPrice(p); p.available = p.skus.reduce((s, x) => s + x.available, 0); return p; }).filter(Boolean);
        return res(true, { items });
      },
      async toggleFavorite(pid) {
        await delay();
        let fav = storage.get(K.fav) || [];
        const i = fav.indexOf(Number(pid));
        if (i >= 0) fav.splice(i, 1); else fav.push(Number(pid));
        storage.set(K.fav, fav);
        return res(true, { favorited: i < 0, favorites: fav });
      },
      async reviews() { await delay(); return res(true, { reviews: storage.get(K.reviews) || [] }); },
      async addReview(r) {
        await delay();
        const list = storage.get(K.reviews) || [];
        list.push({ reviewId: uid("r"), orderId: r.orderId, productId: r.productId, title: r.title, rating: r.rating, content: r.content, created_at: new Date().toISOString() });
        storage.set(K.reviews, list); return res(true, { reviews: list });
      },
      async dashboard() {
        await delay();
        const u = storage.get(K.user); if (!u) return res(false, { error: "未登录" });
        const orders = storage.get(K.orders) || [];
        const mine = orders.filter(o => o.user_id === u.userId);
        const byStatus = {};
        mine.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
        return res(true, {
          orderCount: mine.length, paidAmount: mine.filter(o => o.status >= 20).reduce((s, o) => s + o.pay_amount, 0),
          pendingPay: byStatus[10] || 0, pendingShip: orders.filter(o => o.status === 20 || o.status === 30).length,
          favorites: (storage.get(K.fav) || []).length, coupons: 1, byStatus
        });
      }
    },

    // 暴露给其它模块的小工具
    _util: { catById, leafIdsUnder, productMinPrice }
  };

  function defaultAddr(u) {
    return [{ addrId: uid("a"), name: u.nickname || "收货人", phone: u.mobile || "", detail: "北京市朝阳区demo路 1 号", isDefault: true }];
  }

  window.DB = { categories, products, knowledge, bundles, seedUsers, catById, leafIdsUnder, productMinPrice };
  window.Store = Store;
})();
