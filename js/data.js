'use strict';
/* ===== 数据定义：兵种 / 雇佣兵 / 波次 ===== */

/* abil 可选字段：
   splash{p,r} 溅射  slow{p,d} 减速  burn{dps,r} 灼烧光环
   aura{p,r} 攻击光环  crit{c,m} 暴击  reinc 复活  chain{n,f} 连锁  regen{p} 自愈 */
const UNITS = {
  /* ---- 火：爆发 / 溅射 ---- */
  fire_elem:     { name: '火元素',   cost: 55,  el: '火', atk: '魔法', armor: '轻甲', hp: 130,  dmg: 27, aspd: 1.15, range: 135, abil: { splash: { p: .5, r: 46 } }, up: 'fire_lord' },
  fire_lord:     { name: '烈焰领主', cost: 165, el: '火', atk: '魔法', armor: '中甲', hp: 340,  dmg: 66, aspd: 1.05, range: 145, abil: { splash: { p: .6, r: 56 } } },
  lava_warrior:  { name: '熔岩武士', cost: 50,  el: '火', atk: '普通', armor: '重甲', hp: 580,  dmg: 24, aspd: .95,  range: 36,  abil: { burn: { dps: 15, r: 60 } }, up: 'lava_giant' },
  lava_giant:    { name: '熔岩巨兽', cost: 170, el: '火', atk: '普通', armor: '重甲', hp: 1300, dmg: 55, aspd: .90,  range: 40,  abil: { burn: { dps: 32, r: 72 } } },
  flame_archer:  { name: '火焰射手', cost: 60,  el: '火', atk: '穿刺', armor: '无甲', hp: 150,  dmg: 19, aspd: .62,  range: 150, abil: {}, up: 'sniper' },
  sniper:        { name: '狙击手',   cost: 160, el: '火', atk: '穿刺', armor: '轻甲', hp: 300,  dmg: 46, aspd: .55,  range: 165, abil: { crit: { c: .25, m: 2 } } },
  phoenix:       { name: '凤凰',     cost: 300, el: '火', atk: '魔法', armor: '轻甲', hp: 430,  dmg: 75, aspd: 1.0,  range: 150, abil: { splash: { p: .55, r: 52 }, reinc: {} } },

  /* ---- 水：控制 / 消耗 ---- */
  water_nymph:   { name: '水灵',     cost: 50,  el: '水', atk: '魔法', armor: '轻甲', hp: 140,  dmg: 23, aspd: 1.10, range: 130, abil: { slow: { p: .35, d: 1.6 } }, up: 'tide_maiden' },
  tide_maiden:   { name: '潮汐女神', cost: 160, el: '水', atk: '魔法', armor: '中甲', hp: 330,  dmg: 55, aspd: 1.0,  range: 140, abil: { slow: { p: .45, d: 2.0 }, splash: { p: .4, r: 40 } } },
  coral_guard:   { name: '珊瑚守卫', cost: 55,  el: '水', atk: '普通', armor: '中甲', hp: 720,  dmg: 20, aspd: 1.0,  range: 36,  abil: {}, up: 'deep_giant' },
  deep_giant:    { name: '深海巨人', cost: 175, el: '水', atk: '普通', armor: '重甲', hp: 1560, dmg: 50, aspd: .95,  range: 40,  abil: { regen: { p: .015 } } },
  ice_mage:      { name: '寒冰法师', cost: 110, el: '水', atk: '魔法', armor: '轻甲', hp: 240,  dmg: 44, aspd: 1.30, range: 140, abil: { slow: { p: .5, d: 2.2 } } },
  kraken:        { name: '海妖',     cost: 290, el: '水', atk: '魔法', armor: '中甲', hp: 410,  dmg: 70, aspd: 1.10, range: 150, abil: { chain: { n: 3, f: .7 }, slow: { p: .3, d: 1.2 } } },

  /* ---- 土：坦克 / 光环 ---- */
  golem:         { name: '石头人',   cost: 45,  el: '土', atk: '普通', armor: '重甲', hp: 620,  dmg: 20, aspd: 1.0,  range: 36,  abil: {}, up: 'rock_guard' },
  rock_guard:    { name: '岩石守卫', cost: 150, el: '土', atk: '普通', armor: '重甲', hp: 1400, dmg: 52, aspd: .95,  range: 40,  abil: {} },
  earth_priest:  { name: '大地祭司', cost: 90,  el: '土', atk: '魔法', armor: '无甲', hp: 220,  dmg: 30, aspd: 1.20, range: 120, abil: { aura: { p: .14, r: 150 } }, up: 'prophet' },
  prophet:       { name: '荒野先知', cost: 230, el: '土', atk: '魔法', armor: '轻甲', hp: 380,  dmg: 62, aspd: 1.15, range: 130, abil: { aura: { p: .24, r: 160 } } },
  thorn_archer:  { name: '荆棘射手', cost: 70,  el: '土', atk: '攻城', armor: '无甲', hp: 160,  dmg: 30, aspd: 1.35, range: 140, abil: {}, up: 'siege_ballista' },
  siege_ballista:{ name: '攻城弩',   cost: 180, el: '土', atk: '攻城', armor: '轻甲', hp: 330,  dmg: 72, aspd: 1.30, range: 150, abil: {} },
  titan:         { name: '泰坦',     cost: 320, el: '土', atk: '普通', armor: '重甲', hp: 1860, dmg: 78, aspd: 1.10, range: 42,  abil: { aura: { p: .16, r: 170 } } },

  /* ---- 风：速攻 / 游击 ---- */
  wind_elem:     { name: '风元素',   cost: 40,  el: '风', atk: '魔法', armor: '无甲', hp: 110,  dmg: 16, aspd: .75,  range: 120, abil: {}, up: 'storm' },
  storm:         { name: '风暴元素', cost: 130, el: '风', atk: '魔法', armor: '轻甲', hp: 250,  dmg: 36, aspd: .70,  range: 135, abil: {} },
  wolf_rider:    { name: '狼骑兵',   cost: 55,  el: '风', atk: '穿刺', armor: '中甲', hp: 470,  dmg: 20, aspd: .60,  range: 38,  abil: { crit: { c: .15, m: 2 } }, up: 'alpha_wolf' },
  alpha_wolf:    { name: '头狼',     cost: 165, el: '风', atk: '穿刺', armor: '中甲', hp: 1000,  dmg: 45, aspd: .55,  range: 42,  abil: { crit: { c: .30, m: 2 } } },
  eagle_eye:     { name: '鹰眼',     cost: 90,  el: '风', atk: '穿刺', armor: '无甲', hp: 200,  dmg: 40, aspd: 1.25, range: 205, abil: {} },
  storm_lord:    { name: '风暴领主', cost: 300, el: '风', atk: '魔法', armor: '轻甲', hp: 390,  dmg: 62, aspd: 1.0,  range: 150, abil: { chain: { n: 3, f: .7 } } },
};

