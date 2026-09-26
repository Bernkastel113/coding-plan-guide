#!/usr/bin/env node
/* ------------------------------------------------------------------
 * verify.js — 站点自检脚本（第七轮新增）
 * 用法：
 *   node verify.js          数据层 + 代码结构断言（无需浏览器）
 *   node verify.js --dom    追加渲染级断言（需本机装有 Microsoft Edge）
 *
 * 改过 assets/data/data.js 或三个站点文件后跑一遍，全绿再收工。
 * 纯本地、零依赖；退出码 0 = 全过，1 = 有失败项。
 * ---------------------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const APP = path.join(ROOT, 'assets', 'js', 'app.js');
const CSS = path.join(ROOT, 'assets', 'css', 'style.css');
const HTML = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'assets', 'data', 'data.js');

const SCORE_COLS = ['ba', 'tb21', 'tb40', 'swev', 'swepro', 'dswe', 'aa'];
let pass = 0;
const fails = [];
const notes = [];
const ok = (msg) => { pass++; console.log('  PASS ' + msg); };
const ng = (msg) => { fails.push(msg); console.log('  FAIL ' + msg); };
const section = (t) => console.log('\n[' + t + ']');

function read(p) { return fs.readFileSync(p, 'utf8'); }

/* ---------------- 1. 语法 ---------------- */
section('语法检查');
const syn = spawnSync(process.execPath, ['--check', APP], { encoding: 'utf8' });
if (syn.status === 0) ok('app.js 语法通过'); else ng('app.js 语法错误：' + (syn.stderr || '').split('\n')[0]);

/* ---------------- 2. 数据层 ---------------- */
section('数据层（data.js）');
global.window = {};
try { eval(read(DATA)); } catch (e) { ng('data.js 无法求值：' + e.message); }
const D = global.window.CP_DATA;
if (!D) { ng('window.CP_DATA 缺失'); finish(); }

const M = D.models || [];
/* 结构与计数 */
M.length === 21 ? ok('models = 21（当前收录口径）') : ng('models 应为 21，实际 ' + M.length);
(D.benchmarks || []).length === 6 ? ok('benchmarks = 6 组') : ng('benchmarks 应为 6 组，实际 ' + (D.benchmarks || []).length);
(D.vendors || []).length === 17 ? ok('vendors = 17 家') : ng('vendors 应为 17，实际 ' + (D.vendors || []).length);
(D.deals || []).length === 14 ? ok('deals = 14 条') : ng('deals 应为 14，实际 ' + (D.deals || []).length);

/* 模型字段 */
const need = ['name', 'vendor', 'region', 'date', 'ctx', 'apiPrice', 'ba', 'tb21', 'tb40', 'swev', 'swepro', 'dswe', 'aa', 'outUsd', 'tag'];
const missField = M.filter((m) => need.some((k) => !(k in m))).map((m) => m.name);
missField.length === 0 ? ok('models 必需字段齐全') : ng('缺字段：' + missField.join('、'));
M.some((m) => 'bench' in m || 'baNum' in m) ? ng('models 残留旧字段 bench/baNum') : ok('无旧字段残留');
const badRegion = M.filter((m) => m.region !== 'cn' && m.region !== 'overseas').map((m) => m.name);
badRegion.length === 0 ? ok('region 取值合法') : ng('region 非法：' + badRegion.join('、'));
const dupNames = M.map((m) => m.name).filter((n, i, a) => a.indexOf(n) !== i);
dupNames.length === 0 ? ok('模型名无重复') : ng('模型名重复：' + dupNames.join('、'));

/* tpCols 只能指向有分数的列 */
const badTp = M.filter((m) => (m.tpCols || []).some((c) => m[c] == null)).map((m) => m.name);
badTp.length === 0 ? ok('tpCols 指向的分数均非空') : ng('tpCols 指向空值：' + badTp.join('、'));

/* 已裁撤模型不得回归 */
const gone = ['Claude Sonnet 5', 'GPT-5.6 Luna', 'GPT-6 Luna', 'Kimi K2.7-Code', 'Doubao-Seed-Code', 'Claude Mythos 5', 'Claude Opus 4.8'];
const back = gone.filter((n) => M.some((m) => m.name === n));
back.length === 0 ? ok('已裁撤模型未回归') : ng('已删模型重新出现：' + back.join('、'));

/* 分数覆盖率（软指标，仅提示） */
const filled = SCORE_COLS.reduce((s, c) => s + M.filter((m) => m[c] != null).length, 0);
notes.push('分数覆盖率 ' + filled + '/' + M.length * SCORE_COLS.length + '（' + Math.round((filled / (M.length * SCORE_COLS.length)) * 100) + '%）');
['ba', 'tb21', 'aa', 'dswe'].forEach((c) => {
  const pts = M.filter((m) => m[c] != null && m.outUsd != null).length;
  notes.push('象限图 ' + c + ' tab 点数 = ' + pts);
});

