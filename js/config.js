'use strict';
/* ===== 全局配置：地图布局、经济、国王、平衡常数 ===== */
const CFG = {
  W: 1300, H: 800,

  COLS: 6, ROWS: 6, CELL: 38,
  GRID_W: 6 * 38,
  GRID_H: 6 * 38,           // 228
  FIELD_W: 300, FIELD_H: 296,

  START_GOLD: 150,
  START_INCOME: 6,
  FIRST_PREP: 32,           // 第一波准备时间(秒)
  PREP_TIME: 22,            // 之后每波准备时间

  TOTAL_WAVES: 30,
  WAVE_HP0: 58, WAVE_HP_G: 1.155,
  WAVE_DMG0: 9, WAVE_DMG_G: 1.085,
  OVERTIME_GROW: 1.33,      // 30 波后加时赛每波递增

  KING_HP: 4200, KING_REGEN: 2, KING_DMG: 60,
  KING_ASPD: 1.15, KING_RANGE: 125, KING_SPLASH: 90,
  KING_UP_BASE: 80, KING_UP_GROW: 40,   // 升级费用 = BASE + GROW*lvl

  AGGRO: 150,               // 敌人索敌半径
  PROJ_SPEED: 340,
  COMBAT_TIMEOUT: 240,      // 单波战斗安全阀(秒)，超时剩余敌人全部漏过

  DIFFS: {
    easy:   { label: '简单', emult: 0.85, aiMult: 0.85, allyMult: 1.15 },
    normal: { label: '标准', emult: 1.00, aiMult: 1.00, allyMult: 1.12 },
    hard:   { label: '困难', emult: 1.16, aiMult: 1.15, allyMult: 1.00 },
  },
};

const KING_UPGRADES = {
  health: { name: '生命', effect: '生命上限 +150，恢复 150 生命', amount: 150 },
  attack: { name: '攻击', effect: '攻击力 +9', amount: 9 },
  regen: { name: '生命恢复', effect: '每秒恢复 +1 生命', amount: 1 },
};

const MINE = {
  COST: 100, LIMIT: 6, INTERVAL: 5,
  LEVELS: [
    { gold: 8, upgrade: 80 },
    { gold: 12, upgrade: 120 },
    { gold: 18, upgrade: 180 },
    { gold: 26, upgrade: 260 },
    { gold: 36, upgrade: null },
  ],
};

const ATK_TYPES  = ['普通', '穿刺', '魔法', '攻城'];
const ARMOR_TYPES = ['无甲', '轻甲', '中甲', '重甲'];

/* 攻击 × 护甲 伤害倍率（>1 克制 / <1 被抵抗） */
const ATK_ARMOR = {
  '普通': { '无甲': 1.00, '轻甲': 1.30, '中甲': 1.00, '重甲': 0.70 },
  '穿刺': { '无甲': 1.30, '轻甲': 0.75, '中甲': 1.00, '重甲': 1.25 },
  '魔法': { '无甲': 1.00, '轻甲': 1.05, '中甲': 1.25, '重甲': 0.95 },
  '攻城': { '无甲': 1.25, '轻甲': 1.00, '中甲': 0.70, '重甲': 1.05 },
};

const RACES = {
  mech: { name: '机械', icon: '⚙', color: '#e6bd71', desc: '装甲前排、领导光环与远程火力', tip: '新兵挡线，机枪手输出；队长为周围单位增伤。' },
  nature: { name: '自然', icon: '♣', color: '#9bd18b', desc: '树人坚守、游侠点杀与生命恢复', tip: '树人承担伤害，游侠后排射击；生命之树持续治疗。' },
  beast: { name: '野兽', icon: '♞', color: '#d4a77d', desc: '猛兽重击、持续压制与龙族范围伤害', tip: '食人魔抵挡前锋，鹰身女妖减速；龙裔清理密集怪群。' },
  shadow: { name: '暗影', icon: '☽', color: '#b6a0e5', desc: '骷髅狂攻、蛛网控制与不死守卫', tip: '腐肉喷吐者减速，守门人复活续战；梦魇针对单体。' },
  orc: { name: '兽人', icon: '⚑', color: '#9dc78b', desc: '重装近战、巫医治疗与酋长震击', tip: '步兵搭配巫医续航，术士减速；酋长提供近战溅射。' },
  undead: { name: '亡灵', icon: '☠', color: '#82c8c5', desc: '食尸鬼吸血、绞肉车轰击与瘟疫消耗', tip: '食尸鬼近战吸血；绞肉车在后排攻击，死灵法师以瘟疫消耗。' },
};
const TEAM_COLORS = ['#4da3ff', '#ff6a4d'];

const TRAIT_INFO = {
  fast:   { n: '疾速',     d: '移动速度提升 50%，生命略降' },
  regen:  { n: '再生',     d: '每秒恢复 2% 生命' },
  magic:  { n: '魔法免疫', d: '受到魔法攻击伤害 -90%' },
  heavy:  { n: '重甲',     d: '护甲变为重甲，生命 +15%' },
  swarm:  { n: '蜂拥',     d: '数量 ×1.7，但更脆弱' },
  boss:   { n: '首领',     d: '巨型首领单位，血厚攻高' },
  ranged: { n: '远程',     d: '该波敌人远程攻击' },
};
