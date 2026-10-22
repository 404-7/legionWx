'use strict';
/* ===== 全局配置：地图布局、经济、国王、平衡常数 ===== */
const CFG = {
  W: 1800, H: 1440,

  COLS: 12, ROWS: 16, CELL: 32,
  GRID_W: 12 * 32, GRID_H: 16 * 32,
  FIELD_W: 432, FIELD_H: 576,
  ROAD_Y: 720, GATE_LEFT: 820, GATE_RIGHT: 980,
  ARENA_WAVES: [10, 20], ARENA_PREP: 30, ARENA_LIMIT: 180,

  START_GOLD: 300,
  START_INCOME: 6,
  FIRST_PREP: 32,           // 第一波准备时间(秒)
  PREP_TIME: 22,            // 之后每波准备时间

  TOTAL_WAVES: 31,
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

// Browser equivalents for native Warcraft order/guard behavior, in seconds and world pixels.
const COMBAT_AI={SCAN:.2,LOCK:.65,LOST:1.25,CHASE:8,BLOCKED:1.25,RANGE_EPS:.1,LEASH:440,ENEMY_LEASH:280,
  REACQUIRE:.9,IGNORE:2,THREAT_LIFE:4,SWITCH_RATIO:1.45,ADVANCE:120,RETURN_EPS:6};

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

const ATK_TYPES  = ['普通', '穿刺', '魔法', '攻城', '混乱'];
const ARMOR_TYPES = ['无甲', '轻甲', '中甲', '重甲', '城甲'];

/* 攻击 × 护甲 伤害倍率（>1 克制 / <1 被抵抗） */
const ATK_ARMOR = {
  '普通': { '无甲': 1, '轻甲': 1, '中甲': 1.5, '重甲': 1, '城甲': .7 },
  '穿刺': { '无甲': 1.5, '轻甲': 2, '中甲': .75, '重甲': 1, '城甲': .35 },
  '魔法': { '无甲': 1, '轻甲': 1.25, '中甲': .75, '重甲': 2, '城甲': .35 },
  '攻城': { '无甲': 1.5, '轻甲': 1, '中甲': .5, '重甲': 1, '城甲': 1.5 },
  '混乱': { '无甲': 1, '轻甲': 1, '中甲': 1, '重甲': 1, '城甲': 1 },
};

const RACES = {
  mech: { name: '机械', icon: '⚙', color: '#e6bd71', desc: '装甲前排、领导光环与远程火力', tip: '新兵挡线，机枪手输出；队长为周围单位增伤。' },
  nature: { name: '自然', icon: '♣', color: '#9bd18b', desc: '树人坚守、游侠点杀与生命恢复', tip: '树人承担伤害，游侠后排射击；生命之树持续治疗。' },
  beast: { name: '野兽', icon: '♞', color: '#d4a77d', desc: '猛兽重击、持续压制与龙族范围伤害', tip: '食人魔抵挡前锋，鹰身女妖减速；龙裔清理密集怪群。' },
  shadow: { name: '暗影', icon: '☽', color: '#b6a0e5', desc: '骷髅狂攻、蛛网控制与不死守卫', tip: '腐肉喷吐者减速，守门人召唤魔犬续战；梦魇针对单体。' },
  orc: { name: '兽人', icon: '⚑', color: '#9dc78b', desc: '重装近战、巫医治疗与酋长震击', tip: '步兵搭配巫医续航，术士减速；酋长提供近战溅射。' },
  undead: { name: '亡灵', icon: '☠', color: '#82c8c5', desc: '骷髅召唤、进阶吸血与瘟疫消耗', tip: '狂暴食尸鬼近战吸血；绞肉车后排攻击，死灵法师召唤援军。' },
  element: {name:'元素',icon:'◇',color:'#8dbbe5',desc:'质子、水灵、泥人、门徒与黑暗先知',tip:'完整导入原版六阶兵种；这是原版元素种族，不再拆成风火水土。'},
  ghost: {name:'幽魂',icon:'◌',color:'#b6c3d9',desc:'相位闪避、姿态切换与法力技能',tip:'英雄之魂可免费切换进攻和防御姿态；幻影依靠主动法术输出。'},
  demi: {name:'半人',icon:'⚒',color:'#c8af8d',desc:'科学家、部落猎手、医者与牛头怪',tip:'科学家可经工程师升为变异体；近战与施法辅助协同。'},
  marine: {name:'海洋',icon:'≈',color:'#78c5ce',desc:'幼体、卵囊、美人鱼与九头蛇',tip:'幼体有三级与分支路线；九头蛇死亡后分裂。'},
  elf: {name:'精灵',icon:'✧',color:'#c0b3e2',desc:'骑手、哨兵、德鲁伊与月之守卫',tip:'德鲁伊可分支为飞升者或剑术法师。'},
  arctic: {name:'极地',icon:'❄',color:'#b4d8eb',desc:'海象人、霜狼、冰霜巨魔与冰龙',tip:'冰霜控制与防御型前排，原表的全部六阶兵种。'},
  goblin: {name:'地精',icon:'⚙',color:'#c5cd83',desc:'地雷、炮塔、飞行器与炼金师',tip:'战斗地雷会爆炸；与产金的经济金矿是不同单位。'},
  human: {name:'人族',icon:'♜',color:'#c5cbe0',desc:'农民、弓箭手、步兵、牧师与骑士',tip:'牧师单体治疗；精锐弓箭手多目标攻击。'},
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
