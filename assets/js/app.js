/* =====================================================================
   Coding Plan 选择指南 — 渲染与交互
   全部内容从 window.CP_DATA 渲染（HTML 不含任何数据）
   依据：DESIGN_SPEC.md §4 逐区块规格 / §5 交互与 JS / §6 可访问性
   ===================================================================== */
(function () {
  'use strict';

  var DATA = window.CP_DATA;
  if (!DATA || !Array.isArray(DATA.plans)) return;

  /* ---------------- 工具 ---------------- */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 数值加千分位（成本 1340 → "1,340"，SPEC §8「最高 Copilot Pro ¥1,340/亿」） */
  function fmtCost(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var VENDOR_MAP = {};
  DATA.vendors.forEach(function (v) { VENDOR_MAP[v.id] = v; });
  function vendorOf(id) {
    return VENDOR_MAP[id] || { id: id, name: id, region: '', url: '#' };
  }

  /* 厂商在数据文件中的序号（数值排序的次级键，保证同厂商行相邻，SPEC §4.4/§5.2） */
  var VENDOR_INDEX = {};
  DATA.vendors.forEach(function (v, i) { VENDOR_INDEX[v.id] = i; });

  /* 几何值（价格尺 --x、基准条 --w-pct）随数据变化，无法写在静态 style.css 里；
     按 §7「无内联样式」要求，统一注入到 <style id="cp-geometry">，DOM 不出现 style 属性 */
  var geometryRules = [];

  function applyGeometry() {
    var el = document.getElementById('cp-geometry');
    if (!el) {
      el = document.createElement('style');
      el.id = 'cp-geometry';
      document.head.appendChild(el);
    }
    el.textContent = geometryRules.join('');
  }

  /* ---------------- 数据时效横幅（SPEC §4.1a，第七轮新增） ----------------
     days = floor((Date.now() − meta.updated) / 86400e3)，days > 7 才渲染：
     全宽 --amber-wash 琥珀条（样式 .stale-banner），文案含天数与最近核实日期。
     渲染进 index.html 预留的空容器 #stale-banner（无则自建并插入 <main> 顶部）；
     未过期容器保持为空、不占位。普通文档流非 sticky——nav 的 top:0 吸顶
     （sticky 相对视口定位）不受其后兄弟节点影响。init() 最先执行本函数 */
  function renderStaleBanner() {
    var host = $('stale-banner');
    if (!host) {
      var main = document.querySelector('main');
      if (!main) return;
      host = document.createElement('div');
      host.id = 'stale-banner';
      main.parentNode.insertBefore(host, main);
    }
    var days = Math.floor((Date.now() - new Date(DATA.meta.updated).getTime()) / 86400e3);
    if (days > 7) {
      host.className = 'stale-banner';
      host.textContent = '数据快照已 ' + days + ' 天 · 最近核实 ' + DATA.meta.updated +
        ' · 优惠与价格可能已变动，购买前请以各官网为准';
    } else {
      host.removeAttribute('class'); /* 未过期：容器保持为空、不占位（连 class 属性也不留） */
      host.textContent = '';
    }
  }

  /* ---------------- hero（SPEC §4.2）+ footer 日期 ---------------- */
  function renderHero() {
    $('hero-title').textContent = DATA.plans.length + ' 档 Coding Plan，一张表选清楚。';
    $('hero-lede').textContent =
      '收录 ' + DATA.vendors.length + ' 家厂商、' + DATA.models.length + ' 个最新模型。' +
      '价格为官方渠道标价，核实于 ' + DATA.meta.updated + '；海外套餐保留美元原价，表格内附人民币换算参考。';

    var badgeTexts = ['各家额度口径不一', '多家存在新老用户划断', '部分套餐分峰谷计价'];
    $('hero-badges').innerHTML = badgeTexts.map(function (t) {
      return '<a class="hero-badge" href="#notes" title="' + esc(t) + '">' + esc(t) + '</a>';
    }).join('');

    $('footer-left').textContent = 'Coding Plan 选择指南 · 数据更新于 ' + DATA.meta.updated;
  }

  /* ---------------- picks 怎么选（SPEC §4.3） ---------------- */
  var PICK_DIMS = [
    { name: '性价比', key: 'value' },
    { name: '模型强度', key: 'model' },
    { name: '上手门槛', key: 'ease' }
  ];

  /* 5 格方块条：整格 accent 填充，x.5 半分用半透明填充格，空格 1px --line 线框 */
  function pickCellsHtml(score) {
    var html = '';
    for (var i = 0; i < 5; i++) {
      var cls = 'pick-cell';
      if (score >= i + 1) cls += ' pick-cell--full';
      else if (score > i) cls += ' pick-cell--half';
      else cls += ' pick-cell--empty';
      html += '<i class="' + cls + '" aria-hidden="true"></i>';
    }
    return html;
  }

  /* 评分块：三行维度条（性价比/模型强度/上手门槛）+ 分值，上下 1px --line 包夹 */
  function pickRatingHtml(rating) {
    if (!rating) return '';
    var rows = PICK_DIMS.map(function (d) {
      var v = rating[d.key];
      return '<div class="pick-rating-row"><span class="pick-dim">' + d.name +
        '</span><span class="pick-cells">' + pickCellsHtml(v) + '</span>' +
        '<span class="pick-score">' + v + '</span></div>';
    }).join('');
    return '<div class="pick-rating" role="img" aria-label="评分（满分 5）：' +
      PICK_DIMS.map(function (d) { return d.name + ' ' + rating[d.key]; }).join('，') + '">' +
      rows + '</div>';
  }

  function renderPicks() {
    $('picks-grid').innerHTML = DATA.picks.map(function (p, i) {
      return '<article class="pick-card' + (i === 0 ? ' pick-card--anchor' : '') + '">' +
        (p.rating && p.rating.overall != null
          ? '<span class="pick-overall">' + esc(p.rating.overall) + ' 分</span>'
          : '') +
        '<span class="pick-scene">' + esc(p.scene) + '</span>' +
        '<h3 class="pick-title">' + esc(p.title) + '</h3>' +
        '<p class="pick-price">' + esc(p.price) + '</p>' +
        pickRatingHtml(p.rating) +
        '<p class="pick-desc">' + esc(p.desc) + '</p>' +
        '<a class="pick-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">查看官方页</a>' +
        '</article>';
    }).join('');
  }

  /* ---------------- plans 套餐对比（SPEC §4.4/§5.2，状态机 {tab, query, minQuota, minBa, sort}） ---------------- */
  var planState = { tab: 'all', query: '', minQuota: '', minBa: '', sort: 'default' };

  var SORT_OPTIONS = [
    { key: 'default', label: '默认（按厂商分组）' },
    { key: 'price-asc', label: '月费 低→高' },
    { key: 'price-desc', label: '月费 高→低' },
    { key: 'cost-asc', label: '每亿 token 成本 低→高' },
    { key: 'cost-desc', label: '每亿 token 成本 高→低' },
    { key: 'quota-desc', label: '月额度 大→小' },
    { key: 'quota-asc', label: '月额度 小→大' },
    { key: 'ba-desc', label: '模型分 高→低' }
  ];

  function renderPlanControls() {
    var counts = { all: DATA.plans.length, cn: 0, overseas: 0 };
    DATA.plans.forEach(function (p) {
      var r = vendorOf(p.vendor).region;
      if (r === 'cn') counts.cn += 1;
      else if (r === 'overseas') counts.overseas += 1;
    });

    var tabs = [
      { key: 'all', label: '全部 ' + counts.all },
      { key: 'cn', label: '国内 · 人民币 ' + counts.cn },
      { key: 'overseas', label: '海外 · 美元 ' + counts.overseas }
    ];

    var host = $('plan-controls');
    host.innerHTML =
      '<div class="plan-tabs" role="group" aria-label="按地区筛选套餐">' +
      tabs.map(function (t) {
        var active = t.key === planState.tab;
        return '<button type="button" class="control-tab' + (active ? ' is-active' : '') +
          '" data-tab="' + t.key + '" aria-pressed="' + active + '">' + esc(t.label) + '</button>';
      }).join('') +
      '</div>' +
      '<input type="search" class="control-input" id="plan-search" placeholder="搜厂商 / 套餐 / 模型…" aria-label="搜索厂商、套餐或模型">' +
      '<label class="control-num"><span class="control-num-label">月额度 ≥</span>' +
      '<input type="number" class="control-input control-input--num" id="plan-min-quota" min="0" step="0.1" aria-label="月额度下限（亿 tokens/月）">' +
      '<span class="control-num-unit">亿</span></label>' +
      '<label class="control-num"><span class="control-num-label">BenchAlign ≥</span>' +
      '<input type="number" class="control-input control-input--num" id="plan-min-ba" min="0" step="1" aria-label="BenchAlign 分数下限">' +
      '<span class="control-num-unit">分</span></label>' +
      '<select class="control-select" id="plan-sort" aria-label="排序方式">' +
      SORT_OPTIONS.map(function (o) {
        return '<option value="' + o.key + '"' + (o.key === planState.sort ? ' selected' : '') + '>' +
          esc(o.label) + '</option>';
      }).join('') +
      '</select>' +
      '<button type="button" class="control-clear" id="plan-clear">清除筛选</button>';

    /* 表格上方说明行：汇率与日期取自 meta（SPEC §4.4） */
    $('plan-table-note').textContent =
      '¥/亿 = 月费 ÷ 月额度测算 · 带 * 为社区横评估算 · Credits/次数口径无法折算标 — · 海外按 ' +
      Number(DATA.meta.usdToCny).toFixed(2) + ' 汇率换算（' + DATA.meta.fxDate + '）';

    host.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-tab]') : null;
      if (!btn) return;
      planState.tab = btn.getAttribute('data-tab');
      Array.prototype.forEach.call(host.querySelectorAll('[data-tab]'), function (b) {
        var active = b.getAttribute('data-tab') === planState.tab;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      renderPlanRows();
    });

    $('plan-search').addEventListener('input', function (e) {
      planState.query = e.target.value.trim();
      renderPlanRows();
    });

    function bindNumFilter(id, key) {
      $(id).addEventListener('input', function (e) {
        planState[key] = e.target.value; /* 空串 = 未激活 */
        renderPlanRows();
      });
    }
    bindNumFilter('plan-min-quota', 'minQuota');
    bindNumFilter('plan-min-ba', 'minBa');

    $('plan-sort').addEventListener('change', function (e) {
      planState.sort = e.target.value;
      renderPlanRows();
    });

    /* 清除筛选：重置 query/两个数值/排序回默认；tab 保留（SPEC §4.4/§5.2） */
    $('plan-clear').addEventListener('click', function () {
      planState.query = '';
      planState.minQuota = '';
      planState.minBa = '';
      planState.sort = 'default';
      $('plan-search').value = '';
      $('plan-min-quota').value = '';
      $('plan-min-ba').value = '';
      $('plan-sort').value = 'default';
      renderPlanRows();
    });
  }

  /* 排序（SPEC §4.4/§5.2）：数值排序中对应字段为 null 的行恒排最后（任何方向；
     priceValue null 即按量计费同理）；次级键 = 厂商在数据文件中的序号（同厂商相邻），
     末级键 = 数据文件原顺序。default 不排序（厂商按文件顺序自然聚集） */
  var SORT_FIELD = {
    'price-asc': 'priceValue', 'price-desc': 'priceValue',
    'cost-asc': 'cost', 'cost-desc': 'cost',
    'quota-desc': 'quotaEst', 'quota-asc': 'quotaEst',
    'ba-desc': 'ba'
  };
  var SORT_DIR = {
    'price-asc': 1, 'price-desc': -1,
    'cost-asc': 1, 'cost-desc': -1,
    'quota-desc': -1, 'quota-asc': 1,
    'ba-desc': -1
  };

  function sortPlans(list) {
    var arr = list.slice();
    var field = SORT_FIELD[planState.sort];
    if (!field) return arr;
    var dir = SORT_DIR[planState.sort];
    arr.sort(function (a, b) {
      var av = a[field], bv = b[field];
      if (av == null && bv != null) return 1;
      if (bv == null && av != null) return -1;
      if (av != null && bv != null && av !== bv) return (av - bv) * dir;
      var d = VENDOR_INDEX[a.vendor] - VENDOR_INDEX[b.vendor];
      if (d !== 0) return d;
      return DATA.plans.indexOf(a) - DATA.plans.indexOf(b);
    });
    return arr;
  }

  function regionBadge(region) {
    if (region === 'cn') return '<span class="badge badge--region-cn" title="国内">国内</span>';
    return '<span class="badge badge--region-overseas" title="海外">海外</span>';
  }

  function flagBadge(flag) {
    if (flag === 'promo') return ' <span class="badge badge--promo" title="优惠">优惠</span>';
    if (flag === 'watch') return ' <span class="badge badge--watch" title="变动">变动</span>';
    return '';
  }

  /* 性价比测算列（SPEC §4.4）：三行结构 = cost 主行 + quotaEst 副行 + 「测算: quotaModel」第三行
     （10.5px --ink-3；quotaModel 为 null 时省略第三行）；整格 hover title = perfNote 完整口径；
     无值单行 —（hover title = perfNote）；DeepSeek 行（API 按量口径）主行 —、副行显示 perfNote，逻辑不变 */
  function costCellHtml(p) {
    if (p.cost != null) {
      return '<td class="cell-cost"' + (p.perfNote ? ' title="' + esc(p.perfNote) + '"' : '') + '>' +
        '<div class="cell-cost-main">¥' + esc(fmtCost(p.cost)) + ' / 亿</div>' +
        '<div class="cell-cost-sub">≈ ' + esc(p.quotaEst) + ' 亿 tokens/月</div>' +
        (p.quotaModel ? '<div class="cell-cost-model">测算: ' + esc(p.quotaModel) + '</div>' : '') +
        '</td>';
    }
    if (p.vendor === 'deepseek') {
      return '<td class="cell-cost"><div class="cell-cost-none">—</div>' +
        (p.perfNote ? '<div class="cell-cost-sub">' + esc(p.perfNote) + '</div>' : '') + '</td>';
    }
    return '<td class="cell-cost"' + (p.perfNote ? ' title="' + esc(p.perfNote) + '"' : '') +
      '><div class="cell-cost-none">—</div></td>';
  }

  /* BenchAlign 列（右对齐）：有值 accent 蓝 + baNote 副行；无值 —（hover title = baNote） */
  function baCellHtml(p) {
    if (p.ba != null) {
      return '<td class="cell-ba"><div class="cell-ba-val">' + esc(p.ba) + '</div>' +
        (p.baNote ? '<div class="cell-ba-note">' + esc(p.baNote) + '</div>' : '') + '</td>';
    }
    return '<td class="cell-ba"' + (p.baNote ? ' title="' + esc(p.baNote) + '"' : '') +
      '><div class="cell-ba-none">—</div></td>';
  }

  function planRowHtml(p, gs) {
    var v = vendorOf(p.vendor);
    var cls = 'plan-row';
    /* 默认排序的厂商聚集视觉：第偶数个厂商组整组 #FAFAFC 底（奇数组白底），
       组间 1px --line-strong 分隔（分组行后/表首不加分隔）；数值排序不加组背景 */
    if (planState.sort === 'default' && gs) {
      if (p.vendor !== gs.vendor) {
        gs.vendor = p.vendor;
        gs.index += 1;
        gs.newGroup = true;
      } else {
        gs.newGroup = false;
      }
      if (gs.index % 2 === 0) cls += ' plan-row--group'; /* 第偶数个厂商组 */
      if (gs.newGroup && gs.afterPlanRow) cls += ' plan-row--gsep';
      gs.afterPlanRow = true;
    }
    return '<tr class="' + cls + '">' +
      '<td><div class="vendor-cell"><a class="vendor-name" href="' + esc(v.url) +
      '" target="_blank" rel="noopener">' + esc(v.name) + '</a>' + regionBadge(v.region) + '</div></td>' +
      '<td><div class="cell-plan">' + esc(p.plan) + flagBadge(p.flag) + '</div></td>' +
      '<td><div class="cell-price-main">' + esc(p.price) + '</div>' +
      (p.subPrice ? '<div class="cell-price-sub">' + esc(p.subPrice) + '</div>' : '') +
      /* 海外套餐（cny 非 null 且 >0）追加人民币换算行，汇率取 meta.usdToCny */
      (p.cny != null && p.cny > 0
        ? '<div class="cell-price-sub">≈¥' + esc(p.cny) + ' · 汇率 ' +
          esc(Number(DATA.meta.usdToCny).toFixed(2)) + '</div>'
        : '') +
      '</td>' +
      costCellHtml(p) +
      baCellHtml(p) +
      '<td class="cell-quota">' + esc(p.quota) + '</td>' +
      '<td class="cell-models">' + esc(p.models) + '</td>' +
      '<td class="cell-tools">' + esc(p.tools) + '</td>' +
      '<td class="cell-note">' + esc(p.note) + '</td>' +
      '</tr>';
  }

  function renderPlanRows() {
    var tbody = $('plan-tbody');
    var q = planState.query.toLowerCase();
    /* 空串 = 未激活；激活时对应字段为 null 的行隐藏，与 tab/搜索 AND 叠加（SPEC §4.4） */
    var minQuota = planState.minQuota === '' ? null : parseFloat(planState.minQuota);
    var minBa = planState.minBa === '' ? null : parseFloat(planState.minBa);

    var matched = DATA.plans.filter(function (p) {
      if (planState.tab !== 'all' && vendorOf(p.vendor).region !== planState.tab) return false;
      if (minQuota != null && (p.quotaEst == null || p.quotaEst < minQuota)) return false;
      if (minBa != null && (p.ba == null || p.ba < minBa)) return false;
      if (!q) return true;
      var v = vendorOf(p.vendor);
      return [v.name, p.plan, p.models, p.tools].some(function (field) {
        return String(field == null ? '' : field).toLowerCase().indexOf(q) !== -1;
      });
    });

    var cn = sortPlans(matched.filter(function (p) { return vendorOf(p.vendor).region === 'cn'; }));
    var overseas = sortPlans(matched.filter(function (p) { return vendorOf(p.vendor).region === 'overseas'; }));

    /* 厂商组计数贯穿整个渲染结果（「全部」下国内段续排到海外段） */
    var gs = { vendor: null, index: 0, newGroup: false, afterPlanRow: false };
    function groupRow(label, dotCls) {
      gs.afterPlanRow = false; /* 分组行后首个厂商组不再加分隔线 */
      return '<tr class="group-row"><td colspan="9"><span class="group-dot ' + dotCls +
        '" aria-hidden="true"></span>' + label + '</td></tr>';
    }

    var html = '';
    if (matched.length === 0) {
      html = '<tr class="empty-row"><td colspan="9">没有匹配的套餐，换个关键词试试。</td></tr>';
    } else if (planState.tab === 'all') {
      /* 分组行仅在「全部」下出现，顺序 国内 → 海外 */
      html += groupRow('国内 · 人民币', 'group-dot--cn');
      html += cn.map(function (p) { return planRowHtml(p, gs); }).join('');
      html += groupRow('海外 · 美元', 'group-dot--overseas');
      html += overseas.map(function (p) { return planRowHtml(p, gs); }).join('');
    } else {
      html = (planState.tab === 'cn' ? cn : overseas)
        .map(function (p) { return planRowHtml(p, gs); }).join('');
    }
    tbody.innerHTML = html;
    /* 重渲染只重建 tbody、不触及 .table-scroll（监听与按钮保留），仅刷新按钮亮灭/遮罩态 */
    updateScrollXAll();
  }

  /* ---------------- 性价比速览条形图（SPEC §4.5a，表格下方子区块） ----------------
     plans 中 cost != null 的档位按 cost 升序；条宽 = minCost / cost * 100%（最便宜满条）；
     国内 --accent / 海外 --ink-2；label = 厂商名 + 套餐名，title 悬挂完整 perfNote */
  /* label 拼接：套餐名与厂商名末词重复时去重（GitHub Copilot + Copilot Pro →
     GitHub Copilot Pro，而非 GitHub Copilot Copilot Pro）；其余原样拼接 */
  function costLabelOf(vendorName, plan) {
    var vWords = String(vendorName).split(/\s+/);
    var pWords = String(plan).split(/\s+/);
    if (vWords.length > 0 && pWords.length > 0 &&
        vWords[vWords.length - 1].toLowerCase() === pWords[0].toLowerCase()) {
      pWords = pWords.slice(1);
    }
    return vWords.concat(pWords).join(' ');
  }

  function renderCostQuicklook() {
    var host = $('cost-quicklook');
    if (!host) return;
    var items = DATA.plans.filter(function (p) { return p.cost != null; })
      .sort(function (a, b) { return a.cost - b.cost; });
    if (items.length === 0) { host.innerHTML = ''; return; }
    var minCost = items[0].cost;

    $('cost-quicklook-sub').textContent =
      '条越长越便宜 · ' + items.length + ' 档有可靠测算 · 带 * 为第三方口径，详见口径说明';

    host.innerHTML =
      '<div class="cost-legend">' +
      '<span class="cost-legend-item"><i class="cost-swatch cost-swatch--cn" aria-hidden="true"></i>国内</span>' +
      '<span class="cost-legend-item"><i class="cost-swatch cost-swatch--overseas" aria-hidden="true"></i>海外</span>' +
      '<span class="cost-legend-min">最便宜 ≈ ¥' + esc(fmtCost(minCost)) + '/亿</span>' +
      '</div>' +
      '<div class="cost-grid">' +
      items.map(function (p, i) {
        var v = vendorOf(p.vendor);
        /* 条宽为数据几何值，同基准榜走 cp-geometry 注入（§7 无内联样式） */
        geometryRules.push('.cost-grid .cost-item:nth-child(' + (i + 1) + ') .cost-bar{--w-pct:' +
          (minCost / p.cost * 100).toFixed(2) + '%}');
        return '<div class="cost-item' + (v.region === 'overseas' ? ' cost-item--overseas' : '') +
          '" title="' + esc(p.perfNote) + '">' +
          '<span class="cost-label">' + esc(costLabelOf(v.name, p.plan)) + '</span>' +
          '<span class="cost-track"><span class="cost-bar"></span></span>' +
          '<span class="cost-value">¥' + esc(fmtCost(p.cost)) + '/亿</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  /* ---------------- ruler 价格一览（SPEC §4.5） ---------------- */
  var RULER_RULES_AT = -1; /* 价格尺段规则在 geometryRules 的起点；resize 重渲染时截断旧规则 */

  /* 分段比例定位：breakpoints 把价格区间切成等宽段，段内线性。
     低价区密集、高价区稀疏，等宽分段把低价区展开、避免圆点挤死在左端。 */
  function rulerPosOf(value, bp) {
    var n = bp.length;
    if (n < 2) return 0;
    for (var i = 0; i < n - 1; i++) {
      if (value <= bp[i + 1] || i === n - 2) {
        var span = (bp[i + 1] - bp[i]) || 1;
        var t = Math.min(1, Math.max(0, (value - bp[i]) / span));
        return (i + t) * (100 / (n - 1));
      }
    }
    return 100;
  }

  function renderRuler() {
    if (RULER_RULES_AT < 0) RULER_RULES_AT = geometryRules.length;
    else geometryRules.length = RULER_RULES_AT;

    var lanes = [
      { key: 'cn', name: '国内 · 月费（¥）' },
      { key: 'overseas', name: '海外 · 月费（$）' }
    ];

    $('ruler-lanes').innerHTML = lanes.map(function (laneDef) {
      var lane = DATA.priceRuler[laneDef.key];
      var unit = lane.unit;
      var bp = lane.breakpoints;
      var laneSel = '.ruler-lane--' + laneDef.key;
      var steps = bp.length - 1;

      /* 段界刻度：每个段界（含 0 与右端，SPEC §4.5「每个段界一条 1px 竖向虚线…段界上方标数值」）
         一条竖虚线 + 段界数值；轴为分段比例，低价段等宽展开 */
      var ticks = '';
      for (var b = 0; b < bp.length; b++) {
        var tpct = b * (100 / steps);
        var tickCls = b === 0 ? ' ruler-tick--start' : b === steps ? ' ruler-tick--end' : '';
        geometryRules.push(laneSel + ' .ruler-tick[data-b="' + b + '"]{--x:' + tpct.toFixed(3) + '%}');
        ticks += '<span class="ruler-tick' + tickCls +
          '" data-b="' + b + '" aria-hidden="true"><i class="ruler-tick-val">' +
          esc(bp[b]) + '</i></span>';
      }

      var dots = lane.items.map(function (it, i) {
        var pos = rulerPosOf(it.value, bp);
        pos = Math.min(99.2, Math.max(0.8, pos)); /* 首尾圆点收进泳道，避免半圆出界 */
        var edge = pos < 8 ? 'start' : pos > 92 ? 'end' : '';
        var cls = 'ruler-dot' + (it.value === 0 ? ' ruler-dot--hollow' : '') +
          (edge ? ' ruler-dot--edge-' + edge : '');
        var shown = it.vText || (unit + it.value);
        geometryRules.push(laneSel + ' .ruler-dot[data-i="' + i + '"]{--x:' + pos.toFixed(3) + '%}');
        return '<button type="button" class="' + cls + '" data-i="' + i +
          '" aria-label="' + esc(it.label) + '：' + esc(shown) + '">' +
          '<span class="ruler-tip"><span class="ruler-tip-label">' + esc(it.label) +
          '</span><span class="ruler-tip-value">' + esc(shown) + '</span></span>' +
          '</button>';
      }).join('');

      /* 标签位置先按百分比占位；渲染后测量宽度做四行贪心排布（见下） */
      var labels = lane.items.map(function (it, i) {
        var pos = rulerPosOf(it.value, bp);
        geometryRules.push(laneSel + ' .ruler-label[data-i="' + i + '"]{--x:' + pos.toFixed(3) + '%}');
        return '<span class="ruler-label" data-i="' + i + '" data-pos="' + pos.toFixed(3) + '">' +
          esc(it.label) + '</span>';
      }).join('');

      return '<div class="ruler-lane ruler-lane--' + laneDef.key + '">' +
        '<span class="ruler-lane-label">' + esc(laneDef.name) + '</span>' +
        ticks +
        '<span class="ruler-axis" aria-hidden="true"></span>' +
        dots + labels +
        '</div>';
    }).join('');

    /* 标签四行贪心排布：按位置排序、量宽，放进第一条放得下的行；
       最终 left 用像素值覆盖占位百分比，行内互不重叠 */
    Array.prototype.forEach.call(document.querySelectorAll('.ruler-lane'), function (laneEl) {
      var W = laneEl.clientWidth;
      if (!W) return;
      var laneSel = '.' + laneEl.className.trim().split(/\s+/).join('.');
      var rowEnds = [-Infinity, -Infinity, -Infinity, -Infinity]; /* 四行贪心排布（SPEC §4.5，行距 8/30/52/74px） */
      var labelEls = Array.prototype.slice.call(laneEl.querySelectorAll('.ruler-label'))
        .sort(function (a, b) {
          return parseFloat(a.getAttribute('data-pos')) - parseFloat(b.getAttribute('data-pos'));
        });
      labelEls.forEach(function (el) {
        var w = el.offsetWidth;
        var cx = (parseFloat(el.getAttribute('data-pos')) / 100) * W;
        var left = Math.min(Math.max(0, cx - w / 2), Math.max(0, W - w));
        var row = 0;
        for (var r = 0; r < rowEnds.length; r++) {
          if (left >= rowEnds[r] + 10) { row = r; break; }
          if (rowEnds[r] < rowEnds[row]) row = r;
        }
        rowEnds[row] = left + w;
        el.classList.add('ruler-label--r' + row);
        geometryRules.push(laneSel + ' .ruler-label[data-i="' + el.getAttribute('data-i') +
          '"]{--x:' + left.toFixed(1) + 'px}');
      });
    });
  }

  /* ---------------- models 模型对比（SPEC §4.6，11 列分列版） ----------------
     七个分数列各自独立、绝不混写一格，每列用显式访问器直接读取对应模型字段
     （ba/tb21/tb40/swev/swepro/dswe/aa）；无分数显 —（绝不编数）；
     每列非空最高分整格 --accent-wash 底 + --accent 字；厂商与发布日期收进模型名 hover title */
  /* key 与数据侧 tpCols 数组中的列标识一致（§4.6 第五轮：tpCols 所列列加 † 上标）。
     pct:true 的百分制列渲染时 toFixed(1)——97.0 不得序列化成 97（§4.6 分数格式条）；
     AA 列为整数指数，不加小数位 */
  var MODEL_SCORE_COLS = [
    { key: 'ba', name: 'BenchAlign', pct: true, get: function (m) { return m.ba; } },
    { key: 'tb21', name: 'TB 2.1', pct: true, get: function (m) { return m.tb21; } },
    { key: 'tb40', name: 'TB 4.0', pct: true, get: function (m) { return m.tb40; } },
    { key: 'swev', name: 'SWE-V', pct: true, get: function (m) { return m.swev; } },
    { key: 'swepro', name: 'SWE-Pro', pct: true, get: function (m) { return m.swepro; } },
    { key: 'dswe', name: 'DeepSWE', pct: true, get: function (m) { return m.dswe; } },
    { key: 'aa', name: 'AA 指数', get: function (m) { return m.aa; } }
  ];

  /* 每个分数列的非空最高分（并列最高同突出，如 SWE-V 80.6 两模型并列） */
  MODEL_SCORE_COLS.forEach(function (col) {
    var vals = DATA.models.map(col.get)
      .filter(function (v) { return v != null; });
    col.max = vals.length ? Math.max.apply(null, vals) : null;
  });

  /* † 三方口径上标（SPEC §4.6 第五轮）：tpCols 所列分数列数值后加 †（10px --ink-3），
     整格 hover title 注明口径；最高分高亮逻辑不变（† 值同样参与判定） */
  var TP_TITLE = '第三方统一复测（Vals / Morph 等）';

  function renderModels() {
    $('model-tbody').innerHTML = DATA.models.map(function (m) {
      var cells = MODEL_SCORE_COLS.map(function (col) {
        var v = col.get(m);
        if (v == null) return '<td class="cell-score cell-score--none">—</td>';
        var top = col.max != null && v === col.max;
        var tp = Array.isArray(m.tpCols) && m.tpCols.indexOf(col.key) !== -1;
        /* 百分制列统一一位小数（97.0 不显示 97，§4.6 分数格式条）；AA 整数不加小数 */
        var text = col.pct ? Number(v).toFixed(1) : String(v);
        return '<td class="cell-score' + (top ? ' cell-score--top' : '') + '"' +
          (tp ? ' title="' + esc(TP_TITLE) + '"' : '') + '>' + esc(text) +
          (tp ? '<sup class="score-tp">†</sup>' : '') + '</td>';
      }).join('');
      return '<tr class="model-row">' +
        '<td><span class="cell-model-name" title="' + esc(m.vendor) + ' · ' + esc(m.date) + ' 发布">' +
        esc(m.name) + '</span>' +
        (m.hot ? ' <span class="badge badge--hot" title="新锐">新锐</span>' : '') + '</td>' +
        '<td class="cell-ctx">' + esc(m.ctx) + '</td>' +
        '<td class="cell-api">' + esc(m.apiPrice) + '</td>' +
        cells +
        '<td class="cell-tag">' + esc(m.tag) + '</td>' +
        '</tr>';
    }).join('');

    /* 表下图例行（SPEC §4.6：表格说明区右侧，12px --ink-3） */
    var note = $('model-table-note');
    if (note) {
      note.textContent = '† 为第三方统一复测口径，与官方自报同列但不可直接横比 · 留白 = 未查到可靠分数';
    }
  }

  function renderBenchmarks() {
    $('bench-grid').innerHTML = DATA.benchmarks.map(function (group, g) {
      var max = Math.max.apply(null, group.items.map(function (it) { return it.value; }));
      var items = group.items.map(function (it, i) {
        geometryRules.push('.bench-group:nth-child(' + (g + 1) + ') .bench-item:nth-child(' + (i + 1) +
          ') .bench-bar{--w-pct:' + (max > 0 ? (it.value / max) * 100 : 0).toFixed(1) + '%}');
        return '<div class="bench-item' + (i === 0 ? ' bench-item--top' : '') + '">' +
          '<span class="bench-label" title="' + esc(it.label) + '">' + esc(it.label) + '</span>' +
          '<span class="bench-track"><span class="bench-bar"></span></span>' +
          '<span class="bench-value">' + esc(it.value) + '</span>' +
          '</div>';
      }).join('');
      /* 非默认底色按组名关键词判断（不按组序号，组顺序调整/增删时更稳）：
         AA 组（第三方聚合口径）--ink-2、Vals 三方复测组 --green、DeepSWE 防污染组 --amber，
         与官方自报组的 accent 区分（SPEC §4.6 六组） */
      var gname = String(group.name);
      var isAA = gname.indexOf('AA Intelligence Index') !== -1;
      var isVals = gname.indexOf('Vals') !== -1;
      var isDSWE = gname.indexOf('DeepSWE') !== -1;
      return '<div class="bench-group' + (isAA ? ' bench-group--aa' : '') +
        (isVals ? ' bench-group--vals' : '') + (isDSWE ? ' bench-group--dswe' : '') +
        '"><h3 class="bench-name">' + esc(group.name) +
        '</h3><div class="bench-items">' + items + '</div></div>';
    }).join('');

    $('bench-note').textContent = DATA.benchmarkNote;
  }

  /* ---------------- 输出价 × 编程基准象限图 v2（SPEC §4.6a） ----------------
     四枚基准切换 tab（复用套餐表 .control-tab 样式与激活态）：BenchAlign（默认）/
     Terminal-Bench 2.1 / AA 指数 / DeepSWE，切换整图重绘；y 域按当前点集自适应（整 5 对齐；
     点距不足 15 分改按 1 对齐；保证至少 3 条刻度）；左上象限整块绿洗底「又便宜又强」、
     右下灰洗底「贵且弱」；分界 = x@中位 outUsd 与 y@(lo+hi)/2 两条虚线 */
  var SC_PLOT = { l: 60, t: 60, r: 680, b: 360 }; /* viewBox 720×420：顶部 60px 留最高刻度与象限文字，底部 60px 留 x 刻度与图例 */
  var SC_X0 = Math.log(0.4) / Math.LN10, SC_X1 = Math.log(60) / Math.LN10;
  var SC_XTICKS = [0.5, 1, 2, 5, 10, 20, 50];

  /* 副注尾随当前基准口径：BenchAlign 日期取自基准榜名（非硬编码），其余为规范给定口径文案。
     get 为显式字段访问器（m.ba / m.tb21 / m.aa / m.dswe），key 仅作 tab 的 DOM 状态标识 */
  var SC_METRICS = [
    { key: 'ba', tab: 'BenchAlign', get: function (m) { return m.ba; },
      tail: function () {
        var cal = /(\d{4}-\d{2}-\d{2}) 重校准版/.exec(DATA.benchmarks[0] ? DATA.benchmarks[0].name : '');
        return 'BenchAlign ' + (cal ? cal[1] : DATA.meta.updated) + ' 重校准版';
      } },
    { key: 'tb21', tab: 'Terminal-Bench 2.1', get: function (m) { return m.tb21; },
      tail: function () { return 'TB 2.1 官方自报'; } },
    { key: 'aa', tab: 'AA 指数', get: function (m) { return m.aa; },
      tail: function () { return 'AA 指数 v4.3.2 第三方聚合'; } },
    { key: 'dswe', tab: 'DeepSWE', get: function (m) { return m.dswe; },
      tail: function () { return 'DeepSWE v1.1 防污染 · 官方/转述'; } }
  ];

  var scatterState = { metric: 'ba' };

  /* 基准切换 tab：点击后整图重绘（renderScatter） */
  function renderScatterTabs() {
    var host = $('scatter-tabs');
    if (!host) return;
    host.innerHTML = SC_METRICS.map(function (mt) {
      var active = mt.key === scatterState.metric;
      return '<button type="button" class="control-tab' + (active ? ' is-active' : '') +
        '" data-metric="' + mt.key + '" aria-pressed="' + active + '">' + esc(mt.tab) + '</button>';
    }).join('');
    host.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-metric]') : null;
      if (!btn) return;
      scatterState.metric = btn.getAttribute('data-metric');
      Array.prototype.forEach.call(host.querySelectorAll('[data-metric]'), function (b) {
        var active = b.getAttribute('data-metric') === scatterState.metric;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      renderScatter();
    });
  }

  function renderScatter() {
    var host = $('scatter-plot');
    if (!host) return;
    var metric = SC_METRICS[0];
    SC_METRICS.forEach(function (mt) { if (mt.key === scatterState.metric) metric = mt; });

    /* 当前基准有分且有输出价的模型（SPEC §4.6a：METRIC ∈ {ba, tb21, aa, dswe}） */
    var pts = DATA.models.filter(function (m) { return m[metric.key] != null && m.outUsd != null; });
    if (pts.length === 0) { host.innerHTML = ''; return; }

    function median(nums) {
      var s = nums.slice().sort(function (a, b) { return a - b; });
      var mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }

    /* y 域按当前点集自适应：lo = floor((min-2)/5)*5、hi = ceil((max+2)/5)*5 整 5 对齐；
       hi-lo < 15 改按 1 对齐；保证至少 3 条刻度 */
    var scores = pts.map(function (m) { return m[metric.key]; });
    var min = Math.min.apply(null, scores), max = Math.max.apply(null, scores);
    var lo = Math.floor((min - 2) / 5) * 5;
    var hi = Math.ceil((max + 2) / 5) * 5;
    var step = 5;
    if (hi - lo < 15) {
      lo = Math.floor(min - 2);
      hi = Math.ceil(max + 2);
      step = 1;
    }
    if ((hi - lo) / step + 1 < 3) step = 1;

    function scX(outUsd) {
      return SC_PLOT.l + (Math.log(outUsd) / Math.LN10 - SC_X0) / (SC_X1 - SC_X0) * (SC_PLOT.r - SC_PLOT.l);
    }
    function scY(score) {
      return SC_PLOT.b - (score - lo) / (hi - lo) * (SC_PLOT.b - SC_PLOT.t);
    }

    /* 副注随 tab 更新：固定提示 + 当前基准口径（见 SC_METRICS.tail） */
    $('scatter-sub').textContent =
      '气泡越靠左上越划算 · 分数口径随所选基准切换 · AA 与其他基准量纲不同不可横比 · ' + metric.tail();

    var mx = scX(median(pts.map(function (m) { return m.outUsd; })));
    var my = scY((lo + hi) / 2);

    var out = [];
    out.push('<svg class="scatter-svg" viewBox="0 0 720 420" role="img" aria-label="输出价 × ' + esc(metric.tab) +
      ' 象限散点图：' + pts.length + ' 个模型，横轴为每百万 tokens 输出价（对数刻度），纵轴为 ' +
      esc(metric.tab) + ' 分，越靠左上越划算">');

    /* 象限整块底色：左上 rgba(14,122,79,.06)、右下 rgba(28,36,51,.03)，画在网格线下层 */
    out.push('<rect class="scatter-quadrant--good" x="' + SC_PLOT.l + '" y="' + SC_PLOT.t +
      '" width="' + (mx - SC_PLOT.l).toFixed(1) + '" height="' + (my - SC_PLOT.t).toFixed(1) + '"/>');
    out.push('<rect class="scatter-quadrant--weak" x="' + mx.toFixed(1) + '" y="' + my.toFixed(1) +
      '" width="' + (SC_PLOT.r - mx).toFixed(1) + '" height="' + (SC_PLOT.b - my).toFixed(1) + '"/>');

    /* 网格刻度：x 轴 $0.5/$1/$2/$5/$10/$20/$50；y 轴 lo→hi 每 step 分一条（1px 线 + 10.5px 标签） */
    SC_XTICKS.forEach(function (v) {
      var x = scX(v).toFixed(1);
      out.push('<line class="scatter-gridline" x1="' + x + '" y1="' + SC_PLOT.t + '" x2="' + x + '" y2="' + SC_PLOT.b + '"/>');
      out.push('<text class="scatter-tick-label" x="' + x + '" y="376" text-anchor="middle">$' + v + '</text>');
    });
    for (var v = lo; v <= hi; v += step) {
      var y = scY(v).toFixed(1);
      out.push('<line class="scatter-gridline" x1="' + SC_PLOT.l + '" y1="' + y + '" x2="' + SC_PLOT.r + '" y2="' + y + '"/>');
      out.push('<text class="scatter-tick-label" x="' + (SC_PLOT.l - 6) + '" y="' + (Number(y) + 3.5).toFixed(1) + '" text-anchor="end">' + v + '</text>');
    }

    /* 轴线与两条象限分界虚线（x@中位输出价、y@(lo+hi)/2） */
    out.push('<line class="scatter-axis" x1="' + SC_PLOT.l + '" y1="' + SC_PLOT.b + '" x2="' + SC_PLOT.r + '" y2="' + SC_PLOT.b + '"/>');
    out.push('<line class="scatter-axis" x1="' + SC_PLOT.l + '" y1="' + SC_PLOT.t + '" x2="' + SC_PLOT.l + '" y2="' + SC_PLOT.b + '"/>');
    out.push('<line class="scatter-median" x1="' + mx.toFixed(1) + '" y1="' + SC_PLOT.t + '" x2="' + mx.toFixed(1) + '" y2="' + SC_PLOT.b + '"/>');
    out.push('<line class="scatter-median" x1="' + SC_PLOT.l + '" y1="' + my.toFixed(1) + '" x2="' + SC_PLOT.r + '" y2="' + my.toFixed(1) + '"/>');

    /* 象限角标文字（角内）：左上 11px --green，右下 11px --ink-3 */
    out.push('<text class="scatter-motto--good" x="' + (SC_PLOT.l + 8) + '" y="' + (SC_PLOT.t + 16) + '">又便宜又强</text>');
    out.push('<text class="scatter-motto--weak" x="' + (SC_PLOT.r - 8) + '" y="' + (SC_PLOT.b - 10) + '" text-anchor="end">贵且弱</text>');

    /* 点 + 标签：点色 region==='cn' --green / 海外 --accent；hover r5→r7 + <title>
       （模型名 · 厂商 · $输出价/百万 · 当前基准分数）；标签按 px 排序后上下交替偏移 12px 防碰 */
    var ordered = pts.map(function (m) {
      return { m: m, px: scX(m.outUsd), py: scY(m[metric.key]) };
    }).sort(function (a, b) { return a.px - b.px; });
    ordered.forEach(function (o, i) {
      var tip = o.m.name + ' · ' + o.m.vendor + ' · $' + o.m.outUsd + '/百万 · ' + metric.tab + ' ' + o.m[metric.key];
      out.push('<circle class="scatter-dot' + (o.m.region === 'cn' ? ' scatter-dot--cn' : '') +
        '" cx="' + o.px.toFixed(1) + '" cy="' + o.py.toFixed(1) + '" r="5">' +
        '<title>' + esc(tip) + '</title></circle>');
      var estW = o.m.name.length * 6.4; /* 10.5px 拉丁字宽估算，仅用于贴缘判定 */
      var anchorEnd = o.px + 9 + estW > SC_PLOT.r + 34;
      var lx = anchorEnd ? o.px - 9 : o.px + 9;
      var ly = o.py + 4 + (i % 2 === 0 ? -12 : 12);
      out.push('<text class="scatter-label" data-i="' + i + '" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '"' +
        (anchorEnd ? ' text-anchor="end"' : '') + '>' + esc(o.m.name) + '</text>');
    });

    /* 左下角图例：两枚 10px 色点 + 文字（国内 --green / 海外 --accent） */
    out.push('<circle class="scatter-legend-dot scatter-legend-dot--cn" cx="64" cy="400" r="5"/>');
    out.push('<text class="scatter-legend-text" x="76" y="404">国内厂商</text>');
    out.push('<circle class="scatter-legend-dot scatter-legend-dot--ov" cx="142" cy="400" r="5"/>');
    out.push('<text class="scatter-legend-text" x="154" y="404">海外厂商</text>');
    out.push('</svg>');
    host.innerHTML = out.join('');

    /* 防碰复核（沿用现有做法）：交替偏移不足以完全防碰（如相邻同奇偶、标签较宽的两点），
       渲染后实测字形包围盒，与已放置标签相交则再移 14px（SPEC §4.6a：不重叠即可，不追求完美） */
    var svg = host.querySelector('svg');
    var boxes = Array.prototype.map.call(svg.querySelectorAll('.scatter-label'), function (el) {
      var b = el.getBBox();
      return { el: el, x: b.x, y: b.y, w: b.width, h: b.height };
    });
    boxes.forEach(function (box, i) {
      var moved = 0;
      function hits() {
        return boxes.slice(0, i).some(function (prev) {
          return box.x < prev.x + prev.w && prev.x < box.x + box.w &&
            box.y < prev.y + prev.h && prev.y < box.y + box.h;
        });
      }
      while (moved < 8 && hits()) {
        moved += 1;
        var cur = parseFloat(box.el.getAttribute('y'));
        var next = cur + 14 > SC_PLOT.b - 8 ? cur - 28 : cur + 14; /* 近底轴则改为上移 */
        box.el.setAttribute('y', next.toFixed(1));
        var b = box.el.getBBox();
        box.x = b.x; box.y = b.y; box.w = b.width; box.h = b.height;
      }
    });
  }

  /* ---------------- deals 优惠活动（SPEC §4.7/§4.7a） ---------------- */
  var DEAL_TYPES = {
    promo: { label: '限时', badge: 'badge--promo' },
    evergreen: { label: '常驻', badge: 'badge--evergreen' },
    alert: { label: '变动', badge: 'badge--alert' }
  };

  /* until 以年份开头（§4.7a 字面 ^\d{4}-）即视为日期型，取前导日期部分求 UTC 零点，
     月/日缺省按 01 计；其余（进行中/常驻/已生效）返回 null */
  function dateToMs(value) {
    var s = String(value == null ? '' : value);
    if (!/^\d{4}-/.test(s)) return null;
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(s);
    return Date.UTC(Number(m[1]), (m[2] ? Number(m[2]) : 1) - 1, m[3] ? Number(m[3]) : 1);
  }

  /* 剩余天数（SPEC §4.7a）：until 匹配 YYYY-MM-DD 时 days = ceil((until − meta.updated) / 86400)，
     基准为数据快照日；until 非日期（进行中/常驻/已生效）返回 null */
  function dealDaysLeft(until) {
    var untilMs = dateToMs(until);
    var baseMs = dateToMs(DATA.meta.updated);
    if (untilMs == null || baseMs == null) return null;
    return Math.ceil((untilMs - baseMs) / 86400000);
  }

  /* 剩余天数徽章（SPEC §4.7a）：dealDaysLeft > 0 → 「剩 N 天」琥珀徽章，
     <= 0 → 「已结束」灰徽章；非日期不渲染徽章 */
  function dealDaysBadge(until) {
    var days = dealDaysLeft(until);
    if (days == null) return '';
    var tip = '以数据快照日 ' + esc(DATA.meta.updated) + ' 计';
    if (days > 0) {
      return ' <span class="badge badge--days" title="距结束剩 ' + days + ' 天（' + tip + '）">剩 ' + days + ' 天</span>';
    }
    return ' <span class="badge badge--ended" title="已结束（' + tip + '）">已结束</span>';
  }

  function renderDeals() {
    $('deal-list').innerHTML = DATA.deals.map(function (d) {
      var t = DEAL_TYPES[d.type] || { label: d.type, badge: 'badge--watch' };
      var until = /^\d{4}-/.test(d.until) ? '至 ' + d.until : d.until;
      return '<article class="deal-item deal-item--' + esc(d.type) + '">' +
        '<div class="deal-head">' +
        '<span class="badge ' + t.badge + '" title="' + esc(t.label) + '">' + esc(t.label) + '</span>' +
        '<h3 class="deal-title">' + esc(d.title) + '</h3>' +
        '<span class="deal-until">' + dealDaysBadge(d.until) + esc(until) + '</span>' +
        '</div>' +
        '<p class="deal-detail">' + esc(d.detail) +
        '<a class="deal-link" href="' + esc(d.url) + '" target="_blank" rel="noopener">查看来源</a></p>' +
        '</article>';
    }).join('');
  }

  /* ---------------- notes 口径说明（SPEC §4.8） ---------------- */
  function renderNotes() {
    $('units-tbody').innerHTML = DATA.units.map(function (u) {
      return '<tr class="units-row">' +
        '<td class="cell-unit-vendor">' + esc(u.vendor) + '</td>' +
        '<td class="cell-unit">' + esc(u.unit) + '</td>' +
        '<td class="cell-unit-desc">' + esc(u.desc) + '</td>' +
        '</tr>';
    }).join('');

    $('faq-list').innerHTML = DATA.faqs.map(function (f) {
      return '<details class="faq-item"><summary>' + esc(f.q) + '</summary>' +
        '<p class="faq-a">' + esc(f.a) + '</p></details>';
    }).join('');

    $('disclaimer').textContent =
      '本页数据抓取/核实于 ' + DATA.meta.updated +
      '，全部来自公开渠道（官方文档优先，部分为第三方横评）。' +
      'AI 套餐价格与额度变动频繁，购买前请务必以各官网实时页面为准。带 * 的换算值为社区估算。';

    $('source-list').innerHTML = DATA.vendors.map(function (v) {
      return '<li><span class="source-name">' + esc(v.name) + '</span> —— ' +
        '<a href="' + esc(v.url) + '" target="_blank" rel="noopener">官网</a>' +
        (v.docs ? ' / <a href="' + esc(v.docs) + '" target="_blank" rel="noopener">文档</a>' : '') +
        '</li>';
    }).join('');
  }

  /* ---------------- scrollspy（SPEC §5.3） ---------------- */
  function initSpy() {
    if (!('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
    var sectionIds = ['hero', 'picks', 'plans', 'ruler', 'models', 'deals', 'notes'];
    var sections = sectionIds.map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    function setActive(id) {
      links.forEach(function (link) {
        var on = link.getAttribute('data-spy') === id;
        link.classList.toggle('is-active', on);
        if (on) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible[entry.target.id] = true;
        else delete visible[entry.target.id];
      });
      var activeId = '';
      for (var i = 0; i < sectionIds.length; i += 1) {
        if (visible[sectionIds[i]]) { activeId = sectionIds[i]; break; }
      }
      setActive(activeId === 'hero' ? '' : activeId); /* hero 无对应导航链接 */
    }, { rootMargin: '-40% 0px -55%' });

    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---------------- 横向滚动增强（SPEC §5.9 initScrollX） ----------------
     统一作用于四类横向滚动容器：套餐表 .table-scroll（#plans）、模型表 .table-scroll
     （#models）、价格尺泳道外层 .ruler-scroll、象限图 .scatter-scroll：
     a) 滚轮横滚：纵向滚轮意图转横向滚动，边界穿透——到头/无横向溢出/用户本身横向
        操作时不拦截，页面恢复纵滚（passive:false，仅真正滚动时 preventDefault）；
     b) ‹ › 边缘导航钮：悬停容器或其内任意子元素（:hover 冒泡）或钮自身聚焦时显现，
        只亮可滚方向（scroll 与 resize 时更新），点击 scrollBy ±340 平滑滚动
        （prefers-reduced-motion 用 'auto'）；
     c) 键盘：容器 tabindex=0 + aria-label，←/→ 为浏览器原生滚动行为，不写 JS。
     渐隐遮罩开关与按钮亮灭共用同一次 scroll 监听（§5.9d）；resize 侧重更新并入
     init 既有 debounce 重渲染流程（geometryRules 截断重建同处），不另立监听防累积。
     筛选重渲染只重建 tbody、resize 只重建 #ruler-lanes / #scatter-plot，均不触及
     滚动容器本身，按钮与监听不丢。 */
  var scrollXUpdaters = [];

  function updateScrollXAll() {
    scrollXUpdaters.forEach(function (update) { update(); });
  }

  function initScrollX() {
    var ENHANCED = [
      { sel: '#plans .table-scroll', label: '套餐对比表格，可横向滚动' },
      { sel: '#models .table-scroll', label: '模型对比表格，可横向滚动' },
      { sel: '.ruler-scroll', label: '价格尺泳道，可横向滚动' },
      { sel: '.scatter-scroll', label: '输出价 × 编程基准象限图，可横向滚动' }
    ];

    ENHANCED.forEach(function (t) {
      var el = document.querySelector(t.sel);
      if (!el || el.getAttribute('data-scrollx')) return;
      el.setAttribute('data-scrollx', '1');
      el.setAttribute('tabindex', '0'); /* §5.9c：可 Tab 聚焦，←/→ 原生滚动 */
      el.setAttribute('aria-label', t.label);

      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'scrollx-btn scrollx-btn--prev';
      prev.setAttribute('aria-label', '向左滚动');
      prev.textContent = '‹';
      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'scrollx-btn scrollx-btn--next';
      next.setAttribute('aria-label', '向右滚动');
      next.textContent = '›';
      /* 钮注入滚动容器内，但绝对定位包含块取其外部 .scroll-area（position:relative），
         故不随内容横移、不被容器 overflow 裁剪（见 style.css .scrollx-btn） */
      el.appendChild(prev);
      el.appendChild(next);

      var area = el.closest ? el.closest('.scroll-area') : null;

      /* 一次更新同时维护：按钮亮灭（只亮可滚方向）+ 渐隐遮罩（滚到最右淡出、回滚恢复）。
         overflow-x:visible（≥1756px 表格吸顶态）时 Chrome 的 scrollWidth 仍计入溢出
         内容（原 initScrollHints 实测注释），故以 overflowX 确认真处于可滚动容器 */
      function update() {
        var ox = window.getComputedStyle(el).overflowX;
        var scrollable = ox === 'auto' || ox === 'scroll';
        var max = el.scrollWidth - el.clientWidth;
        var hasOverflow = scrollable && max > 1;
        if (area) {
          area.classList.toggle('has-overflow', hasOverflow);
          area.classList.toggle('is-scrollable', hasOverflow && el.scrollLeft < max - 1);
        }
        prev.disabled = !(hasOverflow && el.scrollLeft > 1);
        next.disabled = !(hasOverflow && el.scrollLeft < max - 1);
      }

      /* 滚轮横滚（§5.9a 伪代码），另加吸顶态守卫：非可滚动容器时 scrollLeft 赋值无效
         而 preventDefault 会卡死页面纵滚，须先确认真处于 overflow auto/scroll 容器 */
      el.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; /* 本身横向操作，不抢 */
        var ox = window.getComputedStyle(el).overflowX;
        if (ox !== 'auto' && ox !== 'scroll') return; /* 非滚动容器（吸顶态）不抢 */
        var max = el.scrollWidth - el.clientWidth;
        if (max <= 1) return;                         /* 无横向溢出，不拦截 */
        var goingRight = e.deltaY > 0;
        var can = goingRight ? el.scrollLeft < max - 1 : el.scrollLeft > 0.5;
        if (!can) return;                             /* 到头 → 穿透，页面恢复纵滚 */
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }, { passive: false });

      el.addEventListener('scroll', update, { passive: true });

      function scrollByStep(dir) {
        var reduce = window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollBy({ left: dir * 340, behavior: reduce ? 'auto' : 'smooth' });
      }
      prev.addEventListener('click', function () { scrollByStep(-1); });
      next.addEventListener('click', function () { scrollByStep(1); });

      scrollXUpdaters.push(update);
      update();
    });

    /* 未增强但带渐隐遮罩的 .scroll-area（单位对照表）：遮罩开关并入同一更新机制 */
    Array.prototype.forEach.call(document.querySelectorAll('.scroll-area'), function (area) {
      var scroller = area.querySelector('.table-scroll, .ruler-scroll, .scatter-scroll');
      if (!scroller || scroller.getAttribute('data-scrollx')) return;
      scroller.setAttribute('data-scrollx', 'mask');
      function update() {
        var ox = window.getComputedStyle(scroller).overflowX;
        var max = scroller.scrollWidth - scroller.clientWidth;
        var show = (ox === 'auto' || ox === 'scroll') &&
          max > 1 && scroller.scrollLeft < max - 1; /* 右侧还有内容时露出 */
        area.classList.toggle('is-scrollable', show);
      }
      scroller.addEventListener('scroll', update, { passive: true });
      scrollXUpdaters.push(update);
      update();
    });
  }

  /* ---------------- 窄屏导航链接渐隐（.scroll-area 遮罩开关已并入 initScrollX） ---------------- */
  function initScrollHints() {
    var nav = document.querySelector('.site-nav');
    var navLinks = document.querySelector('.nav-links');
    if (!nav || !navLinks) return;
    var updateNav = function () {
      var maxLeft = navLinks.scrollWidth - navLinks.clientWidth;
      nav.classList.toggle('nav-has-more', maxLeft > 1 && navLinks.scrollLeft < maxLeft - 1);
    };
    navLinks.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav);
    updateNav();
  }

  /* ---------------- 启动 ---------------- */
  /* 注意顺序：renderCostQuicklook / renderBenchmarks 注入的静态几何规则（条宽）
     必须发生在 renderRuler 首次记录截断点（RULER_RULES_AT）之前——renderRuler 在
     resize 重渲染时会截断该点之后的规则，晚注入的条宽规则会被误删 */
  function init() {
    renderStaleBanner(); /* 数据时效横幅最先（SPEC §4.1a：init() 最先执行） */
    renderHero();
    renderPicks();
    renderPlanControls();
    renderPlanRows();
    renderCostQuicklook();
    renderBenchmarks();
    renderRuler();
    renderModels();
    renderScatterTabs();
    renderScatter();
    renderDeals();
    renderNotes();
    applyGeometry();
    initScrollX();
    initScrollHints();
    initSpy();

    /* 筛选行吸顶后，表头顶距随之同步（resize 重算）；宽度变化时价格尺标签重排 */
    function syncPlansHeadOffset() {
      var c = document.querySelector('.plan-controls');
      if (c) document.documentElement.style.setProperty('--plans-head-offset', (c.offsetHeight + 2) + 'px');
    }
    syncPlansHeadOffset();

    /* ≥1756px 吸顶态：表格外层盒宽 = 表格自然宽 + 左右边框，使边框/圆角完整包裹
       表格（实测自然宽 1440px，见 style.css 分层吸顶注释）；resize 时重算 */
    function syncPlansScrollerWidth() {
      var table = document.querySelector('.plan-table');
      if (!table) return;
      document.documentElement.style.setProperty('--plan-scroller-w', (table.offsetWidth + 2) + 'px');
    }
    syncPlansScrollerWidth();

    var rulerResizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(rulerResizeTimer);
      rulerResizeTimer = window.setTimeout(function () {
        renderRuler();
        applyGeometry();
        syncPlansHeadOffset();
        syncPlansScrollerWidth();
        updateScrollXAll(); /* 滚动容器溢出状态变化后刷新按钮亮灭与遮罩（§5.9） */
      }, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
