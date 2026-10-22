# 3.41 数据与取值规则

当前唯一玩法基准是用户提供的 Legion TD Mega 3.41 unprotect.w3x（SHA-256 1fe202a1e60e64a5b2f6a5498ac169fe3039590f7f41e3abbb8ded6ba154114b）。所有旧用户定制已撤销；当前移植状态见 [原图基准](native341.md)。

地图物编与 JASS 优先于 3.41 stats 2011-10-25.xls。187 个表内记录和额外召唤物保留表格来源行与 sheetStats，运行时攻击、生命、价格、攻击间隔和点数价值采用物编覆盖值；未覆盖的基础对象字段单独标记继承默认值。

scripts/build341.cjs 结合 scripts/rules341.cjs、scripts/native341.cjs、scripts/king341.cjs 和 scripts/merc341.cjs 生成单机与服务器共用的 js/source341.js。原图坐标、木材经济、研究和默认模式记录保存在 SOURCE341.rules.native。data/legion341-weapons-audit.json 保留每个武器的数值和来源。

只解析数据和 JASS 文本，不执行原地图脚本。不把下载目录或原地图文件加入 Git。重建仍使用 scripts/import341-sheet.py、scripts/inspect-map341.py 及缓存的 w3u/w3a/w3q/JASS；运行游戏无需这些提取依赖。

用户没有 Warcraft III 客户端，缺少完整原生基础对象数据库。原引擎寻路、雇佣兵建造者特殊流程、部分可选模式及国王物品栏等尚未全部移植；国王手动控制和 Hybrid、Prophet 流程已接入。不能用审计里没有未映射技能 ID 来证明所有行为已 1:1。