/* 兵种有效攻击距离：近战含索敌余量（可够到远程波敌人） */
function effRange(def) { return def.range + (def.range <= 45 ? 18 : 0); }

/* 兵种能力文字描述（商店/详情用） */
function abilDesc(def) {
  const a = def.abil || {};
  const parts = [];
  if (a.splash) parts.push(`溅射${Math.round(a.splash.p * 100)}%`);
  if (a.slow)   parts.push(`减速${Math.round(a.slow.p * 100)}%/${a.slow.d}s`);
  if (a.burn)   parts.push(`灼烧${a.burn.dps}/s`);
  if (a.aura)   parts.push(`光环+${Math.round(a.aura.p * 100)}%攻`);
  if (a.crit)   parts.push(`${Math.round(a.crit.c * 100)}%暴击×${a.crit.m}`);
  if (a.reinc)  parts.push('每波复活一次');
  if (a.chain)  parts.push(`连锁${a.chain.n}目标`);
  if (a.regen)  parts.push(`自愈${(a.regen.p * 100).toFixed(1)}%/s`);
  return parts.join(' · ');
}

/* ---- 雇佣兵：送给敌方施加压力，同时提高收入 ---- */
const MERCS = {
  imp:     { name: '小恶魔',   cost: 25,  income: 1, hp: 180,  dmg: 14,  aspd: 1.1,  range: 30,  speed: 58, armor: '无甲', atk: '普通', r: 9 },
  bandit:  { name: '强盗',     cost: 40,  income: 2, hp: 300,  dmg: 22,  aspd: 1.0,  range: 30,  speed: 55, armor: '轻甲', atk: '普通', r: 10 },
  stone:   { name: '石魔',     cost: 65,  income: 3, hp: 700,  dmg: 26,  aspd: 1.1,  range: 30,  speed: 48, armor: '重甲', atk: '普通', r: 11 },
  wyvern:  { name: '双足飞龙', cost: 95,  income: 4, hp: 520,  dmg: 40,  aspd: 1.0,  range: 100, speed: 62, armor: '轻甲', atk: '穿刺', r: 10 },
  abyss:   { name: '深渊兽',   cost: 140, income: 6, hp: 1500, dmg: 75,  aspd: 1.1,  range: 32,  speed: 50, armor: '中甲', atk: '普通', r: 13 },
  ancient: { name: '远古凶兽', cost: 210, income: 9, hp: 3200, dmg: 130, aspd: 1.2,  range: 34,  speed: 44, armor: '重甲', atk: '攻城', r: 16 },
};

