'use strict';
// Shared fixed battle vision. Public king approaches are an L-shaped corridor.
function visionOpen(state){return state.phase==='over'||state.phase==='menu'||state.battleMode==='arena'||!!state.bonus;}
function publicEnemyVision(state,team){
  const king=state.kings[1-team],exit=state.players.find(p=>p.team!==team).exitX;
  return {king,exit,r:56,kingRadius:82,bridge:{x:CFG.W/2-120,y:CFG.ROAD_Y-110,w:240,h:220}};
}
function pointVisibleToTeam(state,team,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 if(visionOpen(state))return true;
 const r=SOURCE341.rules.native.map.rects[team===0?'LVision':'RVision'],m=SOURCE341.rules.native.map;
 return x>=(r[0]-m.minX)*m.scale&&x<=(r[2]-m.minX)*m.scale&&y>=(m.maxY-r[3])*m.scale&&y<=(m.maxY-r[1])*m.scale;
}

function visibleGameLogs(state,team){return state.logLines.filter(l=>l.team==null||l.team===team);}
function arenaCountText(count){return count==null?'未知':count;}
function incomeVisibleToTeam(state,team,player){return player.team===team||state.battleMode==='arena'||visionOpen(state);}
function scopeBattleSnapshot(state,slot){
  const viewer=state.players[slot];if(!viewer)throw Error('无效视角');
  const team=viewer.team;state.vision={team,fog:!visionOpen(state)};
  if(visionOpen(state))return state;
  delete state.entitySerial;
  if(state.kingGoldPools)state.kingGoldPools[1-team]=null;
  const visible=u=>pointVisibleToTeam(state,team,u.x,u.y);
  const hiddenArmy=state.players.filter(p=>p.team!==team).some(p=>p.fighters.some(f=>(f.hp>0||f.deadT>0)&&!visible(f)));
  const publicUnit=u=>Object.fromEntries(Object.entries(u).filter(([key])=>!['col','row','spent','homeX','homeY','brain','route','routeIndex','laneX'].includes(key)));
  for(const p of state.players)if(p.team!==team){
    p.towers=[];p.workerHarvest=[];p.builderChoices=null;p.builderChanges=null;p.prophetDeck=[];p.prophetRerolls=null;p.farmPending=null;
    p.fighters=p.fighters.filter(visible).map(publicUnit);p.enemies=p.enemies.filter(visible).map(publicUnit);
    p.mines=[];p.gold=null;p.wood=null;p.workers=null;p.workerQueue=[];p.lumberResearch=null;p.lumberLevel=null;p.farmLevel=null;if(!incomeVisibleToTeam(state,team,p))p.income=null;p.paid=null;p.leakCount=null;p.aiT=null;
    p.spawnList=[];p.mercSpawnList=[];p.mercSpawnT=null;p.spawnT=null;
    p.mercQueue=p.mercQueue.map(()=>null);
  }
  for(const k of state.kings)if(k.team!==team){k.leaks=k.leaks.filter(visible).map(publicUnit);k.manualTarget=null;k.controller=null;k.controlLock=null;}
  if(state.arena&&hiddenArmy)state.arena.counts[1-team]=null;
  state.projectiles=state.projectiles.filter(pr=>visible(pr)&&pointVisibleToTeam(state,team,pr.px,pr.py));
  if(state.skillWaves)state.skillWaves=state.skillWaves.filter(w=>visible(w)&&pointVisibleToTeam(state,team,w.px,w.py));
  state.fx=state.fx.filter(visible);state.floaters=state.floaters.filter(visible);
  state.logLines=visibleGameLogs(state,team);
  return state;
}
/* ===== 全局配置：地图布局、经济、国王、平衡常数 ===== */
const CFG = {
  W: SOURCE341.rules.native.map.width, H: SOURCE341.rules.native.map.height,

  COLS: 18, ROWS: 25, CELL: 24,
  GRID_W: 18 * 24, GRID_H: 25 * 24,
  FIELD_W: 18 * 24, FIELD_H: 25 * 24,
  ROAD_WIDTH: 464, ROAD_BRANCH_WIDTH: 192,
  ROAD_Y: 1124, GATE_LEFT: 1640, GATE_RIGHT: 1880,
  ARENA_WAVES: [10, 20], ARENA_PREP: SOURCE341.rules.timing.arenaPrepare,

  START_GOLD: SOURCE341.rules.native.startGold,
  START_INCOME: SOURCE341.rules.native.startIncome,
  FIRST_PREP: SOURCE341.rules.timing.first,

  TOTAL_WAVES: 31,
  WAVE_HP0: 58, WAVE_HP_G: 1.155,
  WAVE_DMG0: 9, WAVE_DMG_G: 1.085,
  OVERTIME_GROW: 1.33,      // 30 波后加时赛每波递增

  KING_HP: SOURCE341.king.hp, KING_REGEN: SOURCE341.king.regen, KING_DMG: (SOURCE341.king.min+SOURCE341.king.max)/2,
  KING_ASPD: SOURCE341.king.interval, KING_RANGE: SOURCE341.king.range,

  AGGRO: 150,               // 敌人索敌半径
  PROJ_SPEED: 340,

  DIFFS: {
    normal: { label: '原版 3.41', emult: 1.00, aiMult: 1.00, allyMult: 1.00 },
  },
};

// Browser equivalents for native Warcraft order/guard behavior, in seconds and world pixels.
const COMBAT_AI={SCAN:.2,LOCK:.65,LOST:1.25,CHASE:8,BLOCKED:1.25,RANGE_EPS:.1,LEASH:440,ENEMY_LEASH:280,
  REACQUIRE:.9,IGNORE:2,THREAT_LIFE:4,SWITCH_RATIO:1.45,ADVANCE:120,RETURN_EPS:6};

const KING_UPGRADES = {
  health: { name: '生命', ...SOURCE341.king.upgrades.health },
  attack: { name: '攻击', ...SOURCE341.king.upgrades.attack },
  regen: { name: '生命恢复', ...SOURCE341.king.upgrades.regen },
};

const MINE = {
  COST: Infinity, LIMIT: 0, INTERVAL: 5,
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
const ATK_ARMOR = SOURCE341.rules.damage;

const RACES = {
  hybrid:{name:'混合',icon:'✥',color:'#d8b288',desc:'原图 Hybrid：建造六阶随机塔',tip:'按阶付费，建成后从原图该阶单位池随机替换；退款按替换后实际单位处理。'},
  prophet:{name:'预言者',icon:'✦',color:'#c5a5de',desc:'原图 Prophet：每阶随机一个基础兵种',tip:'六阶各抽取一种兵，保留其原生升级分支；可按原图重抽研究更新可建造组合。'},
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