/* plans */
const P = D.plans || [];
const noQm = P.filter((p) => p.quotaEst != null && !p.quotaModel);
noQm.length === 0 ? ok('quotaEst 非空的 ' + P.filter((p) => p.quotaEst != null).length + ' 档全部带 quotaModel') : ng('缺 quotaModel：' + noQm.map((p) => p.vendor + '/' + p.plan).join('、'));
const vIds = new Set((D.vendors || []).map((v) => v.id));
const badVendor = P.filter((p) => !vIds.has(p.vendor)).map((p) => p.vendor);
badVendor.length === 0 ? ok('plans.vendor 均在 vendors 中') : ng('未知厂商 id：' + [...new Set(badVendor)].join('、'));

/* meta */
const upd = (D.meta || {}).updated || '';
/^\d{4}-\d{2}-\d{2}$/.test(upd) ? ok('meta.updated 格式合法（' + upd + '）') : ng('meta.updated 格式非法：' + upd);
const future = new Date(upd) - Date.now();
future <= 86400e3 ? ok('meta.updated 不晚于当前日期') : ng('meta.updated 晚于今天（时区或录入错误）');

/* ---------------- 3. 代码结构 ---------------- */
section('代码结构（app.js / style.css / index.html）');
const app = read(APP), css = read(CSS), html = read(HTML);
const has = (cond, msg) => (cond ? ok(msg) : ng(msg));
has(app.includes('initScrollX'), 'initScrollX 滚动增强在位');
has(app.includes('tpCols') && app.includes('†'), '† 三方口径机制在位');
has(app.includes('toFixed(1)'), '分数一位小数格式在位');
has(html.includes('DeepSWE') && html.includes('防污染·转述'), '模型表 DeepSWE 列头在位');
has(css.includes('1700'), '模型表 min-width 1700 在位');
has(app.includes('quotaModel'), '测算列 quotaModel 第三行在位');
has((app.match(/data-metric/g) || []).length > 0, '象限图 tab 机制在位');
const tabsInCode = ['ba', 'tb21', 'aa', 'dswe'].every((k) => app.includes("'"+k+"'") || app.includes('"'+k+'"'));
has(tabsInCode, '象限图四基准（ba/tb21/aa/dswe）齐全');
has(app.includes('stale-banner') || app.includes('staleBanner') || html.includes('stale-banner'), '数据时效横幅代码在位');
has(app.includes('86400') || app.includes('86400e3'), '横幅天数计算在位');

/* ---------------- 4. 渲染级（--dom，可选） ---------------- */
if (process.argv.includes('--dom')) {
  section('渲染级断言（headless Edge）');
  const cands = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter((p) => fs.existsSync(p));
  if (!cands.length) {
    notes.push('未找到 Microsoft Edge，跳过 --dom 断言');
  } else {
    const tmp = path.join(os.tmpdir(), 'cp-verify-dom.html');
    const url = 'file:///' + encodeURI(HTML.replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F');
    const r = spawnSync(cands[0], ['--headless=new', '--disable-gpu', '--dump-dom', '--virtual-time-budget=9000', '--user-data-dir=' + path.join(os.tmpdir(), 'cp-verify-prof'), url], { encoding: 'utf8', timeout: 60000 });
    const dom = r.stdout || '';
    /* 渲染成功判定：CP_DATA 是 JS 变量名、不会出现在序列化 DOM 里，改用数据驱动渲染物 */
    if (dom.length < 50000 || !dom.includes('测算:') || !dom.includes('个最新模型')) { ng('页面渲染失败（dump 中无数据驱动渲染痕迹）'); }
    else {
      const cnt = (s) => dom.split(s).length - 1;
      has(cnt('测算:') === P.filter((p) => p.quotaEst != null).length, '渲染出的「测算:」行数 = ' + P.filter((p) => p.quotaEst != null).length + ' 档');
      has(cnt('undefined') === 0, 'DOM 无 undefined 字面量');
      has(dom.includes(M.length + ' 个最新模型'), 'hero 模型计数 = ' + M.length);
      has(dom.includes('97.0') && !dom.includes('>97<'), '97.0 一位小数显示正确');
      has((dom.match(/data-metric/g) || []).length >= 4, '象限图渲染出 ≥4 枚基准 tab（当前 4 枚按钮各带一个 data-metric 属性）');
      has(dom.includes('DeepSWE</button>') || dom.includes('>DeepSWE<'), 'DeepSWE tab 已渲染');
      has(cnt('tabindex="0"') >= 4, '横向滚动容器 tabindex ≥ 4');
      has(cnt('†') > 0, '† 上标已渲染');
      has(dom.includes('剩 ') && dom.includes(' 天'), '倒计时徽章在渲染');
    }
  }
}

/* ---------------- 汇总 ---------------- */
function finish() {
  console.log('\n────────────────────────');
  notes.forEach((n) => console.log('  · ' + n));
  if (fails.length) {
    console.log('  结果：' + pass + ' 项通过，' + fails.length + ' 项失败');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  } else {
    console.log('  结果：全部 ' + pass + ' 项通过 ✓');
    process.exit(0);
  }
}
finish();
