/* =====================================================================
   Coding Plan 选择指南 — 数据文件
   ---------------------------------------------------------------------
   · 数据抓取/核实日期：2026-09-25（见 meta.updated）；汇率核实 2026-09-23
   · 所有价格为官方渠道标价（货币见各字段），海外套餐保留美元原价并按
     meta.usdToCny 提供人民币换算参考
   · 带 * 的数字为第三方估算（官方未公布绝对值），仅供参考
   · 性价比测算口径：
       cost    = 月费 ÷ quotaEst（每亿 tokens 的人民币成本，仅 13 档有可靠估算）
       quotaEst= 每月可用 token 总量（亿），来源为社区横评（带*）
       官方计量为 Credits/次数/积分且折算系数未公开的套餐标 null（显示 —）
       ba      = 档内最强可选模型的 BenchAlign 综合榜分（第三方聚合榜，
                 无成绩的模型标 null，其他基准成绩见 baNote）
   · 维护方法：更新对应字段后，同步修改 meta.updated；来源链接放在 source
   ===================================================================== */

window.CP_DATA = {

  meta: {
    updated: '2026-09-25',
    vendorCount: 17,
    planNote: '收录 17 家厂商 · 50 档套餐 · 20 个模型',
    usdToCny: 6.71,
    fxDate: '2026-09-23',
  },

  /* ---------------- 厂商（用于分组展示与来源索引） ---------------- */
  vendors: [
    { id: 'zhipu',    name: '智谱 AI',      region: 'cn', url: 'https://bigmodel.cn/glm-coding', docs: 'https://docs.bigmodel.cn/cn/coding-plan/overview.md' },
    { id: 'kimi',     name: '月之暗面 Kimi', region: 'cn', url: 'https://www.kimi.com/membership', docs: 'https://www.kimi.com/code/docs/kimi-code/membership.html' },
    { id: 'deepseek', name: 'DeepSeek',     region: 'cn', url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/', docs: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/' },
    { id: 'minimax',  name: 'MiniMax',      region: 'cn', url: 'https://platform.minimaxi.com/subscribe/token-plan', docs: 'https://platform.minimaxi.com/subscribe/token-plan' },
    { id: 'aliyun',   name: '阿里云百炼',    region: 'cn', url: 'https://www.aliyun.com/benefit/scene/tokenplan', docs: 'https://help.aliyun.com/zh/model-studio/token-plan-overview' },
    { id: 'volc',     name: '火山方舟',      region: 'cn', url: 'https://www.volcengine.com/activity/codingplan', docs: 'https://www.volcengine.com/docs/ark/coding-plan-personal-plan-overview' },
    { id: 'tencent',  name: '腾讯云',        region: 'cn', url: 'https://cloud.tencent.com/act/pro/tokenplan', docs: 'https://cloud.tencent.com/document/product/1823/130060' },
    { id: 'trae',     name: '字节 Trae',     region: 'cn', url: 'https://www.trae.cn/pricing', docs: 'https://docs.trae.cn/ide_plans-and-billing' },
    { id: 'iflytek',  name: '讯飞星火飞码',  region: 'cn', url: 'https://www.xfyun.cn/solutions/iflycode', docs: '' },
    { id: 'anthropic', name: 'Anthropic',   region: 'overseas', url: 'https://claude.com/pricing', docs: 'https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan' },
    { id: 'openai',   name: 'OpenAI',       region: 'overseas', url: 'https://chatgpt.com/pricing', docs: 'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers' },
    { id: 'google',   name: 'Google',       region: 'overseas', url: 'https://one.google.com/about/google-ai-plans', docs: 'https://one.google.com/about/google-ai-plans' },
    { id: 'github',   name: 'GitHub Copilot', region: 'overseas', url: 'https://github.com/features/copilot/plans', docs: 'https://docs.github.com/en/copilot/get-started/plans' },
    { id: 'cursor',   name: 'Cursor',       region: 'overseas', url: 'https://cursor.com/pricing', docs: 'https://cursor.com/docs/account/pricing' },
    { id: 'windsurf', name: 'Windsurf',     region: 'overseas', url: 'https://windsurf.com/pricing', docs: 'https://devin.ai/pricing' },
    { id: 'xai',      name: 'xAI',          region: 'overseas', url: 'https://x.ai/pricing', docs: 'https://x.ai/build' },
    { id: 'augment',  name: 'Augment',      region: 'overseas', url: 'https://www.augmentcode.com/pricing', docs: 'https://www.augmentcode.com/pricing' },
  ],

  /* ---------------- 套餐总表（50 档） ----------------
     字段说明：
     price      月费主展示（字符串，可含 "免费"/"按量"）
     priceValue 月费数值（用于排序；null 排最后）
     currency   'CNY' | 'USD' | null
     cny        海外套餐按 meta.usdToCny 换算的人民币月费（约数，仅展示）
     subPrice   月费下方小字（优惠价/年付折算等）
     quota      官方额度口径（原话转述，不换算）
     cost       每亿 tokens 的人民币成本（月费÷quotaEst；null=无法可靠折算）
     quotaEst   每月测算 token 额度（亿 tokens）
     quotaModel 测算所用模型/口径（与套餐可用模型集合区分，严谨性标注）
     perfNote   性价比测算口径说明（无值时的原因）
     ba         档内最强可选模型的 BenchAlign 分（null=未上榜）
     baNote     模型分口径说明（模型名/其他基准成绩）
     models     包含模型
     tools      支持工具/使用方式
     note       备注（划断提醒、活动等）
     flag       'promo' 有进行中优惠 / 'watch' 重要变动提醒
  */
  plans: [
    /* ---- 国内（人民币） ---- */
    { vendor: 'zhipu', plan: 'GLM Coding Lite', price: '¥118/月', priceValue: 118, currency: 'CNY', subPrice: '年付折合 ¥82.6/月', quota: '2,000 积分 / 5小时 · 10,000 积分 / 周', cost: 45, quotaEst: 2.6, quotaModel: 'GLM-5.3', perfNote: '官方周额度推导（区间 2.1–4.2 亿）*', ba: null, baNote: 'GLM-5.3 未上榜（TB2.1 88.2）', models: 'GLM-5.3 · GLM-5.3-Flash', tools: 'Claude Code · Kilo Code · OpenCode · TRAE · CodeBuddy 等', note: '高峰 ×3 抵扣；另有 FlashX 极速版（200 tok/s）', flag: 'watch' },
    { vendor: 'zhipu', plan: 'GLM Coding Pro', price: '¥538/月', priceValue: 538, currency: 'CNY', subPrice: '年付折合 ¥376.6/月', quota: '12,000 积分 / 5小时 · 60,000 积分 / 周', cost: 34, quotaEst: 15.8, quotaModel: 'GLM-5.3', perfNote: '官方周额度推导（区间 12.6–25.1 亿）*', ba: null, baNote: 'GLM-5.3 未上榜（TB2.1 88.2）', models: 'GLM-5.3 · GLM-5.3-Flash', tools: '同上（官方指定编码工具）', note: 'V2 老用户 ¥149/月可续', flag: 'watch' },
    { vendor: 'zhipu', plan: 'GLM Coding Max', price: '¥1,078/月', priceValue: 1078, currency: 'CNY', subPrice: '年付折合 ¥754.6/月', quota: '28,000 积分 / 5小时 · 140,000 积分 / 周', cost: 29, quotaEst: 36.8, quotaModel: 'GLM-5.3', perfNote: '官方周额度推导（区间 29.3–58.5 亿）*', ba: null, baNote: 'GLM-5.3 未上榜（TB2.1 88.2）', models: 'GLM-5.3 · GLM-5.3-Flash', tools: '同上 + 视觉/联网/文件 MCP', note: 'V2 老用户 ¥469/月可续', flag: 'watch' },

    { vendor: 'kimi', plan: 'Kimi Go（新）', price: '¥49/月', priceValue: 49, currency: 'CNY', subPrice: '年付折合 ¥39/月', quota: '新 Go 档不含 Kimi Code 编程额度', cost: null, quotaEst: null, perfNote: '无编程额度', ba: null, baNote: '不含 K3 编程额度', models: 'K2.6（网页对话）', tools: 'Kimi 网页/App', note: '仅老 Andante 档保留编程额度' },
    { vendor: 'kimi', plan: 'Kimi Plus', price: '¥99/月', priceValue: 99, currency: 'CNY', subPrice: '年付折合 ¥79/月', quota: '共享月度 token 池（约 1.08 亿*/月）· 5 小时滚动频率窗', cost: 92, quotaEst: 1.08, quotaModel: 'K3 / kimi-for-coding', perfNote: '社区横评估算*', ba: 74.0, baNote: 'K3', models: 'K3 · K2.6 · kimi-for-coding', tools: 'Kimi Code 桌面/CLI/VS Code · Claude Code · OpenCode', note: '网页对话与 Kimi Code 共享同一额度池；新会员无周限额' },
    { vendor: 'kimi', plan: 'Kimi Pro', price: '¥199/月', priceValue: 199, currency: 'CNY', subPrice: '年付折合 ¥159/月', quota: '20 倍基础额度（约 5.4 亿*/月）· K3 百万上下文', cost: 37, quotaEst: 5.4, quotaModel: 'K3 / kimi-for-coding', perfNote: '社区横评估算*', ba: 74.0, baNote: 'K3（1M 上下文）', models: 'K3（1M）· 高速版', tools: 'Kimi Code 全端 · Kimi Claw', note: '适合重库级长对话编程' },
    { vendor: 'kimi', plan: 'Kimi Max', price: '¥699/月', priceValue: 699, currency: 'CNY', subPrice: '年付折合 ¥559/月', quota: '60 倍基础额度（约 16 亿*/月）', cost: 44, quotaEst: 16, quotaModel: 'K3 / kimi-for-coding', perfNote: '社区横评估算*', ba: 74.0, baNote: 'K3（1M 上下文）', models: 'K3（1M）', tools: 'Kimi Code 全端', note: '2026-07 曾因算力暂停新订，9 月中旬恢复' },

    { vendor: 'deepseek', plan: 'API 按量付费（无订阅）', price: '按量计费', priceValue: null, currency: null, subPrice: 'V4.1-Flash：输入 ¥1 / 输出 ¥4（空闲价）', quota: '无套餐限额，按 token 计费；并发 Flash 2500 / Pro 500', cost: null, quotaEst: null, perfNote: '按 API 单价：输入 ¥100 / 输出 ¥400 每亿（空闲）', ba: null, baNote: 'V4-Pro 未上榜（TB2.1 87.9）', models: 'DeepSeek-V4.1-Flash · V4-Pro-0813', tools: 'OpenAI / Anthropic 兼容 API · Cline 等任意 BYOK 工具', note: '空闲=工作日 9–12 / 14–18 时以外及周末全天，价格为高峰一半' },

    { vendor: 'minimax', plan: 'Token Plan Plus', price: '¥49/月', priceValue: 49, currency: 'CNY', subPrice: '年付 ¥490', quota: 'M2.7：1,500 次/5小时 · 约 12,000 次编程调用/月*', cost: 8, quotaEst: 6, quotaModel: 'M3 / M2.7', perfNote: '双源一致的社区横评*', ba: null, baNote: 'M3 未上榜（SWE-V 80.5）', models: 'MiniMax-M3 · M2.7', tools: 'MiniMax Code 官方端 · Claude Code · Cline（sk-cp Key）', note: '5 小时 + 周双窗口；用量翻倍升级进行中', flag: 'promo' },
    { vendor: 'minimax', plan: 'Token Plan Max', price: '¥119/月', priceValue: 119, currency: 'CNY', subPrice: '年付 ¥1,190', quota: 'M2.7：4,500 次/5小时 · 约 36,000 次/月*', cost: 7, quotaEst: 18, quotaModel: 'M3 / M2.7', perfNote: '社区横评估算*', ba: null, baNote: 'M3 未上榜（SWE-V 80.5）', models: 'MiniMax-M3 · M2.7', tools: '同上', note: '年付立省 ¥300', flag: 'promo' },
    { vendor: 'minimax', plan: 'Token Plan Ultra', price: '¥469/月', priceValue: 469, currency: 'CNY', subPrice: '年付 ¥4,690', quota: 'M2.7：15,000 次/5小时 · 约 140,000 次/月*', cost: 7, quotaEst: 63, quotaModel: 'M3 / M2.7', perfNote: '两口径冲突（55–71 亿）取中值*', ba: null, baNote: 'M3 未上榜（SWE-V 80.5）', models: 'MiniMax-M3 · M2.7', tools: '同上 · Agent 并发 6–7', note: '视频生成 5 条/日', flag: 'promo' },

    { vendor: 'aliyun', plan: 'Token Plan Lite', price: '¥39/月', priceValue: 39, currency: 'CNY', subPrice: '限时价（原 ¥60）', quota: '2,500 Credits / 7 天滚动窗口', cost: 30, quotaEst: 1.3, quotaModel: 'Qwen3.6-Plus', perfNote: 'qwen3.6-plus 官方系数推导*（用 3.8-max 更低）', ba: 73.1, baNote: 'Qwen3.8-Max', models: 'qwen3.8-max/flash · qwen-auto · DeepSeek-V4 · GLM-5.3 等', tools: 'Claude Code · Cursor · Qwen Code · Codex · Qoder', note: '夜间 22–8 时部分模型 4–5 折', flag: 'promo' },
    { vendor: 'aliyun', plan: 'Token Plan Essential', price: '¥79/月', priceValue: 79, currency: 'CNY', subPrice: '限时价（原 ¥120）', quota: '5,625 Credits / 7 天', cost: 26, quotaEst: 3.0, quotaModel: 'Qwen3.6-Plus', perfNote: 'qwen3.6-plus 官方系数推导*', ba: 73.1, baNote: 'Qwen3.8-Max', models: '同上', tools: '同上 · 并发 2–3', note: '', flag: 'promo' },
    { vendor: 'aliyun', plan: 'Token Plan Standard', price: '¥139/月', priceValue: 139, currency: 'CNY', subPrice: '限时价（原 ¥180）', quota: '10,000 Credits / 7 天', cost: 26, quotaEst: 5.4, quotaModel: 'Qwen3.6-Plus', perfNote: 'qwen3.6-plus 官方系数推导*', ba: 73.1, baNote: 'Qwen3.8-Max', models: '同上', tools: '同上 · 并发 3–4', note: '', flag: 'promo' },
    { vendor: 'aliyun', plan: 'Token Plan Pro', price: '¥499/月', priceValue: 499, currency: 'CNY', subPrice: '限时价（原 ¥600）', quota: '40,000 Credits / 7 天', cost: 23, quotaEst: 21.5, quotaModel: 'Qwen3.6-Plus', perfNote: 'qwen3.6-plus 官方系数推导*', ba: 73.1, baNote: 'Qwen3.8-Max', models: '同上', tools: '同上 · 并发 6–8', note: '用量包 ¥100 = 20,000 Credits 可加购', flag: 'promo' },

    { vendor: 'volc', plan: 'Coding Plan Lite', price: '¥40/月', priceValue: 40, currency: 'CNY', subPrice: '活动首两个月 ¥9.9', quota: '约 1,200 次请求 / 5小时 · 9,000 次/周 · 18,000 次/月', cost: 9, quotaEst: 4.5, quotaModel: '豆包 Seed / DSv4-Flash', perfNote: '第三方实测（模型依赖 3.2–6 亿）*', ba: 74.0, baNote: 'K3 · 档内最强可选', models: 'Doubao-Seed-2.1 · Kimi K3/K2.8 · GLM-5.3 · DeepSeek-V4 等 12 款', tools: '工具不限：Claude Code · Codex · Cline · Cursor · OpenCode 等', note: '2.5 折普惠活动至 2026-11-08；邀请好友再 9.5 折', flag: 'promo' },
    { vendor: 'volc', plan: 'Coding Plan Pro', price: '¥200/月', priceValue: 200, currency: 'CNY', subPrice: '活动首两个月 ¥49.9', quota: '约 6,000 次请求 / 5小时 · 45,000 次/周 · 90,000 次/月', cost: 7, quotaEst: 30, quotaModel: '豆包 Seed / DSv4-Flash', perfNote: '第三方实测（16–30 亿）*', ba: 74.0, baNote: 'K3 · 档内最强可选', models: '同上（12 款自由切换）', tools: '同上 · OpenAI/Anthropic 双兼容接入', note: '同上活动；另有按 AFP 积分的 Agent Plan（¥40 起）', flag: 'promo' },

    { vendor: 'tencent', plan: 'Token Plan Lite', price: '¥39/月', priceValue: 39, currency: 'CNY', subPrice: '个人版积分 5 折活动进行中', quota: '780 积分 / 订阅月', cost: 111, quotaEst: 0.35, quotaModel: 'DSv4-Flash（刊例）', perfNote: '官方 DSv4-Flash 刊例口径（按模型浮动 0.17–27.8 亿）*', ba: 74.0, baNote: 'K3 · 档内最强可选', models: 'DeepSeek-V4（原厂）· GLM-5.3 · Kimi K3 · MiniMax-M3 等', tools: 'CodeBuddy · Claude Code · Codex · Cline · Cursor 等', note: '按订阅月计量、无 5 小时/周窗口' },
    { vendor: 'tencent', plan: 'Token Plan Standard', price: '¥99/月', priceValue: 99, currency: 'CNY', subPrice: '同上 5 折活动', quota: '1,980 积分 / 订阅月', cost: 99, quotaEst: 1, quotaModel: 'DSv4-Flash（刊例）', perfNote: '官方 DSv4-Flash 刊例口径*', ba: 74.0, baNote: 'K3 · 档内最强可选', models: '同上', tools: '同上 · OpenAI+Anthropic 兼容', note: '' },
    { vendor: 'tencent', plan: 'Token Plan Pro', price: '¥299/月', priceValue: 299, currency: 'CNY', subPrice: '同上 5 折活动', quota: '5,980 积分 / 订阅月', cost: 93, quotaEst: 3.2, quotaModel: 'DSv4-Flash（刊例）', perfNote: '官方 DSv4-Flash 刊例口径*', ba: 74.0, baNote: 'K3 · 档内最强可选', models: '同上', tools: '同上', note: '加量包 ¥50 = 1,000 积分' },
    { vendor: 'tencent', plan: 'Token Plan Max', price: '¥599/月', priceValue: 599, currency: 'CNY', subPrice: '同上 5 折活动', quota: '11,980 积分 / 订阅月', cost: 92, quotaEst: 6.5, quotaModel: 'DSv4-Flash（刊例）', perfNote: '官方 DSv4-Flash 刊例口径*', ba: 74.0, baNote: 'K3 · 档内最强可选', models: '同上（GLM-5/5.1 与 M2.5 将于 10-09 下线）', tools: '同上', note: '另有混元 Hy 系列 ¥28 起' },

    { vendor: 'trae', plan: 'Trae Free', price: '免费', priceValue: 0, currency: 'CNY', subPrice: '', quota: '每月登录送 500+ 积分（签到可加）', cost: null, quotaEst: null, perfNote: '积分折算率未公开（1 积分≈¥0.022）', ba: null, baNote: 'Seed 系列未上榜', models: '豆包 Seed 系列（按积分扣）', tools: 'Trae IDE / TraeCode', note: '' },
    { vendor: 'trae', plan: 'Trae Lite', price: '¥45/月', priceValue: 45, currency: 'CNY', subPrice: '连续包月（单月 ¥49）· 新用户首月 ¥29.9', quota: '2,000 Work 专属积分 / 月', cost: null, quotaEst: null, perfNote: '官方积分折算率未公开', ba: null, baNote: 'Seed 系列未上榜', models: 'Seed-2.1-Turbo · Seed-Code', tools: 'TraeWork', note: '会员用 Seed 系列享 2.5 折计费', flag: 'promo' },
    { vendor: 'trae', plan: 'Trae Pro', price: '¥89/月', priceValue: 89, currency: 'CNY', subPrice: '连续包月（单月 ¥99）· 新用户首月 ¥69', quota: '4,000 通用积分 / 月', cost: null, quotaEst: null, perfNote: '实测单次深度对话 1,000–2,000 积分', ba: null, baNote: 'Seed 系列未上榜', models: '同上', tools: 'TraeCode + TraeWork · 云端任务并行 10 个', note: '积分有效期 31 天；加购 1,000 积分 = ¥50', flag: 'promo' },
    { vendor: 'trae', plan: 'Trae Pro+', price: '¥219/月', priceValue: 219, currency: 'CNY', subPrice: '连续包月（单月 ¥239）', quota: '12,000 通用积分 / 月', cost: null, quotaEst: null, perfNote: '官方积分折算率未公开', ba: null, baNote: 'Seed 系列未上榜', models: '同上', tools: '同上', note: '' },
    { vendor: 'trae', plan: 'Trae Ultra', price: '¥629/月', priceValue: 629, currency: 'CNY', subPrice: '连续包月（单月 ¥699）', quota: '40,000 通用积分 / 月', cost: null, quotaEst: null, perfNote: '官方积分折算率未公开', ba: null, baNote: 'Seed 系列未上榜', models: '同上', tools: '同上 · 云端并行 20 个', note: '' },

    { vendor: 'iflytek', plan: '星火飞码 个人版', price: '¥69/月起', priceValue: 69, currency: 'CNY', subPrice: '第三方口径，官网未公开价目', quota: '无忧版 18,000 次/月 · 高效版 90,000 次/月（知乎实测口径）', cost: null, quotaEst: null, perfNote: '官方口径未公布', ba: null, baNote: '星火系列未上榜', models: 'GLM-5 · Kimi-K2.5 · M2.5 · DS-V3.2', tools: 'iFlyCode 插件', note: '另有星辰 Token Plan：标准 ¥200（限时 ¥160）' },

    /* ---- 海外（美元，cny 为 6.71 汇率换算参考） ---- */
    { vendor: 'anthropic', plan: 'Claude Pro', price: '$20/月', priceValue: 20, currency: 'USD', cny: 134, subPrice: '年付 $17/月', quota: '5 小时会话窗口 + 周限额（官方不公布固定条数）', cost: 34, quotaEst: 4, quotaModel: 'Opus / Sonnet 混合', perfNote: '第三方实测（2026-09，Sonnet 口径）*', ba: 88.5, baNote: 'Opus 5.5（9-22 新）', models: 'Opus 5.5 · Fable 5.1 · Opus 5 · Sonnet 5 · Haiku 4.5', tools: 'Claude Code CLI · 网页/App（共享额度）', note: '9-22 起 5 小时限额再上调 + 可保存的限额重置', flag: 'watch' },
    { vendor: 'anthropic', plan: 'Claude Max 5x', price: '$100/月', priceValue: 100, currency: 'USD', cny: 671, subPrice: '', quota: 'Pro 用量的 5 倍', cost: 20, quotaEst: 33, quotaModel: 'Opus / Sonnet 混合', perfNote: '第三方实测（Reddit 周限额互验）*', ba: 88.5, baNote: 'Opus 5.5（9-22 新）', models: '同上', tools: 'Claude Code CLI · 网页/App', note: '', flag: 'watch' },
    { vendor: 'anthropic', plan: 'Claude Max 20x', price: '$200/月', priceValue: 200, currency: 'USD', cny: 1342, subPrice: '', quota: 'Pro 用量的 20 倍 · 更高输出上限', cost: 20, quotaEst: 67, quotaModel: 'Opus / Sonnet 混合', perfNote: '第三方实测（Reddit 周限额互验）*', ba: 88.5, baNote: 'Opus 5.5（9-22 新）', models: '同上 · 新模型优先/抢先体验', tools: 'Claude Code CLI · 网页/App', note: '周用量约为 5x 的 1.5–2 倍（非 4 倍）', flag: 'watch' },

    { vendor: 'openai', plan: 'ChatGPT Go', price: '$8/月', priceValue: 8, currency: 'USD', cny: 54, subPrice: '', quota: 'Codex Limited（有限额度）', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: null, baNote: '仅桌面端 Luna（未上榜）', models: 'GPT-6 Luna（桌面端）· GPT-5.6', tools: 'Codex CLI / IDE / 云端', note: '2026-01 上线的低价档' },
    { vendor: 'openai', plan: 'ChatGPT Plus', price: '$20/月', priceValue: 20, currency: 'USD', cny: 134, subPrice: '', quota: 'Codex Expanded · 按 5 小时本地消息区间 + 周限额', cost: 22, quotaEst: 6.2, quotaModel: 'GPT-5.6 Sol', perfNote: '第三方实测（GPT-5.6 Sol 口径）*', ba: 88.5, baNote: 'GPT-6 Astra · Sol 已进 Codex', models: 'GPT-6 Astra/Sol/Luna · GPT-5.6 全系', tools: 'Codex CLI · IDE 扩展 · 桌面 App · GitHub Action', note: '9-22 起 Sol/Luna 向 Plus 开放' },
    { vendor: 'openai', plan: 'ChatGPT Pro 5x', price: '$100/月', priceValue: 100, currency: 'USD', cny: 671, subPrice: '', quota: 'Codex Maximum · 5 倍 Plus 用量', cost: 22, quotaEst: 31, quotaModel: 'GPT-5.6 Sol（5×Plus 推导）', perfNote: '官方 5×Plus 推导*', ba: 88.5, baNote: 'GPT-6 Astra · Sol 已进 Codex', models: '同上 + Unlimited GPT-5.6 / GPT-5.3', tools: '同上', note: '' },
    { vendor: 'openai', plan: 'ChatGPT Pro 20x', price: '$200/月', priceValue: 200, currency: 'USD', cny: 1342, subPrice: '', quota: '20 倍 Plus 用量', cost: 11, quotaEst: 124, quotaModel: 'GPT-5.6 Sol（20×Plus 推导）', perfNote: '官方 20×Plus 推导*', ba: 88.5, baNote: 'GPT-6 Astra · Sol 已进 Codex', models: '同上', tools: '同上', note: '暂停新订；9-18 起 30 天内退订用户可限时回订一次', flag: 'watch' },

    { vendor: 'google', plan: 'Google AI Pro', price: '$19.99/月', priceValue: 19.99, currency: 'USD', cny: 134, subPrice: '年付 $199.99 · 学生免费 1 年', quota: 'AI Studio · Antigravity · Jules 提额 · $10 GCP 抵扣/月', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: 72.7, baNote: 'Gemini 3.8 Flash', models: 'Gemini 3.1 Pro · 3.8 Flash 等', tools: 'Antigravity（IDE+CLI）· Jules · AI Studio', note: 'Gemini CLI 免费档已被 Antigravity CLI 取代', flag: 'promo' },
    { vendor: 'google', plan: 'Google AI Ultra', price: '$99.99/月起', priceValue: 99.99, currency: 'USD', cny: 671, subPrice: '顶配约 $199.99/月', quota: 'Antigravity/Jules 更高限额 · Deep Think · $40–100 GCP 抵扣', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: 72.7, baNote: 'Gemini 3.8 Flash', models: 'Gemini 顶配 · Deep Think', tools: '同上 · 20–30TB 存储', note: '2026 I/O 自 $249.99 降价' },

    { vendor: 'github', plan: 'Copilot Free', price: '免费', priceValue: 0, currency: 'USD', cny: 0, subPrice: '', quota: '少量 AI Credits · 2,000 补全 + 50 对话/月', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: null, baNote: '仅 Auto 自动选模', models: '仅 Auto 自动选模', tools: 'Copilot CLI · IDE 插件 · App', note: '' },
    { vendor: 'github', plan: 'Copilot Pro', price: '$10/月', priceValue: 10, currency: 'USD', cny: 67, subPrice: '', quota: '1,500 AI Credits/月（$15 等值）· 补全不限', cost: 1340, quotaEst: 0.05, quotaModel: '按各模型牌价折算', perfNote: '$15 额度按 API 价推导（模型依赖极大）*', ba: 80.4, baNote: 'Opus 5', models: '29 款主流模型（Claude/GPT/Gemini/Grok/Kimi…）', tools: 'Copilot CLI · IDE · 代码审查', note: '学生 / 教师 / 知名开源维护者免费', flag: 'promo' },
    { vendor: 'github', plan: 'Copilot Pro+', price: '$39/月', priceValue: 39, currency: 'USD', cny: 262, subPrice: '', quota: '7,000 AI Credits/月（$70 等值）', cost: 1310, quotaEst: 0.2, quotaModel: '按各模型牌价折算', perfNote: '$70 额度按 API 价推导*', ba: 88.5, baNote: 'Opus 5.5（新上架）', models: '+ Opus · Fable · GPT-6 等高端模型', tools: '同上 + 可委派 Claude Code / Codex', note: '' },
    { vendor: 'github', plan: 'Copilot Max', price: '$100/月', priceValue: 100, currency: 'USD', cny: 671, subPrice: '', quota: '20,000 AI Credits/月（$200 等值）', cost: 840, quotaEst: 0.8, quotaModel: '按各模型牌价折算', perfNote: '$200 额度按 API 价推导*', ba: 88.5, baNote: 'Opus 5.5（新上架）', models: '高端模型优先访问', tools: '同上', note: '' },

    { vendor: 'cursor', plan: 'Cursor Hobby', price: '免费', priceValue: 0, currency: 'USD', cny: 0, subPrice: '', quota: '有限 Agent 请求 · 无限 Tab 补全', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: null, baNote: '有限 Agent 额度', models: 'Composer 访问', tools: 'Cursor IDE', note: '' },
    { vendor: 'cursor', plan: 'Cursor Pro', price: '$20/月', priceValue: 20, currency: 'USD', cny: 134, subPrice: '年付 $16/月', quota: '扩展 Agent 额度 · Grok 宽裕 · 超额按量后付', cost: 540, quotaEst: 0.25, quotaModel: '官方 $60–100 用量折算', perfNote: '官方「典型 $60–100/月」用量推导*', ba: 80.4, baNote: 'Opus 5 / Fable 5（按量池）', models: 'Grok 4.x · Composer 2.5（$0.5/$2.5 低价池）· Claude/GPT/Gemini/Kimi 按量', tools: 'Cursor IDE', note: '官方估算：日均 Agent 用户 $60–100/月' },
    { vendor: 'cursor', plan: 'Cursor Pro+', price: '$60/月', priceValue: 60, currency: 'USD', cny: 403, subPrice: '年付 $48/月', quota: '3 倍 Pro 额度', cost: 450, quotaEst: 0.9, quotaModel: '第三方 $70–200 折算', perfNote: '第三方 $70–200 用量推导（低置信）*', ba: 80.4, baNote: 'Opus 5 / Fable 5（按量池）', models: '同上', tools: 'Cursor IDE', note: '' },
    { vendor: 'cursor', plan: 'Cursor Ultra', price: '$200/月', priceValue: 200, currency: 'USD', cny: 1342, subPrice: '年付 $160/月', quota: '20 倍 Pro 额度 · 最高优先', cost: 1030, quotaEst: 1.3, quotaModel: '第三方 ≈$400 折算', perfNote: '第三方 ≈$400 用量推导（低置信）*', ba: 80.4, baNote: 'Opus 5 / Fable 5（按量池）', models: '同上', tools: 'Cursor IDE', note: '' },

    { vendor: 'windsurf', plan: 'Windsurf Free', price: '免费', priceValue: 0, currency: 'USD', cny: 0, subPrice: '', quota: '个人永久免费', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: null, baNote: 'SWE-1.5 未上榜', models: 'SWE-1.5', tools: 'Windsurf IDE（已并入 Devin）', note: '' },
    { vendor: 'windsurf', plan: 'Windsurf Pro', price: '$20/月', priceValue: 20, currency: 'USD', cny: 134, subPrice: '', quota: '标准用量档 · 日 + 周刷新 · 超额按 API 价', cost: null, quotaEst: null, perfNote: '第三方估 1,500–2,000 prompts/月', ba: null, baNote: 'SWE-1.5 未上榜', models: 'SWE-1.5 · Devin Cloud 访问', tools: 'Windsurf IDE', note: '2026-03 起弃用旧 credits 制' },
    { vendor: 'windsurf', plan: 'Windsurf Max', price: '$200/月', priceValue: 200, currency: 'USD', cny: 1342, subPrice: '', quota: '最高用量档（约 20x Pro）', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: null, baNote: 'SWE-1.5 未上榜', models: '同上', tools: 'Windsurf IDE', note: '' },

    { vendor: 'xai', plan: 'SuperGrok', price: '$30/月', priceValue: 30, currency: 'USD', cny: 201, subPrice: '年付 $300', quota: '含 Grok Build 终端编码 agent', cost: 22, quotaEst: 9.3, quotaModel: 'Grok 4.6', perfNote: '第三方换算（Grok 4.6 口径，≈16.7x 价值）*', ba: null, baNote: 'Grok 4.7 未上榜（TB4.0 38.0）', models: 'Grok 4.6/4.7 · Expert 模式', tools: 'Grok Build CLI（curl 安装）· 网页', note: 'X Premium+（$40/月）亦含 Grok 访问' },
    { vendor: 'xai', plan: 'SuperGrok Plus', price: '$100/月', priceValue: 100, currency: 'USD', cny: 671, subPrice: '', quota: 'Build/Chat/Imagine/Voice 全面更高用量', cost: null, quotaEst: null, perfNote: '未查到可靠实测', ba: null, baNote: 'Grok 4.7 未上榜（TB4.0 38.0）', models: '同上', tools: '同上', note: '' },

    { vendor: 'augment', plan: 'Augment Standard', price: '$20/月', priceValue: 20, currency: 'USD', cny: 134, subPrice: '一口价（不按席位，最多 50 席）', quota: '含 $20/月 用量 · LLM 按牌价 + 40% 服务费', cost: null, quotaEst: null, perfNote: '官方不公布 token 口径', ba: null, baNote: 'BYO 多模型', models: 'BYO 多模型', tools: 'CLI · IDE · MCP 工具', note: '充值 12 个月有效，团队共享池' },
  ],

  /* ---------------- 价格一览（价格尺数据） ----------------
     轴为分段比例：breakpoints 将价格区间切成等宽段（低价密集区展开），
     段界数值在轴上以刻度标注。value 仅用于定位与排序；
     相近档位已合并为一个圆点，展示价写在 vText。
  */
  priceRuler: {
    cn: {
      unit: '¥', breakpoints: [0, 60, 250, 700, 1100], items: [
        { label: '免费档（Trae Free 等）', value: 0, vText: '¥0 · 免费' },
        { label: '各家 Lite 入门档', value: 42, vText: '¥39–49/月（阿里/腾讯/火山/Trae/Kimi/MiniMax）' },
        { label: 'Trae Pro · Kimi Plus · 腾讯 Std', value: 94, vText: '¥89–99/月' },
        { label: 'MiniMax Max · GLM Lite · 阿里 Std', value: 129, vText: '¥119–139/月' },
        { label: 'Kimi Pro · 火山 Pro', value: 199.5, vText: '¥199–200/月' },
        { label: '腾讯 Pro', value: 299, vText: '¥299/月' },
        { label: '阿里 Pro', value: 499, vText: '¥499/月' },
        { label: 'GLM Pro', value: 538, vText: '¥538/月' },
        { label: '腾讯 Max', value: 599, vText: '¥599/月' },
        { label: 'Kimi Max · Trae Ultra', value: 699, vText: '¥699/月' },
        { label: 'GLM Max', value: 1078, vText: '¥1,078/月' },
      ],
    },
    overseas: {
      unit: '$', breakpoints: [0, 15, 50, 120, 210], items: [
        { label: '免费档（Hobby / Free）', value: 0, vText: '$0 · 免费' },
        { label: 'ChatGPT Go', value: 8, vText: '$8/月' },
        { label: 'Copilot Pro', value: 10, vText: '$10/月' },
        { label: 'AI Pro / Plus / Pro 档', value: 20, vText: '$20/月' },
        { label: 'SuperGrok', value: 30, vText: '$30/月' },
        { label: 'Copilot Pro+', value: 39, vText: '$39/月' },
        { label: 'Cursor Pro+', value: 60, vText: '$60/月' },
        { label: 'Max 5x / Pro 5x / Ultra 档', value: 100, vText: '$100/月' },
        { label: '20x / Cursor Ultra 档', value: 200, vText: '$200/月' },
      ],
    },
  },

  /* ---------------- 模型对比（21 个，2026-09-25 第六轮裁撤后；0–1 分纯占位模型已删） ----------------
     apiPrice 展示字符串（输入/输出 每百万 tokens）
     分基准独立字段（分数一律不跨口径换算，查不到留 null → 表格显示 —）：
       ba     = BenchAlign（2026-09-22 重校准版）
       tb21   = Terminal-Bench 2.1（官方自报；† = Vals 三方复测）
       tb40   = Terminal-Bench 4.0（官方自报；† = Vals 三方复测）
       swev   = SWE-bench Verified（2026 起各家渐停报，仅存参考；† = 三方复测）
       swepro = SWE-bench Pro（官方自报；† = Morph 标准化复测）
       dswe   = DeepSWE v1.1（Scale 防污染公共集 · 官方/媒体转述）
       aa     = AA Intelligence Index v4.3.2（9-22 重校后同口径；旧版口径分不录入）
     tpCols  = 该模型哪些分数列取值为第三方统一复测口径（渲染时加 † 上标）
     outUsd  = 输出价折美元（每百万，汇率见 meta.usdToCny），供象限图使用
     region: 'cn' 国内 / 'overseas' 海外（象限图着色依据）
     已裁撤（0–1 分且非当期主力）：Sonnet 5 · GPT-5.6/6 Luna · K2.7-Code · Doubao-Seed-Code · Mythos 5 · Opus 4.8
  */
  models: [
    { name: 'Claude Opus 5.5', vendor: 'Anthropic', region: 'overseas', date: '2026-09-22', ctx: '1M', apiPrice: '$4 / $20', ba: 88.45, tb21: 87.6, tb40: 66.4, swev: null, swepro: 89.9, dswe: 74.2, aa: 58, outUsd: 20, tpCols: ['tb21'], tag: '5.5 系首发：多数任务达 Fable 5.1 水平，成本比 Opus 5 低约 40%；SWE-Pro 89.9 与 AA 58 双榜第一', hot: true },
    { name: 'GPT-6 Astra', vendor: 'OpenAI', region: 'overseas', date: '2026-09-03', ctx: '1.05M', apiPrice: '$10 / $50', ba: 88.47, tb21: 87.3, tb40: 57.9, swev: null, swepro: null, dswe: null, aa: 53, outUsd: 50, tpCols: ['tb21'], tag: '计算机使用与科学推理全栈 SOTA；BenchAlign 88.47 现榜第一', hot: true },
    { name: 'Claude Fable 5.1', vendor: 'Anthropic', region: 'overseas', date: '2026-09-01', ctx: '1M', apiPrice: '$10 / $50', ba: 83.34, tb21: null, tb40: 55.8, swev: null, swepro: 81.2, dswe: null, aa: 53, outUsd: 50, tag: '上代编程基准总榜第一的贵价旗舰', hot: true },
    { name: 'GPT-6 Sol', vendor: 'OpenAI', region: 'overseas', date: '2026-09-22', ctx: '未查到', apiPrice: '$2 / $10', ba: 82.17, tb21: null, tb40: null, swev: null, swepro: null, dswe: 68.8, aa: null, outUsd: 10, tag: 'GPT-6 家族性价比款（Astra 同代半价），已进 Codex（Plus/Pro）', hot: true },
    { name: 'GPT-5.6 Sol', vendor: 'OpenAI', region: 'overseas', date: '2026-07-09', ctx: '1.1M', apiPrice: '$4 / $20', ba: 80.44, tb21: 85.8, tb40: 37.3, swev: null, swepro: 64.6, dswe: 72.7, aa: null, outUsd: 20, tpCols: ['tb21'], tag: '上代三型号家族主力，现被 GPT-6 Sol 半价接替' },
    { name: 'Claude Opus 5', vendor: 'Anthropic', region: 'overseas', date: '2026-07-24', ctx: '1M', apiPrice: '$5 / $25', ba: 80.35, tb21: 89.1, tb40: 52.3, swev: 97.0, swepro: 79.2, dswe: null, aa: 51, outUsd: 25, tpCols: ['swev'], tag: '上代主力，现被 Opus 5.5 以 8 折价接替；TB 2.1 官方口径榜首（max 档）', hot: true },
    { name: 'Claude Fable 5', vendor: 'Anthropic', region: 'overseas', date: '2026', ctx: '未查到', apiPrice: '未查到', ba: 79.5, tb21: null, tb40: null, swev: null, swepro: 80.0, dswe: null, aa: null, outUsd: null, tag: '上上代旗舰，SWE-Pro 80.0 时代的标杆' },
    { name: 'GLM-5.3', vendor: '智谱 AI', region: 'cn', date: '2026-08-14', ctx: '1M', apiPrice: '¥8 / ¥28', ba: null, tb21: 88.2, tb40: null, swev: 94.2, swepro: null, dswe: 66.9, aa: null, outUsd: 4.18, tpCols: ['swev'], tag: '对标 Fable 5 的旗舰，价格约其 1/7；FrontierSWE 78.1', hot: true },
    { name: 'GLM-5.3-Flash', vendor: '智谱 AI', region: 'cn', date: '2026-08', ctx: '1M', apiPrice: '¥0.8 / ¥2.8', ba: null, tb21: 84.3, tb40: 19.7, swev: null, swepro: null, dswe: 63.4, aa: null, outUsd: 0.42, tpCols: ['tb40'], tag: '约 1/10 价格的闪速版；另有 FlashX 极速版（200 tok/s）' },
    { name: 'GLM-5.2', vendor: '智谱 AI', region: 'cn', date: '2026', ctx: '未查到', apiPrice: '未查到', ba: null, tb21: null, tb40: null, swev: null, swepro: 62.1, dswe: 46.2, aa: null, outUsd: null, tag: '上代旗舰（开源标准化榜第二），DeepSWE 较 5.3-Flash 低 17 分' },
    { name: 'Kimi K3', vendor: '月之暗面', region: 'cn', date: '2026-07-17', ctx: '1M', apiPrice: '$3 / $15', ba: 73.99, tb21: 88.3, tb40: null, swev: 95.1, swepro: null, dswe: 67.5, aa: 57, outUsd: 15, tpCols: ['swev'], tag: '2.8T 参数全球最大开源模型；AA 57 = 开源权重历史最高（总榜第 4）', hot: true },
    { name: 'DeepSeek-V4-Pro', vendor: 'DeepSeek', region: 'cn', date: '2026-08-13', ctx: '1M', apiPrice: '¥9 / ¥27（高峰）· 半价（空闲）', ba: null, tb21: 87.9, tb40: null, swev: 80.6, swepro: null, dswe: 44.1, aa: null, outUsd: 4.02, tag: '极致性价比开源旗舰，峰谷计价', hot: true },
    { name: 'DeepSeek-V4.1-Flash', vendor: 'DeepSeek', region: 'cn', date: '2026-07-31', ctx: '1M', apiPrice: '¥2 / ¥8（高峰）· 半价（空闲）', ba: null, tb21: null, tb40: null, swev: 79.0, swepro: null, dswe: null, aa: null, outUsd: 1.19, tag: '全场最便宜的主力级模型，带视觉' },
    { name: 'Gemini 3.1 Pro', vendor: 'Google', region: 'overseas', date: '2026-02-19', ctx: '1M', apiPrice: '$2 / $12', ba: null, tb21: null, tb40: null, swev: 80.6, swepro: null, dswe: null, aa: null, outUsd: 12, tag: 'Google 上代最强编程模型，口径落差大（SWE-V 自报 80.6 vs 统一复测 46.1）' },
    { name: 'Gemini 3.8 Flash', vendor: 'Google', region: 'overseas', date: '2026-09-02', ctx: '1M', apiPrice: '$0.75 / $3.75（介绍价至 12-31）', ba: 72.74, tb21: 89.4, tb40: 19.1, swev: null, swepro: null, dswe: 73.7, aa: null, outUsd: 3.75, tag: '官方称编程表现匹敌 Opus 5；TB 2.1→4.0 落差 70 分（媒体称 benchmaxxing），防污染榜反而第二', hot: true },
    { name: 'Qwen3.8-Max', vendor: '阿里', region: 'cn', date: '2026-08-03', ctx: '未查到', apiPrice: '$2 / $6', ba: 73.1, tb21: 86.6, tb40: null, swev: null, swepro: 67.7, dswe: 56.6, aa: null, outUsd: 6, tag: '2.4T 参数 Apache 2.0 开放旗舰；SWE-Pro 67.7 为官方自报（第三方标准化榜未收录）' },
    { name: 'Qwen3.8-Flash-Next', vendor: '阿里', region: 'cn', date: '2026-08', ctx: '256K', apiPrice: '$0.16 / $0.47', ba: null, tb21: null, tb40: null, swev: null, swepro: 62.5, dswe: null, aa: null, outUsd: 0.47, tpCols: ['swepro'], tag: '第三方标准化榜（Morph）开源第一 SWE-Pro 62.5；$0.16/$0.47 价格屠夫' },
    { name: 'MiniMax-M3', vendor: 'MiniMax', region: 'cn', date: '2026-06-02', ctx: '1M', apiPrice: '$4.5 / $18', ba: null, tb21: null, tb40: null, swev: 80.5, swepro: 59.0, dswe: 44.1, aa: null, outUsd: 18, tag: '1M 上下文原生多模态，长文吞吐碾压级优化；SWE-Pro 59 开放权重第一' },
    { name: 'Grok 4.7', vendor: 'xAI', region: 'overseas', date: '2026-09-21', ctx: '约 500K', apiPrice: '$2 / $6', ba: null, tb21: null, tb40: 38.0, swev: null, swepro: null, dswe: null, aa: 46, outUsd: 6, tag: '最便宜的旗舰级，token 效率与延迟标杆；CursorBench 46.3', hot: true },
    { name: 'Grok 4.6', vendor: 'xAI', region: 'overseas', date: '2026-08-12', ctx: '约 500K', apiPrice: '$2 / $6（<200K 输入）', ba: null, tb21: 88.4, tb40: null, swev: null, swepro: null, dswe: null, aa: null, outUsd: 6, tag: '上代旗舰（TB 2.1 88.4 略超 GLM-5.3）；Grok 4.7 同价接替，另有 2 倍价高速版' },
    { name: 'Grok 4.5', vendor: 'xAI', region: 'overseas', date: '2026', ctx: '未查到', apiPrice: '未查到', ba: null, tb21: 83.3, tb40: null, swev: null, swepro: 64.7, dswe: 54.0, aa: null, outUsd: null, tag: '上上代旗舰，防污染榜中游' },
  ],

  /* ---------------- 基准排行（口径活跃榜，均注明自报/第三方） ---------------- */
  benchmarks: [
    { name: 'BenchAlign 综合榜（第三方聚合 · 2026-09-22 重校准版）', items: [
      { label: 'GPT-6 Astra', value: 88.5 },
      { label: 'Claude Opus 5.5', value: 88.5 },
      { label: 'Claude Fable 5.1', value: 83.3 },
      { label: 'GPT-6 Sol', value: 82.2 },
      { label: 'GPT-5.6 Sol', value: 80.4 },
      { label: 'Claude Opus 5', value: 80.4 },
      { label: 'Claude Fable 5', value: 79.5 },
      { label: 'Gemini 3.8 Flash', value: 72.7 },
    ]},
    { name: 'Terminal-Bench 2.1（终端任务 · 官方自报）', items: [
      { label: 'Claude Opus 5', value: 89.1 },
      { label: 'Kimi K3', value: 88.3 },
      { label: 'GLM-5.3', value: 88.2 },
      { label: 'DeepSeek V4-Pro', value: 87.9 },
      { label: 'Qwen3.8-Max', value: 86.6 },
      { label: 'Grok 4.5', value: 83.3 },
    ]},
    { name: 'SWE-bench Pro（真实仓库 · 官方自报）', items: [
      { label: 'Claude Opus 5.5', value: 89.9 },
      { label: 'Claude Fable 5.1', value: 81.2 },
      { label: 'Claude Fable 5', value: 80.0 },
      { label: 'Claude Opus 5', value: 79.2 },
      { label: 'Qwen3.8-Max', value: 67.7 },
      { label: 'Grok 4.5', value: 64.7 },
      { label: 'GPT-5.6 Sol', value: 64.6 },
      { label: 'GLM-5.2', value: 62.1 },
      { label: 'MiniMax M3', value: 59.0 },
    ]},
    { name: 'AA Intelligence Index v4.3.2（第三方聚合 · 9-22 重校后口径）', items: [
      { label: 'Claude Opus 5.5', value: 58 },
      { label: 'Kimi K3', value: 57 },
      { label: 'GPT-6 Astra', value: 53 },
      { label: 'Claude Fable 5.1', value: 53 },
      { label: 'Claude Opus 5', value: 51 },
      { label: 'Grok 4.7', value: 46 },
    ]},
    { name: 'Terminal-Bench 2.1（Vals 三方复测 · 三次全量）', items: [
      { label: 'Claude Opus 5.5', value: 87.6 },
      { label: 'GPT-6 Astra', value: 87.3 },
      { label: 'GPT-5.6 Sol', value: 85.8 },
      { label: 'Kimi K3', value: 80.9 },
    ]},
    { name: 'DeepSWE v1.1（Scale 防污染 · 官方/媒体转述）', items: [
      { label: 'Claude Opus 5.5', value: 74.2 },
      { label: 'Gemini 3.8 Flash', value: 73.7 },
      { label: 'GPT-5.6 Sol', value: 72.7 },
      { label: 'GPT-6 Sol', value: 68.8 },
      { label: 'Kimi K3', value: 67.5 },
      { label: 'GLM-5.3', value: 66.9 },
    ]},
  ],
  benchmarkNote: '重要口径提醒：SWE-bench Verified 自 2026 年起被各家弃用（OpenAI 2 月起停报、Anthropic 新模型不报），上表为新主流基准。BenchAlign 于 2026-09-22 随 Opus 5.5 / GPT-6 Sol 上榜整体重校准（各模型分数有升有降，与 09-21 版不可直接比较）。AA Intelligence Index（v4.3.2）为百分制加权指数，正常区间约 40–60 分，与上表其他基准量纲不同、不可横比；9-22 重校前的旧口径分数（如 Astra 59.3 / Opus 5 55.5）已剔除，未复测到新口径的模型 AA 列留白。所有分数为厂商自报或第三方转述，测试框架与推理档位不同，不可直接横比；同一基准的官方自报与第三方复测差距可观（如 Kimi K3 TB 2.1 官方 88.3 vs Vals 复测 80.9），模型表中带 † 的分数即第三方复测口径。统一复测请看 Morph / Scale 的 SWE-bench Pro 公共集与防污染 DeepSWE。',

  /* ---------------- 优惠与变动（type: promo 限时 / evergreen 常驻 / alert 变动提醒） ---------------- */
  deals: [
    { type: 'alert', title: 'Anthropic 发布 Claude Opus 5.5，订阅限额同步上调', detail: '9-22 发布：$4/$20（比 Opus 5 便宜约 20%，典型负载省 40%），多数任务达 Fable 5.1 水平；Pro/Max 5 小时限额再上调并新增「可保存的限额重置」；Sonnet/Haiku 5.5 数周内推出。', until: '已生效', url: 'https://www.anthropic.com/news/claude-opus-5-5' },
    { type: 'alert', title: 'OpenAI 发布 GPT-6 Sol / Luna 并进入 Codex', detail: '9-22 发布：Sol $2/$10（较 5.6 Sol 半价）、Luna $0.10/$0.50；即日起向 Plus / Pro / Business 开放（Go/Free 仅桌面端 Luna）；同日上线 GPT-6 缓存读取 9 折。', until: '已生效', url: 'https://openai.com/index/introducing-gpt-6-sol-and-luna/' },
    { type: 'promo', title: '火山方舟 Coding Plan 2.5 折普惠', detail: '首两个月 Lite ¥9.9 / Pro ¥49.9（刊例 ¥40 / ¥200），活动至 2026-11-08；邀请好友再享 9.5 折。', until: '2026-11-08', url: 'https://www.volcengine.com/activity/codingplan' },
    { type: 'promo', title: '智谱「庆双节」积分减半消耗', detail: '2026-09-25 至 10-07 全天按非高峰口径（积分减半）抵扣。', until: '2026-10-07', url: 'https://docs.bigmodel.cn/cn/coding-plan/notice/usage-revision.md' },
    { type: 'promo', title: '智谱「夜间畅用」', detail: '至 2026-10-07，每日 23:00–09:00：ZCode 端 GLM-5.3-Flash 无限畅用，其他 Agent 额度翻倍。', until: '2026-10-07', url: 'https://docs.bigmodel.cn/cn/coding-plan/overview.md' },
    { type: 'promo', title: '腾讯云 Token Plan 个人版积分 5 折', detail: '个人版抵扣系数按 50% 计量，活动期 2026-09-01 至 09-30，即将截止。', until: '2026-09-30', url: 'https://cloud.tencent.com/act/pro/tokenplan' },
    { type: 'promo', title: '阿里云百炼 Token Plan 限时价', detail: 'Lite ¥39 / Essential ¥79 / Standard ¥139 / Pro ¥499（原价 60/120/180/600），未公布截止。', until: '进行中', url: 'https://www.aliyun.com/benefit/scene/tokenplan' },
    { type: 'promo', title: 'MiniMax Token Plan 年付立省 + 用量翻倍升级', detail: '年付立省 ¥98–938；官方横幅「用量翻倍 · Frontier 模型」进行中。', until: '进行中', url: 'https://platform.minimaxi.com/subscribe/token-plan' },
    { type: 'promo', title: 'Trae 新用户首月优惠', detail: 'Lite 首月 ¥29.9 / Pro 首月 ¥69（连续包月档）。', until: '进行中', url: 'https://www.trae.cn/pricing' },
    { type: 'evergreen', title: 'Google AI Pro 学生免费 1 年', detail: 'SheerID 学籍验证，含 4x Gemini 与 5TB 存储，最长 4 年在校有效。', until: '常驻', url: 'https://one.google.com/about/google-ai-plans' },
    { type: 'evergreen', title: 'GitHub Copilot 学生 / 教师 / 开源维护者免费', detail: 'Copilot Student 计划；教师与知名 OSS 维护者可免费获 Pro。', until: '常驻', url: 'https://github.com/features/copilot/plans' },
    { type: 'evergreen', title: 'Kimi 加油包（会员可购）', detail: '单价≈开放平台 API 价，¥25 起、不过期可叠加，余额上限 ¥10,000。', until: '常驻', url: 'https://www.kimi.com/code/docs/kimi-code/membership.html' },
    { type: 'alert', title: '智谱 2026-07-30 改版：新用户价格大幅上调', detail: 'Coding Plan 改积分制：Lite ¥49→118、Pro ¥149→538、Max ¥469→1,078；V1/V2 老用户到期前可按原价续订。', until: '已生效', url: 'https://docs.bigmodel.cn/cn/coding-plan/notice/usage-revision.md' },
    { type: 'alert', title: 'OpenAI Pro 20x（$200）暂停新订，限时回订窗口开启', detail: '9-10 起暂停新订/升级；9-18 起 9-10 当天在订或此前 30 天内退订的用户可回订一次（窗口 30 天），全新用户仍不可购。', until: '已生效', url: 'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers' },
  ],

  /* ---------------- 推荐卡（怎么选） ----------------
     rating 三维 1–5 分 + 综合：性价比（¥/亿 token 与价位）、模型强度
     （档内最强模型的基准成绩）、上手门槛（支付/网络/配置难度，5=最容易）
  */
  picks: [
    { scene: '预算优先', title: '火山方舟 Coding Plan Lite', price: '首两月 ¥9.9 · 之后 ¥40/月', desc: '12 款模型自由切换（豆包/Kimi/GLM/DeepSeek），Claude Code 等工具不限，当前国内性价比最突出。', link: 'https://www.volcengine.com/activity/codingplan', rating: { value: 5, model: 3.5, ease: 5, overall: 4.5 } },
    { scene: '想在 Claude Code 里用国产模型', title: '智谱 GLM Coding Plan / 腾讯云 Token Plan', price: '¥39–118/月', desc: '两者都兼容 Claude Code / Codex / Cline 等主流 Agent，人民币直付；智谱旗舰 GLM-5.3、腾讯聚合多家模型。', link: 'https://bigmodel.cn/glm-coding', rating: { value: 4, model: 4, ease: 5, overall: 4.3 } },
    { scene: '旗舰体验 · 不计成本', title: 'Claude Max（5x / 20x）', price: '$100–200/月', desc: 'Opus 5.5（9-22 新发布，多数任务达 Fable 5.1 水平）与 Fable 5.1 畅用，5 小时限额再上调；需海外支付与网络环境。', link: 'https://claude.com/pricing', rating: { value: 2, model: 5, ease: 2, overall: 3.0 } },
    { scene: '轻量入门 / 学生', title: 'GitHub Copilot Pro', price: '$10/月 · 学生免费', desc: '1,500 Credits/月可调 29 款模型，补全不限量；对中国用户可访问性最好的海外档。', link: 'https://github.com/features/copilot/plans', rating: { value: 4, model: 4, ease: 3.5, overall: 3.8 } },
    { scene: '按量付费 · 随用随付', title: 'DeepSeek API + 开源工具', price: '空闲时段输入 ¥1 / 输出 ¥4', desc: '不订阅、按 token 计费，配 Cline / Goose 等开源 Agent 使用；轻度使用月成本可低至个位数。', link: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/', rating: { value: 5, model: 4, ease: 3, overall: 4.0 } },
  ],

  /* ---------------- 口径说明 ---------------- */
  units: [
    { vendor: '智谱 / 腾讯 / 阿里 / 火山(Agent Plan)', unit: '积分 / Credits', desc: '按 token 消耗乘以各模型抵扣系数折算，各家系数不同，不可直接换算' },
    { vendor: 'Kimi', unit: '共享月度 token 池', desc: '网页对话与 Kimi Code 共用一个池，官方只显示百分比，绝对值为第三方估算' },
    { vendor: 'Claude / 智谱 / MiniMax / 火山', unit: '5 小时窗口 + 周限额', desc: '滚动窗口，起算点各家不同（智谱按消耗时刻、火山按首次请求）' },
    { vendor: 'GitHub Copilot / Augment', unit: 'AI Credits（美元化）', desc: '1 credit = $0.01，超额按 $0.01/credit 加购' },
    { vendor: 'Cursor / OpenAI', unit: '相对倍数', desc: '官方只给「3x / 20x Pro」这类倍数或消息区间，无绝对数' },
    { vendor: 'DeepSeek', unit: '纯 API 按量', desc: '无订阅；空闲/高峰两档价格，空闲为高峰一半' },
  ],
  faqs: [
    { q: '「每亿 token 成本」和「月额度测算」是怎么算的？', a: '每亿成本 = 月费 ÷ 月额度测算值（海外按汇率折人民币）。测算值分级标注：智谱与腾讯为官方积分规则/刊例口径推导（高可信）；Claude/ChatGPT/火山为第三方实测（GitHub 实测仓库与 Reddit 多帖互验）；阿里为 qwen3.6-plus 官方示例系数推导；Copilot/Cursor/Grok 为「包含美元额度 ÷ API 牌价」推导（模型依赖极大）。Trae 等积分折算率未公开的档位标 —，不编数。几乎所有额度都随模型与缓存命中率浮动，仅供量级参考。' },
    { q: '套餐表里的 BenchAlign 分数是什么？', a: 'BenchAlign 为第三方聚合综合榜，2026-09-22 随 Claude Opus 5.5 与 GPT-6 Sol 上榜整体重校准（与旧版分数不可直接比较）。表内取该套餐档内最强可选模型的成绩；聚合套餐（火山/腾讯）按可选模型中最高的计。未上榜的模型标 — 并在悬停提示中给出其他基准成绩（如 Terminal-Bench）；各家基准口径不同，跨基准分数不可直接比较，详见模型对比区。' },
    { q: '为什么不同套餐的「额度」没法直接比大小？', a: '各家计量单位不同（积分、次数、token 池、美元 Credits、相对倍数），时间窗口也不同（5 小时 / 周 / 月 / 7 天滚动）。本站在额度列保留官方原口径，带 * 的 token 换算为第三方估算，仅供量级参考。' },
    { q: '智谱 GLM Coding Plan 为什么涨这么多？', a: '2026-07-30 改版为积分制并上调新用户价（Lite ¥49→118 等）。V1/V2 老用户在套餐到期前仍可按原价续订；新购用户建议同时对比火山方舟、腾讯云等聚合套餐。' },
    { q: '海外套餐在国内能用吗？', a: 'Anthropic / OpenAI / Google / xAI 官方均不支持中国大陆地区，需海外网络与国际支付；GitHub Copilot 对国内用户门槛最低；Cursor 产品下载不受限但支付需国际卡。Cline / Goose 等开源工具配任意 API Key（含国产模型）可直连使用。' },
    { q: 'SWE-bench Verified 分数怎么都不见了？', a: '2026 年起各家陆续停报 Verified（OpenAI 自 2026-02、Anthropic 新模型不报），改报 SWE-bench Pro、Terminal-Bench、DeepSWE 等新基准。本站模型页以新基准为主，并注明自报/第三方口径。' },
    { q: '带 * 的 token 数是怎么来的？', a: '为知乎等社区横评（2026-08-10）的第三方估算值，官方未确认；各家积分折算系数动态调整，实际可用量请以控制台显示为准。' },
  ],
};