/* ---- 波次表（1~30）---- */
const WAVE_TRAIT_SCHEDULE = {
  4: 'fast', 6: 'regen', 7: 'magic', 9: 'ranged', 10: 'boss',
  12: 'fast', 13: 'heavy', 15: 'swarm', 16: 'regen', 17: 'magic',
  18: 'fast', 20: 'boss', 21: 'heavy', 23: 'swarm', 24: 'regen',
  26: 'magic', 27: 'fast', 28: 'heavy', 29: 'ranged', 30: 'boss',
};

const WAVES = [];
(function buildWaves() {
  for (let w = 1; w <= CFG.TOTAL_WAVES; w++) {
    let count = Math.min(6 + Math.floor(w * 0.4), 13);
    let hp   = CFG.WAVE_HP0 * Math.pow(CFG.WAVE_HP_G, w - 1);
    let dmg  = CFG.WAVE_DMG0 * Math.pow(CFG.WAVE_DMG_G, w - 1);
    let speed = Math.min(46 + w * 1.4, 90);
    let aspd = 1.15, range = 30, r = 10, regen = 0, magicImmune = false, boss = false;
    let armor = ['无甲', '轻甲', '中甲', '重甲', '轻甲'][(w - 1) % 5];
    let atk   = ['普通', '穿刺', '魔法', '攻城', '穿刺'][(w - 1) % 5];
    const trait = WAVE_TRAIT_SCHEDULE[w] || null;

    if (trait === 'fast')   { speed *= 1.35; hp *= 0.75; }
    if (trait === 'regen')  { regen = 0.015; hp *= 1.08; }
    if (trait === 'magic')  { magicImmune = true; }
    if (trait === 'heavy')  { armor = '重甲'; hp *= 1.1; dmg *= 0.9; }
    if (trait === 'swarm')  { count = Math.round(count * 1.4); hp *= 0.65; dmg *= 0.85; speed *= 1.1; }
    if (trait === 'ranged') { range = 60; atk = '魔法'; dmg *= 0.85; armor = '无甲'; }
    if (trait === 'boss')   {
      count = (w === 20) ? 2 : 1;
      const hpMult  = (w === 10) ? 5.5 : (w === 20) ? 5 : 9;
      const dmgMult = (w === 30) ? 1.5 : 1.35;
      hp *= hpMult; dmg *= dmgMult; speed *= 0.72; aspd = 1.35; r = 20; boss = true;
    }
    WAVES.push({
      w, count, hp: Math.round(hp), dmg: Math.round(dmg), speed, aspd, range, r,
      armor, atk, trait, regen, magicImmune, boss,
    });
  }
})();
